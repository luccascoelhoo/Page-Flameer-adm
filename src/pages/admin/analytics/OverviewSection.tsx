import React from 'react';
import {
  Users,
  Activity,
  Flame,
  Repeat,
  Dumbbell,
  Apple,
  CheckSquare,
  Loader2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import StatTile from '@/components/admin/analytics/StatTile';
import ChartCard from '@/components/admin/analytics/ChartCard';
import { useActivityAnalytics } from '@/hooks/admin/useIntelligence';
import { CHART_COLORS, tooltipStyle, axisStyle } from '@/lib/admin/charts';

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function OverviewSection({ periodDays }: { periodDays: number }) {
  const { data, isLoading } = useActivityAnalytics(periodDays);
  const eng = data?.engagement;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          title="Usuários ativos (24h)"
          value={eng?.dau ?? 0}
          icon={Activity}
          loading={isLoading}
          accent="text-blue-500 bg-blue-500/10"
          hint="DAU — distintos com atividade hoje"
        />
        <StatTile
          title="Ativos na semana"
          value={eng?.wau ?? 0}
          icon={Users}
          loading={isLoading}
          accent="text-teal-500 bg-teal-500/10"
          hint="WAU — últimos 7 dias"
        />
        <StatTile
          title="Ativos no mês"
          value={eng?.mau ?? 0}
          icon={Users}
          loading={isLoading}
          accent="text-indigo-500 bg-indigo-500/10"
          hint="MAU — últimos 30 dias"
        />
        <StatTile
          title="Stickiness"
          value={`${eng?.stickiness ?? 0}%`}
          icon={Repeat}
          loading={isLoading}
          accent="text-primary bg-primary/10"
          hint="DAU / MAU — quão viciante é o app"
        />
      </div>

      <ChartCard
        title="Tendência de atividade"
        subtitle={`Treinos, dietas e hábitos concluídos por dia — últimos ${periodDays} dias`}
        className="min-h-[340px]"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.timeseries ?? []} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="gW" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.teal} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS.teal} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gH" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.gold} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS.gold} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  {...axisStyle}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis {...axisStyle} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(l) => fmtDate(String(l))}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="workouts"
                  name="Treinos"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  fill="url(#gW)"
                />
                <Area
                  type="monotone"
                  dataKey="diets"
                  name="Dietas"
                  stroke={CHART_COLORS.teal}
                  strokeWidth={2}
                  fill="url(#gD)"
                />
                <Area
                  type="monotone"
                  dataKey="habits"
                  name="Hábitos"
                  stroke={CHART_COLORS.gold}
                  strokeWidth={2}
                  fill="url(#gH)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          title="Treinos registrados"
          value={data?.totals.workouts ?? 0}
          icon={Dumbbell}
          loading={isLoading}
          accent="text-primary bg-primary/10"
        />
        <StatTile
          title="Refeições registradas"
          value={data?.totals.diets ?? 0}
          icon={Apple}
          loading={isLoading}
          accent="text-teal-500 bg-teal-500/10"
        />
        <StatTile
          title="Taxa de hábitos concluídos"
          value={`${data?.totals.habitCompletion ?? 0}%`}
          icon={CheckSquare}
          loading={isLoading}
          accent="text-amber-500 bg-amber-500/10"
        />
      </div>
    </div>
  );
}
