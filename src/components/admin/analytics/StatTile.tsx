import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatTileProps {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  loading?: boolean;
  /** Signed change in percentage points/percent for the trend chip. */
  delta?: number | null;
  hint?: string;
  accent?: string; // tailwind text/bg classes for the icon chip
}

export default function StatTile({
  title,
  value,
  icon: Icon,
  loading,
  delta,
  hint,
  accent = 'text-primary bg-primary/10',
}: StatTileProps) {
  const TrendIcon = delta == null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const trendClass =
    delta == null || delta === 0
      ? 'text-muted-foreground bg-muted'
      : delta > 0
      ? 'text-success bg-success/10'
      : 'text-destructive bg-destructive/10';

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        <div className={cn('p-2 rounded-lg', accent)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        {loading ? (
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        ) : (
          <span className="text-2xl font-bold text-foreground tracking-tight tabular-nums">
            {value}
          </span>
        )}
        {delta != null && !loading && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded',
              trendClass
            )}
          >
            <TrendIcon className="w-3 h-3" />
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground mt-1.5">{hint}</p>}
    </div>
  );
}
