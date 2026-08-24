import Skeleton from './Skeleton';

interface CardSkeletonProps {
  lines?: number;
  count?: number;
  height?: number | string;
  hasHeader?: boolean;
  className?: string;
}

export default function CardSkeleton({
  lines = 3,
  count = 1,
  height,
  hasHeader = true,
  className = '',
}: CardSkeletonProps) {
  const cards = Array.from({ length: count });

  return (
    <>
      {cards.map((_, cIdx) => (
        <div
          key={cIdx}
          style={height ? { minHeight: height } : undefined}
          className={`p-5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm shadow-sm space-y-4 ${className}`}
        >
          {hasHeader && (
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
              <div className="flex items-center gap-3">
                <Skeleton variant="circular" width={36} height={36} />
                <div className="space-y-1.5">
                  <Skeleton variant="text" width={140} height={16} />
                  <Skeleton variant="text" width={90} height={12} />
                </div>
              </div>
              <Skeleton variant="rounded" width={28} height={28} />
            </div>
          )}

          <div className="space-y-2.5 pt-1">
            {Array.from({ length: lines }).map((_, i) => (
              <Skeleton
                key={i}
                variant="text"
                width={i === lines - 1 ? '70%' : i === 0 ? '95%' : '85%'}
                height={14}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
