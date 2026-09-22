/**
 * Client-Side Image Optimizer
 * Resizes and compresses images using HTMLCanvas before upload,
 * reducing multi-megabyte uploads to crisp ~100-250KB WebP/JPEG files.
 */

export interface ImageCompressionOptions {
  /** Maximum allowable width in pixels (defaults to 1920) */
  maxWidth?: number;
  /** Maximum allowable height in pixels (defaults to 1080) */
  maxHeight?: number;
  /** Compression quality between 0.0 and 1.0 (defaults to 0.82) */
  quality?: number;
  /** Preferred MIME format (defaults to 'image/webp') */
  format?: 'image/webp' | 'image/jpeg';
}

/**
 * Compresses an image File using browser canvas.
 * Preserves aspect ratio, orientation, and falls back to original File if unsupported or fails.
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.82,
    format = 'image/webp',
  } = options;

  // Don't compress non-images, vector SVGs, or animated GIFs
  const mime = file.type.toLowerCase();
  if (
    !mime.startsWith('image/') ||
    mime === 'image/svg+xml' ||
    mime === 'image/gif'
  ) {
    return file;
  }

  // Ensure DOM environment exists
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  return new Promise<File>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { naturalWidth: width, naturalHeight: height } = img;
      if (!width || !height) {
        resolve(file);
        return;
      }

      // Calculate constrained dimensions preserving aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const targetFormat = format === 'image/webp' ? 'image/webp' : 'image/jpeg';

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          // If compression somehow produced a larger file, keep original
          if (blob.size >= file.size && blob.type === file.type) {
            resolve(file);
            return;
          }

          const originalBaseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          const extension = targetFormat === 'image/webp' ? '.webp' : '.jpg';
          const optimizedFileName = `${originalBaseName}_opt${extension}`;

          const optimizedFile = new File([blob], optimizedFileName, {
            type: targetFormat,
            lastModified: Date.now(),
          });

          resolve(optimizedFile);
        },
        targetFormat,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/** Preset for event banners: standard 16:9 full HD target (1920x1080) */
export async function compressEventBanner(file: File): Promise<File> {
  return compressImage(file, {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.82,
    format: 'image/webp',
  });
}

/** Preset for payment screenshots: target max 1200x1600 at 0.75 quality */
export async function compressPaymentProof(file: File): Promise<File> {
  return compressImage(file, {
    maxWidth: 1200,
    maxHeight: 1600,
    quality: 0.75,
    format: 'image/webp',
  });
}
