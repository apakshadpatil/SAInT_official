import Skeleton from './Skeleton';

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  columns?: number;
  hasSearch?: boolean;
  className?: string;
}

export default function TableSkeleton({
  rows = 5,
  cols,
  columns = 5,
  hasSearch = true,
  className = '',
}: TableSkeletonProps) {
  const actualCols = cols ?? columns ?? 5;
  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm overflow-hidden ${className}`}
    >
      {hasSearch && (
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Skeleton variant="rounded" width="280px" height={36} />
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Skeleton variant="rounded" width={90} height={36} />
            <Skeleton variant="rounded" width={90} height={36} />
          </div>
        </div>
      )}

      {/* Table Header */}
      <div className="px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-4">
        {Array.from({ length: actualCols }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            width={i === 0 ? '25%' : i === actualCols - 1 ? '15%' : '20%'}
            height={14}
          />
        ))}
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-slate-200/40 dark:divide-slate-800/40">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-5 py-4 flex items-center justify-between gap-4">
            {Array.from({ length: actualCols }).map((_, c) => (
              <div key={c} className={c === 0 ? 'w-[25%]' : c === actualCols - 1 ? 'w-[15%]' : 'w-[20%]'}>
                {c === 0 ? (
                  <div className="flex items-center gap-3">
                    <Skeleton variant="circular" width={32} height={32} />
                    <div className="space-y-1 flex-1">
                      <Skeleton variant="text" width="90%" height={14} />
                      <Skeleton variant="text" width="60%" height={11} />
                    </div>
                  </div>
                ) : (
                  <Skeleton
                    variant="text"
                    width={c % 2 === 0 ? '70%' : '85%'}
                    height={14}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
