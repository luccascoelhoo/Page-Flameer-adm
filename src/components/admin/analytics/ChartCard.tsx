import React from 'react';
import { cn } from '@/lib/utils';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export default function ChartCard({ title, subtitle, action, className, children }: ChartCardProps) {
  return (
    <div className={cn('bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col', className)}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-bold text-sm text-foreground uppercase tracking-wider">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
