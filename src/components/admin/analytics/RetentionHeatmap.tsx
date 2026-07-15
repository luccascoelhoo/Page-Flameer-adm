import React from 'react';
import { heatColor } from '@/lib/admin/charts';
import type { RetentionCohort } from '@/lib/admin/analytics';

interface RetentionHeatmapProps {
  cohorts: RetentionCohort[];
  weeks?: number;
}

/**
 * Classic retention triangle: rows = signup cohorts, columns = weeks-since-signup,
 * cell intensity = % retained. Week 0 is always 100% by definition.
 */
export default function RetentionHeatmap({ cohorts, weeks = 8 }: RetentionHeatmapProps) {
  if (cohorts.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic text-center py-12">
        Ainda não há coortes suficientes para calcular retenção.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-[11px]">
        <thead>
          <tr>
            <th className="text-left font-semibold text-muted-foreground px-2 py-1 sticky left-0 bg-card">
              Coorte
            </th>
            <th className="text-center font-semibold text-muted-foreground px-2 py-1">Usuários</th>
            {Array.from({ length: weeks }).map((_, w) => (
              <th key={w} className="text-center font-semibold text-muted-foreground px-1 py-1 min-w-[42px]">
                S{w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.cohort}>
              <td className="font-semibold text-foreground px-2 py-1 whitespace-nowrap sticky left-0 bg-card">
                {c.cohort}
              </td>
              <td className="text-center text-muted-foreground tabular-nums px-2">{c.size}</td>
              {c.retention.slice(0, weeks).map((r, w) => {
                const intensity = r / 100;
                const dark = intensity > 0.5;
                return (
                  <td
                    key={w}
                    className="text-center rounded-md tabular-nums font-medium"
                    style={{
                      background: heatColor(intensity),
                      color: dark ? '#fff' : 'hsl(var(--foreground))',
                    }}
                    title={`${c.cohort} · semana ${w}: ${r}% retidos`}
                  >
                    {r > 0 ? `${r}%` : '·'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
