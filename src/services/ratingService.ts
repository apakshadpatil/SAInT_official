import {
  collection,
  doc,
  getDocs,
  query,
  where,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ApplicationRating, PanelRating } from '../types';

function now() {
  return new Date().toISOString();
}

// Get rating document for a specific application
export async function getApplicationRating(applicationId: string): Promise<ApplicationRating | null> {
  const snap = await getDocs(query(collection(db, 'applicationRatings'), where('applicationId', '==', applicationId)));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as ApplicationRating;
}

// Subscribe to real-time updates for an application's ratings
export function subscribeApplicationRating(
  applicationId: string,
  callback: (rating: ApplicationRating | null) => void
) {
  return onSnapshot(
    query(collection(db, 'applicationRatings'), where('applicationId', '==', applicationId)),
    (snap) => {
      if (snap.empty) {
        callback(null);
      } else {
        callback({ id: snap.docs[0].id, ...snap.docs[0].data() } as ApplicationRating);
      }
    }
  );
}

// Get all ratings for a panel
export async function getPanelRatings(panelId: string): Promise<ApplicationRating[]> {
  const snap = await getDocs(query(collection(db, 'applicationRatings'), where('panelId', '==', panelId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ApplicationRating));
}

// Submit or update a rating for an application by a panellist
export async function submitRating(
  applicationId: string,
  panelId: string,
  panelName: string,
  panellistId: string,
  panellistName: string,
  rating: number,
  comment?: string
) {
  if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');

  try {
    // Get or create the rating document
    let ratingDoc = await getApplicationRating(applicationId);

    const newRating: PanelRating = {
      panellistId,
      panellistName,
      rating,
      ...(comment?.trim() && { comment: comment.trim() }),
      timestamp: now(),
    };

    if (!ratingDoc) {
      // Create new document
      const docRef = doc(collection(db, 'applicationRatings'));
      const newDoc: Omit<ApplicationRating, 'id'> = {
        applicationId,
        panelId,
        panelName,
        ratings: [newRating],
        averageRating: rating,
        totalRaters: 1,
        createdAt: now(),
        updatedAt: now(),
      };
      await setDoc(docRef, newDoc);
    } else {
      // Update existing document
      const existingRatingIndex = ratingDoc.ratings.findIndex((r) => r.panellistId === panellistId);

      let updatedRatings: PanelRating[];
      if (existingRatingIndex >= 0) {
        // Replace existing rating from this panellist
        updatedRatings = [...ratingDoc.ratings];
        updatedRatings[existingRatingIndex] = newRating;
      } else {
        // Add new rating from this panellist
        updatedRatings = [...ratingDoc.ratings, newRating];
      }

      // Calculate new average
      const averageRating = updatedRatings.reduce((sum, r) => sum + r.rating, 0) / updatedRatings.length;

      await updateDoc(doc(db, 'applicationRatings', ratingDoc.id), {
        ratings: updatedRatings,
        averageRating: Math.round(averageRating * 10) / 10,
        totalRaters: updatedRatings.length,
        updatedAt: now(),
      });
    }
  } catch (err) {
    throw new Error(`Failed to submit rating: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

// Get a specific panellist's rating for an application
export function getPanellistRating(rating: ApplicationRating | null, panellistId: string): PanelRating | undefined {
  if (!rating) return undefined;
  return rating.ratings.find((r) => r.panellistId === panellistId);
}
