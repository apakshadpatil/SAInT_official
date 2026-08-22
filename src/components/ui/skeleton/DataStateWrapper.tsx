import type { ReactNode } from 'react';
import { AlertCircle, FolderOpen, RefreshCw } from 'lucide-react';

interface DataStateWrapperProps {
  loading: boolean;
  error?: string | null;
  isEmpty?: boolean;
  isRefetching?: boolean;
  skeleton: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  children: ReactNode;
  className?: string;
}

export default function DataStateWrapper({
  loading,
  error,
  isEmpty = false,
  isRefetching = false,
  skeleton,
  emptyTitle = 'No data available',
  emptyDescription = 'There are no records to display at this moment.',
  emptyAction,
  onRetry,
  children,
  className = '',
}: DataStateWrapperProps) {
  // 1. Initial Loading state -> render skeleton
  if (loading) {
    return <div className={`animate-fade-in ${className}`}>{skeleton}</div>;
  }

  // 2. Error state
  if (error) {
    return (
      <div
        className={`p-8 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 text-center space-y-3 ${className}`}
      >
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">Failed to load content</h3>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-md mx-auto">{error}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        )}
      </div>
    );
  }

  // 3. Confirmed Empty state
  if (isEmpty) {
    return (
      <div
        className={`p-10 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30 text-center space-y-3 animate-fade-in ${className}`}
      >
        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
          <FolderOpen className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{emptyTitle}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">{emptyDescription}</p>
        </div>
        {emptyAction && <div className="pt-2">{emptyAction}</div>}
      </div>
    );
  }

  // 4. Data successfully loaded
  return (
    <div className={`relative animate-fade-in ${className}`}>
      {isRefetching && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500/20 overflow-hidden z-20">
          <div className="w-full h-full bg-blue-500 animate-pulse" />
        </div>
      )}
      {children}
    </div>
  );
}
