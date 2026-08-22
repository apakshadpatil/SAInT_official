import type { CSSProperties, ReactNode } from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  style?: CSSProperties;
  children?: ReactNode;
}

export default function Skeleton({
  className = '',
  variant = 'rounded',
  width,
  height,
  style = {},
  children,
}: SkeletonProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'text':
        return 'rounded h-4 my-1';
      case 'rectangular':
        return 'rounded-none';
      case 'rounded':
      default:
        return 'rounded-lg';
    }
  };

  const inlineStyles: CSSProperties = {
    ...style,
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
  };

  return (
    <div
      className={`skeleton-shimmer relative overflow-hidden bg-slate-200/70 dark:bg-slate-800/80 ${getVariantStyles()} ${className}`}
      style={inlineStyles}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}
