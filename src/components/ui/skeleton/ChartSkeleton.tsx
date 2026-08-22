import Skeleton from './Skeleton';

interface ChartSkeletonProps {
  height?: number;
  type?: 'bar' | 'line' | 'pie';
  hasHeader?: boolean;
  className?: string;
}

export default function ChartSkeleton({
  height = 260,
  type = 'bar',
  hasHeader = true,
  className = '',
}: ChartSkeletonProps) {
  return (
    <div
      className={`p-5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 flex flex-col justify-between ${className}`}
    >
      {hasHeader && (
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-1">
            <Skeleton variant="text" width={160} height={18} />
            <Skeleton variant="text" width={100} height={12} />
          </div>
          <Skeleton variant="rounded" width={80} height={28} />
        </div>
      )}

      {type === 'pie' ? (
        <div className="flex items-center justify-center py-6" style={{ height: `${height}px` }}>
          <Skeleton variant="circular" width={180} height={180} />
        </div>
      ) : (
        <div
          className="flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-l border-slate-200/80 dark:border-slate-800/80"
          style={{ height: `${height}px` }}
        >
          {Array.from({ length: 8 }).map((_, i) => {
            const heights = ['35%', '65%', '45%', '85%', '60%', '95%', '70%', '50%'];
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <Skeleton
                  variant="rounded"
                  width="85%"
                  height={heights[i % heights.length]}
                  className="rounded-t-md rounded-b-none"
                />
                <Skeleton variant="text" width="60%" height={10} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
