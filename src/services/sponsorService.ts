import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Sponsor } from '../types';
import {
  extractSupabasePathFromPublicUrl,
  removeFileFromSupabase,
  uploadFileToSupabase,
} from '../utils/supabase';
import { uploadFileToStorage } from '../utils/fileUtils';

const SPONSORS_COLLECTION = 'sponsors';

function now(): string {
  return new Date().toISOString();
}

/**
 * Remove undefined values to prevent Firestore write errors.
 */
function cleanPayload<T extends Record<string, any>>(obj: T): T {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned as T;
}

/**
 * Fetch all sponsors ordered by creation time.
 */
export async function getSponsors(): Promise<Sponsor[]> {
  try {
    const q = query(collection(db, SPONSORS_COLLECTION), orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Sponsor));
  } catch (err) {
    // Fallback if index/ordering issue
    console.warn('Sponsors query with orderBy failed, falling back to simple getDocs:', err);
    const snapshot = await getDocs(collection(db, SPONSORS_COLLECTION));
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() } as Sponsor))
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }
}

/**
 * Subscribe to real-time sponsors updates.
 */
export function subscribeSponsors(callback: (sponsors: Sponsor[]) => void) {
  try {
    const q = query(collection(db, SPONSORS_COLLECTION), orderBy('createdAt', 'asc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Sponsor));
        callback(list);
      },
      (err) => {
        console.warn('Real-time sponsors subscription with orderBy failed, falling back to basic listener:', err);
        return onSnapshot(collection(db, SPONSORS_COLLECTION), (basicSnap) => {
          const list = basicSnap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Sponsor))
            .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
          callback(list);
        });
      }
    );
  } catch {
    return onSnapshot(collection(db, SPONSORS_COLLECTION), (basicSnap) => {
      const list = basicSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Sponsor))
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      callback(list);
    });
  }
}

/**
 * Upload sponsor logo using existing Supabase/Firebase storage mechanism.
 */
export async function uploadSponsorLogo(file: File): Promise<string> {
  const safeName = file.name.replace(/\s+/g, '_');
  const destPath = `sponsors/${Date.now()}_${safeName}`;

  try {
    return await uploadFileToSupabase(file, destPath);
  } catch (supabaseErr) {
    console.warn('Supabase upload failed for sponsor logo, falling back to Firebase Storage:', supabaseErr);
    try {
      return await uploadFileToStorage(file, destPath);
    } catch (fbErr) {
      console.error('Firebase fallback upload failed for sponsor logo:', fbErr);
      throw new Error('Failed to upload sponsor logo. Please try a different image.');
    }
  }
}

/**
 * Create a new sponsor record.
 */
export async function createSponsor(data: {
  logoUrl: string;
  websiteUrl?: string;
}): Promise<Sponsor> {
  const timestamp = now();
  const rawData = cleanPayload({
    logoUrl: data.logoUrl.trim(),
    websiteUrl: data.websiteUrl?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const docRef = await addDoc(collection(db, SPONSORS_COLLECTION), rawData);

  return {
    id: docRef.id,
    logoUrl: data.logoUrl.trim(),
    websiteUrl: data.websiteUrl?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Update an existing sponsor record.
 */
export async function updateSponsor(
  id: string,
  data: {
    logoUrl?: string;
    websiteUrl?: string;
  }
): Promise<void> {
  const updates = cleanPayload({
    ...(data.logoUrl ? { logoUrl: data.logoUrl.trim() } : {}),
    websiteUrl: data.websiteUrl !== undefined ? (data.websiteUrl.trim() || null) : undefined,
    updatedAt: now(),
  });

  await updateDoc(doc(db, SPONSORS_COLLECTION, id), updates);
}

/**
 * Delete a sponsor record and clean up associated storage.
 */
export async function deleteSponsor(id: string, logoUrl?: string): Promise<void> {
  // Delete document
  await deleteDoc(doc(db, SPONSORS_COLLECTION, id));

  // Clean up Supabase storage file if path can be extracted
  if (logoUrl) {
    const storagePath = extractSupabasePathFromPublicUrl(logoUrl);
    if (storagePath) {
      try {
        await removeFileFromSupabase(storagePath);
      } catch (err) {
        console.warn('Failed to remove sponsor logo from Supabase Storage:', err);
      }
    }
  }
}
