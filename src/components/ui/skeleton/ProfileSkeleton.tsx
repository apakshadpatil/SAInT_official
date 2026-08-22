import Skeleton from './Skeleton';

interface ProfileSkeletonProps {
  className?: string;
}

export default function ProfileSkeleton({ className = '' }: ProfileSkeletonProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Banner / Header */}
      <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <Skeleton variant="circular" width={96} height={96} className="shrink-0" />
        <div className="space-y-3 flex-1 text-center sm:text-left">
          <Skeleton variant="text" width={220} height={24} className="mx-auto sm:mx-0" />
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <Skeleton variant="rounded" width={80} height={22} />
            <Skeleton variant="rounded" width={100} height={22} />
            <Skeleton variant="rounded" width={90} height={22} />
          </div>
          <Skeleton variant="text" width="80%" height={14} className="mx-auto sm:mx-0" />
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 space-y-4">
          <Skeleton variant="text" width={140} height={20} />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-slate-200/40 dark:border-slate-800/40">
                <Skeleton variant="text" width={90} height={14} />
                <Skeleton variant="text" width={130} height={14} />
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 space-y-4">
          <Skeleton variant="text" width={140} height={20} />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-slate-200/40 dark:border-slate-800/40">
                <Skeleton variant="text" width={90} height={14} />
                <Skeleton variant="text" width={130} height={14} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
