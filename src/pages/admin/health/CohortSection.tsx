import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { HeartPulse, Loader2, Moon, Footprints, Gauge } from 'lucide-react';
import { tryRpc } from '@/lib/admin/rpc';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import StatTile from '@/components/admin/analytics/StatTile';
import ChartCard from '@/components/admin/analytics/ChartCard';
import { useHealthTrend, useHealthCohortAverages } from '@/hooks/admin/useHealth';
import { CHART_COLORS, tooltipStyle, axisStyle } from '@/lib/admin/charts';
import { bandColor } from '@/lib/admin/readiness';

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function EmptyChart({ label = 'Sem dados no período' }: { label?: string }) {
  return <div className="flex items-center justify-center h-64 text-xs text-muted-foreground italic">{label}</div>;
}

export default function CohortSection({ periodDays }: { periodDays: number }) {
  const { data: trend, isLoading: loadingTrend } = useHealthTrend(periodDays);
  const { data: averages, isLoading: loadingAvg } = useHealthCohortAverages(periodDays);

  const series = trend?.timeseries ?? [];
  const hasSeries = series.some(
    (p: any) => p.avgReadiness != null || p.avgRestingHr != null || p.avgHrv != null || p.avgSleepMin != null
  );
  const m = averages?.metrics ?? {};
  const fmtAvg = (metric: any, suffix = '', divisor = 1, digits = 1) =>
    metric?.avg != null ? `${(metric.avg / divisor).toFixed(digits).replace('.', ',')}${suffix}` : '—';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          title="FC repouso média"
          value={fmtAvg(m.resting_hr, ' bpm')}
          icon={HeartPulse}
          loading={loadingAvg}
          accent="text-destructive bg-destructive/10"
          hint={m.resting_hr?.n != null ? `${m.resting_hr.n} membros` : undefined}
        />
        <StatTile
          title="HRV média"
          value={fmtAvg(m.hrv, ' ms')}
          icon={Gauge}
          loading={loadingAvg}
          accent="text-primary bg-primary/10"
          hint="SDNN (Apple Watch)"
        />
        <StatTile
          title="Sono médio"
          value={m.sleep_total_min?.avg != null ? `${Math.floor(m.sleep_total_min.avg / 60)}h${String(Math.round(m.sleep_total_min.avg % 60)).padStart(2, '0')}` : '—'}
          icon={Moon}
          loading={loadingAvg}
          accent="text-blue-500 bg-blue-500/10"
        />
        <StatTile
          title="Passos médios / dia"
          value={m.steps?.avg != null ? Math.round(m.steps.avg).toLocaleString('pt-BR') : '—'}
          icon={Footprints}
          loading={loadingAvg}
          accent="text-success bg-success/10"
        />
      </div>

      {(m.resting_hr?.n != null && m.resting_hr.n > 0 && m.resting_hr.avg == null) && (
        <p className="text-[11px] text-muted-foreground bg-secondary/40 border border-border rounded-lg px-3 py-2">
          Médias ocultas: menos de 5 membros reportando — proteção de anonimato em coortes pequenas.
        </p>
      )}

      <ChartCard
        title="Tendência da coorte"
        subtitle={`Prontidão, FC de repouso e HRV médias por dia — últimos ${periodDays} dias (agregado anônimo)`}
        className="min-h-[340px]"
      >
        {loadingTrend ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasSeries ? (
          <EmptyChart />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                <XAxis dataKey="date" tickFormatter={fmtDate} {...axisStyle} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis {...axisStyle} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => fmtDate(String(l))} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="avgReadiness" name="Prontidão" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="avgRestingHr" name="FC repouso (bpm)" stroke={CHART_COLORS.rose} strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="avgHrv" name="HRV (ms)" stroke={CHART_COLORS.teal} strokeWidth={1.5} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Sono da coorte" subtitle="Duração média de sono por noite (minutos)" className="min-h-[300px]">
          {loadingTrend ? (
            <div className="flex items-center justify-center h-56"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !series.some((p: any) => p.avgSleepMin != null) ? (
            <EmptyChart />
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gSleep" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.indigo} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART_COLORS.indigo} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                  <XAxis dataKey="date" tickFormatter={fmtDate} {...axisStyle} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis {...axisStyle} tickLine={false} axisLine={false} width={36} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => fmtDate(String(l))} />
                  <Area type="monotone" dataKey="avgSleepMin" name="Sono (min)" stroke={CHART_COLORS.indigo} strokeWidth={2} fill="url(#gSleep)" connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Atividade da coorte" subtitle="Energia ativa média (kcal) por dia" className="min-h-[300px]">
          {loadingTrend ? (
            <div className="flex items-center justify-center h-56"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !series.some((p: any) => p.avgActiveKcal != null) ? (
            <EmptyChart />
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gKcal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.gold} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART_COLORS.gold} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                  <XAxis dataKey="date" tickFormatter={fmtDate} {...axisStyle} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis {...axisStyle} tickLine={false} axisLine={false} width={36} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => fmtDate(String(l))} />
                  <Area type="monotone" dataKey="avgActiveKcal" name="Energia (kcal)" stroke={CHART_COLORS.gold} strokeWidth={2} fill="url(#gKcal)" connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <ReadinessHistogram />
    </div>
  );
}

function ReadinessHistogram() {
  const { data, isLoading } = useHealthTrendDistribution();
  return (
    <ChartCard
      title="Distribuição de prontidão (hoje)"
      subtitle="Histograma de pontuações — a média esconde os extremos; a distribuição não"
      className="min-h-[300px]"
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-56"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : !data || data.suppressed || !data.histogram?.length ? (
        <EmptyChart label={data?.suppressed ? 'Ocultado: menos de 5 membros reportando (anonimato).' : 'Sem pontuações hoje.'} />
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.histogram} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
              <XAxis dataKey="bin" tickFormatter={(b: number) => `${b}–${b + 10}`} {...axisStyle} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} {...axisStyle} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, 'membros']} labelFormatter={(b) => `Faixa ${b}–${Number(b) + 10}`} />
              <Bar dataKey="n" radius={[4, 4, 0, 0]}>
                {data.histogram.map((h: any) => (
                  <Cell
                    key={h.bin}
                    fill={bandColor(h.bin >= 67 ? 'green' : h.bin >= 34 ? 'amber' : 'red')}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

function useHealthTrendDistribution() {
  return useQuery({
    queryKey: ['admin', 'health', 'distribution'],
    staleTime: 120_000,
    queryFn: async () => {
      const rpc = await tryRpc('admin_health_readiness_distribution');
      if (!rpc.missing && rpc.data) return rpc.data as any;
      return null; // fallback intentionally omitted: suppression rules live server-side
    },
  });
}
