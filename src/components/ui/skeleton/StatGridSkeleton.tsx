import Skeleton from './Skeleton';

interface StatGridSkeletonProps {
  count?: number;
  columns?: string;
  className?: string;
}

export default function StatGridSkeleton({
  count = 4,
  columns = 'grid-cols-2 lg:grid-cols-4',
  className = '',
}: StatGridSkeletonProps) {
  return (
    <div className={`grid ${columns} gap-3 sm:gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="stat-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 relative overflow-hidden"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton variant="text" width="60%" height={12} />
              <Skeleton variant="text" width="80%" height={26} />
              <Skeleton variant="text" width="45%" height={11} />
            </div>
            <Skeleton variant="rounded" width={38} height={38} className="shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}
