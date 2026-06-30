import { cn } from "@/lib/utils";

interface SkeletonBentoProps {
  className?: string;
  lines?: number;
}

const SkeletonBento = ({ className, lines = 3 }: SkeletonBentoProps) => {
  return (
    <div className={cn("bento-card space-y-3", className)}>
      <div className="skeleton-shimmer h-4 w-1/3 rounded-xl" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer rounded-xl"
          style={{ height: 12, width: `${70 + Math.random() * 30}%` }}
        />
      ))}
    </div>
  );
};

export default SkeletonBento;
