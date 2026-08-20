import { storage } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const MAX_FILE_SIZE = 5_000_000; // 5MB recommended default for client uploads
export const MAX_INLINE_FILE_SIZE = 900_000; // ~900KB fallback inline limit for Firestore documents

export async function fileToDataUrl(file: File): Promise<{ dataUrl: string; fileName: string; fileType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ dataUrl: reader.result as string, fileName: file.name, fileType: file.type });
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadFileToStorage(file: File, path?: string): Promise<string> {
  if (!file) throw new Error('No file provided');
  if (file.size > MAX_FILE_SIZE) throw new Error(`File too large. Limit ${formatFileSize(MAX_FILE_SIZE)}.`);
  const dest = path || `uploads/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const storageRef = ref(storage, dest);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
