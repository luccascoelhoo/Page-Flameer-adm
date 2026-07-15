import React from 'react';
import { cn } from '@/lib/utils';

export const PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '180d', days: 180 },
] as const;

interface PeriodSelectorProps {
  value: number;
  onChange: (days: number) => void;
}

export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-secondary/40 p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.days}
          onClick={() => onChange(p.days)}
          className={cn(
            'px-3 py-1 text-xs font-semibold rounded-md transition-all duration-150',
            value === p.days
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
