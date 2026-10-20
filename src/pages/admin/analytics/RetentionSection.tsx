import React from 'react';
import { Loader2, Download, TrendingDown } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import ChartCard from '@/components/admin/analytics/ChartCard';
import RetentionHeatmap from '@/components/admin/analytics/RetentionHeatmap';
import { Button } from '@/components/ui/button';
import { useRetentionCohorts, useChallengeFunnel } from '@/hooks/admin/useIntelligence';
import { CHART_COLORS, tooltipStyle, axisStyle, heatColor } from '@/lib/admin/charts';
import { downloadCsv } from '@/lib/admin/export';
import type { FunnelChallenge } from '@/lib/admin/analytics';

export default function RetentionSection() {
  const { data: cohorts, isLoading: loadingCohorts } = useRetentionCohorts(8);
  const { data: funnel, isLoading: loadingFunnel } = useChallengeFunnel();

  const exportFunnel = () => {
    if (!funnel) return;
    // O hook devolve o funil como `unknown` (passa por tryRpc genérico); o
    // tipo real é FunnelChallenge — nomeá-lo dá tipo aos acessores do CSV.
    downloadCsv('funil-desafios', funnel as FunnelChallenge[], [
      { header: 'Desafio', accessor: (r) => r.title },
      { header: 'Inscritos', accessor: (r) => r.enrolled },
      { header: 'Ativos', accessor: (r) => r.active },
      { header: 'Concluídos', accessor: (r) => r.completed },
      { header: 'Taxa de conclusão %', accessor: (r) => r.completionRate },
      { header: 'Dia médio de abandono', accessor: (r) => r.avgDropoffDay ?? '' },
    ]);
  };

  return (
    <div className="space-y-6">
      <ChartCard
        title="Retenção por coorte semanal"
        subtitle="% de cada coorte de cadastro que permaneceu ativa nas semanas seguintes"
        className="min-h-[300px]"
      >
        {loadingCohorts ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <RetentionHeatmap cohorts={cohorts ?? []} weeks={8} />
        )}
      </ChartCard>

      <ChartCard
        title="Funil de conclusão de desafios"
        subtitle="Inscrição → engajamento → conclusão, por desafio"
        action={
          <Button variant="outline" size="sm" onClick={exportFunnel} className="gap-1.5 h-8 text-xs">
            <Download className="w-3.5 h-3.5" />
            CSV
          </Button>
        }
        className="min-h-[340px]"
      >
        {loadingFunnel ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (funnel ?? []).length === 0 ? (
          <div className="text-xs text-muted-foreground italic text-center py-12">
            Nenhuma inscrição em desafios ainda.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(funnel ?? []).slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.12} />
                  <XAxis type="number" {...axisStyle} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="title"
                    {...axisStyle}
                    width={120}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + '…' : v)}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                  <Bar dataKey="enrolled" name="Inscritos" fill={CHART_COLORS.slate} radius={[0, 4, 4, 0]} barSize={9} />
                  <Bar dataKey="active" name="Ativos" fill={CHART_COLORS.tan} radius={[0, 4, 4, 0]} barSize={9} />
                  <Bar dataKey="completed" name="Concluídos" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} barSize={9} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left font-semibold py-2">Desafio</th>
                    <th className="text-right font-semibold py-2 px-2">Inscritos</th>
                    <th className="text-right font-semibold py-2 px-2">Conclusão</th>
                    <th className="text-right font-semibold py-2 px-2">Abandono</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(funnel ?? []).slice(0, 8).map((f) => (
                    <tr key={f.id}>
                      <td className="py-2 font-medium text-foreground truncate max-w-[200px]">{f.title}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{f.enrolled}</td>
                      <td className="py-2 px-2 text-right">
                        <span
                          className="inline-block px-1.5 py-0.5 rounded font-bold tabular-nums"
                          style={{
                            background: heatColor(f.completionRate / 100),
                            color: f.completionRate > 50 ? '#fff' : 'hsl(var(--foreground))',
                          }}
                        >
                          {f.completionRate}%
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {f.avgDropoffDay != null ? (
                          <span className="inline-flex items-center gap-1">
                            <TrendingDown className="w-3 h-3 text-destructive" />
                            dia {f.avgDropoffDay}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
