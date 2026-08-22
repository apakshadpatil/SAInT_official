import Skeleton from './Skeleton';

interface TaskItemSkeletonProps {
  count?: number;
  className?: string;
}

export default function TaskItemSkeleton({
  count = 4,
  className = '',
}: TaskItemSkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <Skeleton variant="circular" width={24} height={24} className="shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <Skeleton variant="text" width="60%" height={16} />
              <div className="flex items-center gap-2">
                <Skeleton variant="rounded" width={55} height={18} />
                <Skeleton variant="text" width={100} height={12} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton variant="rounded" width={50} height={22} />
            <Skeleton variant="rounded" width={28} height={28} />
          </div>
        </div>
      ))}
    </div>
  );
}
