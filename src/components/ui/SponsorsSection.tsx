import { useEffect, useState } from 'react';
import { ExternalLink, Globe, Handshake, Sparkles } from 'lucide-react';
import { subscribeSponsors } from '../../services/sponsorService';
import type { Sponsor } from '../../types';

function getSponsorDisplayName(sponsor: Sponsor): string {
  if (sponsor.name && sponsor.name.trim()) return sponsor.name.trim();
  if (sponsor.websiteUrl) {
    try {
      const url = new URL(sponsor.websiteUrl.startsWith('http') ? sponsor.websiteUrl : `https://${sponsor.websiteUrl}`);
      const hostname = url.hostname.replace(/^www\./i, '');
      const parts = hostname.split('.');
      if (parts.length >= 2 && parts[0].length > 1) return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      return hostname;
    } catch {
      const raw = sponsor.websiteUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
      if (raw) return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
  }
  return '';
}

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

  if (loading || sponsors.length === 0) return null;

  const titleSponsor = sponsors[0];
  const otherSponsors = sponsors.slice(1);

  return (
    <section aria-label="Event Sponsors" className="relative py-10 sm:py-14 md:py-16 overflow-hidden bg-transparent">
      {/* Decorative ambient background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center -z-10">
        <div className="w-[320px] sm:w-[520px] md:w-[720px] h-[220px] sm:h-[300px] rounded-full bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-sky-500/10 blur-3xl opacity-70 dark:opacity-30" />
      </div>

      {/* Section Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 sm:mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/40 mb-3 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span>Proudly Supported By</span>
        </div>
      </div>

      {/* ── Title Sponsor ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 sm:mb-12">
        <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-400 mb-5">
          ✦ Title Sponsor ✦
        </p>
        <div className="flex justify-center">
          <TitleSponsorLogo sponsor={titleSponsor} />
        </div>
      </div>

      {/* ── Other Sponsors ── */}
      {otherSponsors.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-6">
            Other Sponsors
          </p>
          <OtherSponsorsRow sponsors={otherSponsors} />
        </div>
      )}
    </section>
  );
}

/** Title Sponsor — no box, just a large clean logo */
function TitleSponsorLogo({ sponsor }: { sponsor: Sponsor }) {
  const [imgError, setImgError] = useState(false);
  const displayName = getSponsorDisplayName(sponsor);
  const cleanDomain = getCleanDomain(sponsor.websiteUrl);

  const logoEl = imgError ? (
    <div className="flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
      <Handshake className="w-20 h-20 text-blue-400 opacity-80" />
      <p className="text-lg font-semibold">{displayName || 'Title Sponsor'}</p>
    </div>
  ) : (
    <img
      src={sponsor.logoUrl}
      alt={displayName ? `${displayName} Logo` : 'Title Sponsor Logo'}
      loading="lazy"
      onError={() => setImgError(true)}
      className="h-28 sm:h-36 md:h-44 lg:h-52 w-auto max-w-[85vw] sm:max-w-[420px] md:max-w-[520px] object-contain drop-shadow-lg hover:scale-105 transition-transform duration-300 select-none"
    />
  );

  return (
    <div className="flex flex-col items-center gap-5">
      {sponsor.websiteUrl ? (
        <a
          href={sponsor.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-2xl"
          title={`Visit ${displayName || 'sponsor website'}`}
        >
          {logoEl}
        </a>
      ) : (
        logoEl
      )}

      {/* Name + domain link beneath logo */}
      <div className="flex flex-col items-center gap-1.5">
        {displayName && (
          <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
            {displayName}
          </h3>
        )}
        {sponsor.websiteUrl && (
          <a
            href={sponsor.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>{cleanDomain}</span>
            <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
          </a>
        )}
      </div>
    </div>
  );
}

/** Other Sponsors — horizontal centered row of bare logos */
function OtherSponsorsRow({ sponsors }: { sponsors: Sponsor[] }) {
  return (
    <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-12 md:gap-16">
      {sponsors.map((sponsor) => (
        <OtherSponsorLogoItem key={sponsor.id} sponsor={sponsor} />
      ))}
    </div>
  );
}

function OtherSponsorLogoItem({ sponsor }: { sponsor: Sponsor }) {
  const [imgError, setImgError] = useState(false);
  const displayName = getSponsorDisplayName(sponsor);

  const logoEl = imgError ? (
    <div className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500">
      <Handshake className="w-8 h-8 text-blue-400 opacity-70" />
      <span className="text-xs font-medium">{displayName || 'Sponsor'}</span>
    </div>
  ) : (
    <img
      src={sponsor.logoUrl}
      alt={displayName ? `${displayName} Logo` : 'Sponsor Logo'}
      loading="lazy"
      onError={() => setImgError(true)}
      className="h-12 sm:h-16 md:h-20 w-auto max-w-[130px] sm:max-w-[160px] object-contain opacity-80 hover:opacity-100 hover:scale-105 transition-all duration-300 select-none"
    />
  );

  if (sponsor.websiteUrl) {
    return (
      <a
        href={sponsor.websiteUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`Visit ${displayName || 'sponsor website'}`}
        className="outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
      >
        {logoEl}
      </a>
    );
  }
  return <div>{logoEl}</div>;
}
