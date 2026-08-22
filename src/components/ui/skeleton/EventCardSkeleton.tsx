import Skeleton from './Skeleton';

interface EventCardSkeletonProps {
  count?: number;
  viewMode?: 'grid' | 'list';
  className?: string;
}

export default function EventCardSkeleton({
  count = 3,
  viewMode = 'grid',
  className = '',
}: EventCardSkeletonProps) {
  if (viewMode === 'list') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4 w-full sm:w-auto flex-1">
              <Skeleton variant="rounded" width={80} height={60} className="shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton variant="text" width="65%" height={18} />
                <div className="flex items-center gap-3">
                  <Skeleton variant="text" width={100} height={12} />
                  <Skeleton variant="text" width={80} height={12} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Skeleton variant="rounded" width={90} height={34} />
              <Skeleton variant="rounded" width={90} height={34} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 overflow-hidden flex flex-col"
        >
          {/* Banner Placeholder */}
          <Skeleton variant="rectangular" width="100%" height={160} />
          <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton variant="rounded" width={80} height={20} />
                <Skeleton variant="rounded" width={60} height={20} />
              </div>
              <Skeleton variant="text" width="90%" height={20} />
              <Skeleton variant="text" width="100%" height={14} />
              <Skeleton variant="text" width="75%" height={14} />
            </div>

            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton variant="text" width={90} height={12} />
                <Skeleton variant="text" width={70} height={12} />
              </div>
              <Skeleton variant="rounded" width={84} height={32} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
