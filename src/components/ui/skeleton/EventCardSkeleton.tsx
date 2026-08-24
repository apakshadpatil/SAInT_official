import Skeleton from './Skeleton';

interface EventCardSkeletonProps {
  count?: number;
  viewMode?: 'grid' | 'list' | 'timeline';
  variant?: 'grid' | 'list' | 'timeline';
  className?: string;
}

export default function EventCardSkeleton({
  count = 3,
  viewMode,
  variant,
  className = '',
}: EventCardSkeletonProps) {
  const activeMode = viewMode || variant || 'grid';
  if (activeMode === 'timeline') {
    return (
      <div className={`relative ${className}`}>
        {/* Timeline track line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200/60 dark:bg-slate-800/60" />

        <div className="space-y-8">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="relative pl-16">
              {/* Timeline circle node */}
              <div className="absolute left-3.5 top-6 w-5 h-5 rounded-full bg-blue-400/30 border-4 border-white dark:border-slate-900 z-10 animate-pulse" />

              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 overflow-hidden shadow-sm">
                {/* Banner image skeleton */}
                <Skeleton variant="rectangular" width="100%" height={180} />

                <div className="p-6 space-y-4">
                  {/* Date badge */}
                  <div className="flex items-center gap-2">
                    <Skeleton variant="circular" width={16} height={16} />
                    <Skeleton variant="text" width={140} height={16} />
                  </div>

                  {/* Title */}
                  <Skeleton variant="text" width="75%" height={24} />

                  {/* Description lines */}
                  <div className="space-y-2">
                    <Skeleton variant="text" width="100%" height={14} />
                    <Skeleton variant="text" width="90%" height={14} />
                  </div>

                  {/* Winners box placeholder */}
                  <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 space-y-2 bg-slate-50/50 dark:bg-slate-800/20">
                    <Skeleton variant="text" width={100} height={14} />
                    <Skeleton variant="text" width="60%" height={12} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeMode === 'list') {
    return (
      <div className={`space-y-4 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="p-5 sm:p-6 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
          >
            {/* Left side: Thumbnail & text */}
            <div className="flex items-start gap-4 flex-1 w-full">
              <Skeleton
                variant="rounded"
                width={112}
                height={112}
                className="shrink-0 rounded-lg"
              />
              <div className="space-y-2.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Skeleton variant="rounded" width={60} height={18} />
                  <Skeleton variant="text" width={120} height={14} />
                </div>
                <Skeleton variant="text" width="70%" height={22} />
                <Skeleton variant="text" width="95%" height={14} />
                <div className="flex items-center gap-4 pt-1">
                  <Skeleton variant="text" width={130} height={12} />
                  <Skeleton variant="text" width={90} height={12} />
                </div>
              </div>
            </div>

            {/* Right side: Button */}
            <div className="w-full lg:w-56 shrink-0">
              <Skeleton variant="rounded" width="100%" height={44} className="rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 overflow-hidden flex flex-col shadow-sm"
        >
          {/* Banner Placeholder (h-44 to match event card) */}
          <Skeleton variant="rectangular" width="100%" height={176} />

          <div className="p-6 flex flex-col flex-1 space-y-3">
            {/* Date & Time row */}
            <div className="flex items-center gap-2">
              <Skeleton variant="circular" width={16} height={16} />
              <Skeleton variant="text" width={130} height={14} />
            </div>

            {/* Event Title */}
            <Skeleton variant="text" width="80%" height={22} />

            {/* Description lines */}
            <div className="space-y-1.5 flex-1">
              <Skeleton variant="text" width="100%" height={13} />
              <Skeleton variant="text" width="90%" height={13} />
              <Skeleton variant="text" width="65%" height={13} />
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 pt-1">
              <Skeleton variant="circular" width={14} height={14} />
              <Skeleton variant="text" width={120} height={13} />
            </div>

            {/* Full-width Register Button */}
            <div className="pt-2">
              <Skeleton variant="rounded" width="100%" height={42} className="rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

