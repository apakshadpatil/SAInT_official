import { useEffect, useState } from 'react';
import { ExternalLink, Globe, Handshake, Sparkles } from 'lucide-react';
import { subscribeSponsors } from '../../services/sponsorService';
import type { Sponsor } from '../../types';

/**
 * Extracts a clean, human-readable display name for the sponsor.
 * Uses explicit `name` if present; otherwise derives a brand name from `websiteUrl`.
 */
function getSponsorDisplayName(sponsor: Sponsor): string {
  if (sponsor.name && sponsor.name.trim()) {
    return sponsor.name.trim();
  }
  if (sponsor.websiteUrl) {
    try {
      const url = new URL(sponsor.websiteUrl.startsWith('http') ? sponsor.websiteUrl : `https://${sponsor.websiteUrl}`);
      const hostname = url.hostname.replace(/^www\./i, '');
      const parts = hostname.split('.');
      if (parts.length >= 2 && parts[0].length > 1) {
        return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      }
      return hostname;
    } catch {
      const raw = sponsor.websiteUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
      if (raw) {
        return raw.charAt(0).toUpperCase() + raw.slice(1);
      }
    }
  }
  return '';
}

/**
 * Extracts a clean domain string (e.g. "example.com") for links and tooltips.
 */
function getCleanDomain(urlStr?: string): string {
  if (!urlStr) return '';
  try {
    const url = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    return url.hostname.replace(/^www\./i, '');
  } catch {
    return urlStr.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || '';
  }
}

export default function SponsorsSection() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeSponsors((list) => {
      setSponsors(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Do not render anything if loading or if there are no sponsors configured
  if (loading || sponsors.length === 0) {
    return null;
  }

  const count = sponsors.length;

  // Adapt headings based on sponsor count
  const headingTitle = count === 1 ? 'Our Sponsor' : count <= 3 ? 'Our Sponsors' : 'Our Sponsors & Partners';

  return (
    <section aria-label="Event Sponsors" className="relative py-10 sm:py-14 md:py-16 overflow-hidden bg-transparent">
      {/* Decorative ambient background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center -z-10">
        <div className="w-[320px] sm:w-[520px] md:w-[720px] h-[220px] sm:h-[300px] rounded-full bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-sky-500/10 blur-3xl opacity-70 dark:opacity-30" />
      </div>

      {/* Section Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 sm:mb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/40 mb-3 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span>Proudly Supported By</span>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {headingTitle}
        </h2>
      </div>

      {/* Content dynamically adapts based on sponsor count */}
      {count === 1 ? (
        /* 1 Sponsor: Large, prominent, visually centered showcase */
        <SingleFeaturedSponsor sponsor={sponsors[0]} />
      ) : count <= 3 ? (
        /* 2-3 Sponsors: Balanced medium cards layout */
        <MediumSponsorsGrid sponsors={sponsors} />
      ) : count === 4 ? (
        /* 4 Sponsors: Clean 4-column balanced grid */
        <FourSponsorsGrid sponsors={sponsors} />
      ) : (
        /* 5+ Sponsors: Seamless continuous marquee track */
        <MarqueeSponsorsLayout sponsors={sponsors} />
      )}
    </section>
  );
}

/**
 * 1 Sponsor: Featured prominent card with large logo, centered presentation, and full aspect ratio fidelity.
 */
function SingleFeaturedSponsor({ sponsor }: { sponsor: Sponsor }) {
  const [imgError, setImgError] = useState(false);
  const displayName = getSponsorDisplayName(sponsor);
  const cleanDomain = getCleanDomain(sponsor.websiteUrl);

  return (
    <div className="max-w-xl sm:max-w-2xl mx-auto px-4 sm:px-6">
      <div className="relative group rounded-3xl p-8 sm:p-12 md:p-14 bg-white/95 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/60 transition-all duration-300 hover:shadow-2xl hover:border-blue-400/50 dark:hover:border-blue-500/40 text-center">
        {/* Subtle decorative glow ring on hover */}
        <div className="pointer-events-none absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-sky-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm -z-10" />

        {/* Prominent Logo Container */}
        <div className="py-4 sm:py-6 md:py-8 flex items-center justify-center w-full min-h-[160px] sm:min-h-[200px] md:min-h-[220px]">
          {imgError ? (
            <div className="flex flex-col items-center justify-center p-6 text-slate-400 dark:text-slate-500">
              <Handshake className="w-16 h-16 text-blue-500 mb-2 opacity-80" />
              <p className="text-base font-semibold">{displayName || 'Featured Sponsor'}</p>
            </div>
          ) : sponsor.websiteUrl ? (
            <a
              href={sponsor.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-2xl"
              title={`Visit ${displayName || 'sponsor website'}`}
            >
              <img
                src={sponsor.logoUrl}
                alt={displayName ? `${displayName} Logo` : 'Featured Sponsor Logo'}
                loading="lazy"
                onError={() => setImgError(true)}
                className="h-28 sm:h-36 md:h-44 lg:h-48 w-auto max-w-[85%] sm:max-w-[380px] md:max-w-[460px] object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300 pointer-events-auto select-none"
              />
            </a>
          ) : (
            <img
              src={sponsor.logoUrl}
              alt={displayName ? `${displayName} Logo` : 'Featured Sponsor Logo'}
              loading="lazy"
              onError={() => setImgError(true)}
              className="h-28 sm:h-36 md:h-44 lg:h-48 w-auto max-w-[85%] sm:max-w-[380px] md:max-w-[460px] object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300 pointer-events-auto select-none"
            />
          )}
        </div>

        {/* Sponsor Information */}
        <div className="mt-4 flex flex-col items-center">
          {displayName && (
            <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
              {displayName}
            </h3>
          )}

          {sponsor.websiteUrl && (
            <div className="mt-4 flex flex-col items-center gap-3">
              <a
                href={sponsor.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title={sponsor.websiteUrl}
              >
                <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>{cleanDomain}</span>
                <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
              </a>

              <a
                href={sponsor.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 active:scale-95"
              >
                <span>Visit Website</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 2-3 Sponsors: Balanced medium cards layout.
 */
function MediumSponsorsGrid({ sponsors }: { sponsors: Sponsor[] }) {
  const gridColsClass = sponsors.length === 2
    ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl'
    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-5xl';

  return (
    <div className={`grid ${gridColsClass} gap-6 md:gap-8 mx-auto px-4 sm:px-6`}>
      {sponsors.map((sponsor) => (
        <MediumSponsorCard key={sponsor.id} sponsor={sponsor} />
      ))}
    </div>
  );
}

function MediumSponsorCard({ sponsor }: { sponsor: Sponsor }) {
  const [imgError, setImgError] = useState(false);
  const displayName = getSponsorDisplayName(sponsor);
  const cleanDomain = getCleanDomain(sponsor.websiteUrl);

  return (
    <div className="relative group rounded-2xl p-6 sm:p-8 bg-white/95 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-lg shadow-slate-200/40 dark:shadow-none hover:shadow-xl hover:border-blue-400/50 dark:hover:border-blue-500/40 transition-all duration-300 flex flex-col items-center justify-between text-center min-h-[220px]">
      <div className="py-4 flex items-center justify-center w-full min-h-[120px] sm:min-h-[140px] flex-1">
        {imgError ? (
          <div className="flex flex-col items-center justify-center p-4 text-slate-400">
            <Handshake className="w-10 h-10 text-blue-500 mb-1 opacity-80" />
            <p className="text-xs font-medium">{displayName || 'Sponsor'}</p>
          </div>
        ) : sponsor.websiteUrl ? (
          <a
            href={sponsor.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
            title={`Visit ${displayName || 'sponsor website'}`}
          >
            <img
              src={sponsor.logoUrl}
              alt={displayName ? `${displayName} Logo` : 'Sponsor Logo'}
              loading="lazy"
              onError={() => setImgError(true)}
              className="h-20 sm:h-24 md:h-28 w-auto max-w-[85%] sm:max-w-[220px] object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-300 pointer-events-auto select-none"
            />
          </a>
        ) : (
          <img
            src={sponsor.logoUrl}
            alt={displayName ? `${displayName} Logo` : 'Sponsor Logo'}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-20 sm:h-24 md:h-28 w-auto max-w-[85%] sm:max-w-[220px] object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-300 pointer-events-auto select-none"
          />
        )}
      </div>

      <div className="mt-3 w-full flex flex-col items-center">
        {displayName && (
          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 truncate max-w-full">
            {displayName}
          </h3>
        )}

        {sponsor.websiteUrl && (
          <a
            href={sponsor.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold mt-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            <Globe className="w-3 h-3" />
            <span>{cleanDomain || 'Website'}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * 4 Sponsors: Clean 4-card grid.
 */
function FourSponsorsGrid({ sponsors }: { sponsors: Sponsor[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-6xl mx-auto px-4 sm:px-6">
      {sponsors.map((sponsor) => (
        <MediumSponsorCard key={sponsor.id} sponsor={sponsor} />
      ))}
    </div>
  );
}

/**
 * 5+ Sponsors: Seamless infinite marquee track.
 */
function MarqueeSponsorsLayout({ sponsors }: { sponsors: Sponsor[] }) {
  const marqueeItems = [...sponsors, ...sponsors, ...sponsors];

  return (
    <div className="w-full relative overflow-hidden py-2">
      {/* Edge gradient masks */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-16 z-10 bg-gradient-to-r from-white/90 dark:from-black/90 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-16 z-10 bg-gradient-to-l from-white/90 dark:from-black/90 to-transparent" />

      <div className="sponsors-marquee-track flex items-center gap-10 sm:gap-14 md:gap-20 py-2">
        {marqueeItems.map((sponsor, index) => (
          <MarqueeSponsorLogoItem key={`${sponsor.id}-${index}`} sponsor={sponsor} />
        ))}
      </div>
    </div>
  );
}

function MarqueeSponsorLogoItem({ sponsor }: { sponsor: Sponsor }) {
  const [imgError, setImgError] = useState(false);
  const displayName = getSponsorDisplayName(sponsor);

  const imageElement = imgError ? (
    <div className="flex items-center justify-center gap-2 px-3 py-2 text-slate-400">
      <Handshake className="w-5 h-5 text-blue-500" />
      <span className="text-xs font-semibold">{displayName || 'Sponsor'}</span>
    </div>
  ) : (
    <img
      src={sponsor.logoUrl}
      alt={displayName ? `${displayName} Logo` : 'Sponsor Logo'}
      loading="lazy"
      onError={() => setImgError(true)}
      className="h-14 sm:h-18 md:h-22 max-w-[150px] sm:max-w-[190px] md:max-w-[240px] w-auto object-contain hover:scale-105 transition-transform duration-300 pointer-events-auto select-none"
    />
  );

  const containerClasses = "h-16 sm:h-20 md:h-24 w-[140px] sm:w-[180px] md:w-[230px] shrink-0 flex items-center justify-center";

  if (sponsor.websiteUrl) {
    return (
      <a
        href={sponsor.websiteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${containerClasses} rounded-2xl transition-transform duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
        title={`Visit ${displayName || 'sponsor website'}`}
      >
        {imageElement}
      </a>
    );
  }

  return (
    <div className={`${containerClasses} select-none`}>
      {imageElement}
    </div>
  );
}
