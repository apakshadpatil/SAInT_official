import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { GalleryImage } from '../types';

const GALLERY_CONFIG = doc(db, 'gallery', 'config');

export async function getGalleryConfig(): Promise<{ images: GalleryImage[]; visible: boolean }> {
  const snapshot = await getDoc(GALLERY_CONFIG);
  const data = snapshot.data();
  return { images: (data?.images || []) as GalleryImage[], visible: data?.visible !== false };
}

export function subscribeGalleryConfig(callback: (config: { images: GalleryImage[]; visible: boolean }) => void) {
  return onSnapshot(GALLERY_CONFIG, (snapshot) => {
    const data = snapshot.data();
    callback({ images: (data?.images || []) as GalleryImage[], visible: data?.visible !== false });
  }, (error) => {
    // Preserve the last known public visibility while the listener reconnects.
    // A network/rules error must never make the navigation link disappear.
    console.warn('Gallery settings are temporarily unavailable', error);
  });
}

export async function updateGalleryConfig(images: GalleryImage[], visible: boolean) {
  await setDoc(GALLERY_CONFIG, { images, visible, updatedAt: new Date().toISOString() }, { merge: true });
}
