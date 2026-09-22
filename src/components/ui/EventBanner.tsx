import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

export interface EventBannerProps {
  /** Image source URL */
  src?: string | null;
  /** Image alt text */
  alt: string;
  /** Additional container classes */
  className?: string;
  /** Aspect ratio class (default 'aspect-video' / 16:9) */
  aspectRatioClass?: string;
  /** Maximum height class on desktop (e.g. 'max-h-[440px]') */
  maxHeightClass?: string;
  /** Whether to show a darkening bottom gradient overlay for text readability */
  showOverlay?: boolean;
  /** Custom overlay style/gradient */
  overlayGradient?: string;
  /** Priority/loading behavior */
  priority?: boolean;
  /** Optional custom fallback icon */
  fallbackIcon?: React.ReactNode;
  /** Whether Doomsday theme is active */
  doomsdayMode?: boolean;
  /** Additional image element classes */
  imgClassName?: string;
}

/**
 * EventBanner: Single source of truth for event banner rendering across SAInT.
 * - Enforces standardized 16:9 aspect ratio (`aspect-video`).
 * - Responsive on both mobile and desktop viewports.
 * - Handles image loading errors gracefully with themed fallbacks.
 * - Protects overlays from Doomsday CSS black-box clobbering.
 */
export default function EventBanner({
  src,
  alt,
  className = '',
  aspectRatioClass = 'aspect-video',
  maxHeightClass = '',
  showOverlay = false,
  overlayGradient,
  priority = false,
  fallbackIcon,
  doomsdayMode = false,
  imgClassName = '',
}: EventBannerProps) {
  const [loadError, setLoadError] = useState(false);

  // Reset error state if image source changes
  useEffect(() => {
    setLoadError(false);
  }, [src]);

  const cleanSrc = src && typeof src === 'string' && src.trim().length > 0 ? src.trim() : null;
  const hasValidImage = Boolean(cleanSrc && !loadError);

  return (
    <div
      className={`relative w-full overflow-hidden ${aspectRatioClass} ${maxHeightClass} ${className}`}
      style={{
        background: doomsdayMode ? '#050805' : '#090d16',
      }}
    >
      {hasValidImage ? (
        <>
          <img
            src={cleanSrc!}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setLoadError(true)}
            className={`w-full h-full object-cover object-center transition-transform duration-500 ${imgClassName}`}
          />
          {showOverlay && (
            <div
              className="banner-overlay absolute inset-0 pointer-events-none"
              data-allow-gradient="true"
              style={{
                background:
                  overlayGradient ||
                  (doomsdayMode
                    ? 'linear-gradient(to top, rgba(5, 8, 5, 0.75) 0%, rgba(5, 8, 5, 0.15) 40%, transparent 75%)'
                    : 'linear-gradient(to top, rgba(10, 15, 29, 0.7) 0%, rgba(10, 15, 29, 0.1) 40%, transparent 75%)'),
              }}
            />
          )}
        </>
      ) : (
        /* Themed Fallback Banner (16:9 Ambient Display) */
        <div
          className="w-full h-full flex flex-col items-center justify-center relative p-6 select-none"
          style={{
            background: doomsdayMode
              ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.45) 0%, rgba(2, 44, 34, 0.7) 100%)'
              : 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
          }}
        >
          {/* Subtle Ambient Blob */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background: doomsdayMode
                ? 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.25) 0%, transparent 70%)'
                : 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.25) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-10 flex flex-col items-center text-center gap-2">
            <div
              className="p-3.5 rounded-2xl border backdrop-blur-md"
              style={{
                borderColor: doomsdayMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.15)',
                background: doomsdayMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                color: doomsdayMode ? '#34d399' : '#93c5fd',
              }}
            >
              {fallbackIcon || <Calendar className="w-8 h-8 sm:w-10 sm:h-10 opacity-75" />}
            </div>
            <span
              className="text-xs font-semibold uppercase tracking-wider line-clamp-1 max-w-xs"
              style={{ color: doomsdayMode ? 'rgba(167, 243, 208, 0.8)' : 'rgba(226, 232, 240, 0.8)' }}
            >
              {alt || 'SAInT Event'}
            </span>
          </div>

          {showOverlay && (
            <div
              className="banner-overlay absolute inset-0 pointer-events-none"
              data-allow-gradient="true"
              style={{
                background:
                  overlayGradient ||
                  (doomsdayMode
                    ? 'linear-gradient(to top, rgba(5, 8, 5, 0.95) 0%, transparent 100%)'
                    : 'linear-gradient(to top, rgba(10, 15, 29, 0.92) 0%, transparent 100%)'),
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
