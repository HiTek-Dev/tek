interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-surface-elevated rounded h-4 ${className}`}
      style={{ width, height }}
    />
  );
}
