import { createClient } from '@supabase/supabase-js';

// ─── Supabase Connection ─────────────────────────────────────────────────────
// Project: SAINT_WEBSITE  |  Bucket: SAINT STRBUCK
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  console.error('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Storage Bucket Configuration ────────────────────────────────────────────
// Bucket name must match exactly what was created in the Supabase Dashboard
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_KEY = supabaseKey;
export const SUPABASE_BUCKET = (import.meta.env.VITE_SUPABASE_BUCKET as string) || 'SAINT STRBUCK';
export const SUPABASE_QUOTA_MB = Number(import.meta.env.VITE_SUPABASE_BUCKET_QUOTA_MB) || 1024;

// Log connection info (development only)
if (import.meta.env.DEV) {
  console.log(`[Supabase] Connected → ${supabaseUrl}`);
  console.log(`[Supabase] Bucket    → ${SUPABASE_BUCKET}`);
}

// ─── Upload File to Supabase Storage ─────────────────────────────────────────
/**
 * Upload a File object to Supabase Storage and return its public URL.
 * @param file        - The File object to upload
 * @param destPath    - Storage path inside the bucket, e.g. 'events/banner.jpg'
 * @param targetBucket - Optional bucket override (defaults to SUPABASE_BUCKET)
 */
export async function uploadFileToSupabase(
  file: File,
  destPath: string,
  targetBucket: string = SUPABASE_BUCKET
): Promise<string> {
  const safePath = destPath.replace(/\s+/g, '_');

  const { error } = await supabase.storage
    .from(targetBucket)
    .upload(safePath, file, { cacheControl: '3600', upsert: true });

  if (error) {
    console.error(`[Supabase] Upload error to bucket "${targetBucket}":`, error.message);
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(targetBucket).getPublicUrl(safePath);
  if (data?.publicUrl) return data.publicUrl;

  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(targetBucket)}/${encodeURIComponent(safePath)}`;
}

// ─── Upload Base64 Data URL to Supabase Storage ───────────────────────────────
/**
 * Convert a base64 Data URL to a File and upload it to Supabase Storage.
 * Returns the original URL unchanged if it is already an https:// URL.
 */
export async function uploadDataUrlToSupabase(
  dataUrl: string,
  destPath: string,
  fileName = 'upload.png',
  targetBucket: string = SUPABASE_BUCKET
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl; // already a remote URL — pass through
  }

  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);

  const blob = new Blob([u8arr], { type: mime });
  const file = new File([blob], fileName, { type: mime });

  return uploadFileToSupabase(file, destPath, targetBucket);
}

// ─── Remove File from Supabase Storage ───────────────────────────────────────
/**
 * Delete a file from Supabase Storage by its storage path.
 */
export async function removeFileFromSupabase(
  storagePath: string,
  targetBucket: string = SUPABASE_BUCKET
): Promise<boolean> {
  const { error } = await supabase.storage.from(targetBucket).remove([storagePath]);
  if (error) {
    console.warn(`[Supabase] Remove error from bucket "${targetBucket}":`, error.message);
  }
  return !error;
}

// ─── Extract Storage Path from Public URL ─────────────────────────────────────
/**
 * Given a Supabase Storage public URL, extract the file path inside the bucket.
 */
export function extractSupabasePathFromPublicUrl(url: string): string | undefined {
  if (!url) return undefined;
  try {
    if (url.includes('/storage/v1/object/public/')) {
      const afterPublic = url.split('/storage/v1/object/public/')[1];
      // Remove bucket name prefix
      const parts = afterPublic.split('/');
      parts.shift();
      return decodeURIComponent(parts.join('/'));
    }
  } catch {
    // ignore malformed URLs
  }
  return undefined;
}
