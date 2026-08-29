import { useEffect, useState } from 'react';
import { subscribeSponsors } from '../../services/sponsorService';
import type { Sponsor } from '../../types';

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

  // If there are 4 or fewer sponsors, display a clean centered single horizontal row
  const isFewSponsors = sponsors.length <= 4;

  // Duplicate items for seamless infinite marquee loop when 5 or more sponsors
  const marqueeItems = isFewSponsors ? sponsors : [...sponsors, ...sponsors, ...sponsors];

  return (
    <section aria-label="Event Sponsors" className="relative py-8 sm:py-10 md:py-12 overflow-hidden bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 text-center">
        <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.25em] opacity-70" style={{ color: 'var(--dash-muted, #64748b)' }}>
          Our Proud Sponsors &amp; Partners
        </p>
      </div>

      <div className="w-full relative overflow-hidden">
        {/* Subtle edge masks */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-16 z-10 bg-gradient-to-r from-transparent via-transparent to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-16 z-10 bg-gradient-to-l from-transparent via-transparent to-transparent" />

        {isFewSponsors ? (
          /* Centered single horizontal row for few sponsors */
          <div className="flex items-center justify-center flex-nowrap overflow-x-auto gap-8 sm:gap-12 md:gap-16 px-6 py-2 scrollbar-none">
            {sponsors.map((sponsor) => (
              <SponsorLogoItem key={sponsor.id} sponsor={sponsor} />
            ))}
          </div>
        ) : (
          /* Continuous infinite horizontal marquee for many sponsors */
          <div className="sponsors-marquee-track flex items-center gap-10 sm:gap-14 md:gap-20 py-2">
            {marqueeItems.map((sponsor, index) => (
              <SponsorLogoItem key={`${sponsor.id}-${index}`} sponsor={sponsor} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SponsorLogoItem({ sponsor }: { sponsor: Sponsor }) {
  const imageElement = (
    <img
      src={sponsor.logoUrl}
      alt="Sponsor Logo"
      loading="lazy"
      className="h-14 sm:h-18 md:h-22 max-w-[150px] sm:max-w-[190px] md:max-w-[240px] w-auto object-contain hover:scale-105 transition-transform duration-300 pointer-events-auto select-none"
    />
  );

  // Logo container size: Desktop ~200-240px, Tablet ~170-190px, Mobile ~130-150px
  const containerClasses = "h-16 sm:h-20 md:h-24 w-[140px] sm:w-[180px] md:w-[230px] shrink-0 flex items-center justify-center";

  if (sponsor.websiteUrl) {
    return (
      <a
        href={sponsor.websiteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${containerClasses} rounded-2xl transition-transform duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
        title="Visit sponsor website"
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
