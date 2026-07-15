import React from 'react';
import {
  ArrowLeft,
  ClipboardCheck,
  HeartPulse,
  Loader2,
  Moon,
  ShieldOff,
  Watch,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import ChartCard from '@/components/admin/analytics/ChartCard';
import { useUserHealthSnapshot } from '@/hooks/admin/useHealth';
import { computeReadiness, bandColor, BAND_LABEL, type DailyPoint } from '@/lib/admin/readiness';
import { CHART_COLORS, tooltipStyle, axisStyle } from '@/lib/admin/charts';

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function VitalSpark({
  title,
  unit,
  data,
  dataKey,
  color,
}: {
  title: string;
  unit: string;
  data: any[];
  dataKey: string;
  color: string;
}) {
  const points = data.filter((d) => d[dataKey] != null);
  const latest = points[points.length - 1]?.[dataKey];
  const vals = points.map((p) => Number(p[dataKey]));
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

  return (
    <div className="bg-secondary/30 border border-border rounded-lg p-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
        <span className="text-xs font-bold text-foreground tabular-nums">
          {latest != null ? `${Number(latest).toFixed(1).replace('.', ',')} ${unit}` : '—'}
        </span>
      </div>
      <div className="h-10">
        {points.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
              {mean != null && <ReferenceLine y={mean} stroke={color} strokeOpacity={0.25} strokeDasharray="2 2" />}
              <YAxis domain={['auto', 'auto']} hide />
              <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center text-[10px] text-muted-foreground italic">sem série</div>
        )}
      </div>
    </div>
  );
}

export default function MemberSection({ userId, onBack }: { userId: string; onBack: () => void }) {
  const { data, isLoading, error } = useUserHealthSnapshot(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-xl">
        <ShieldOff className="w-9 h-9 text-muted-foreground mb-3" />
        <h3 className="font-semibold text-foreground">Sem acesso aos dados deste membro</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {(error as any)?.message?.includes('consent')
            ? 'Este membro não autorizou compartilhar dados de saúde com a equipe.'
            : 'Não foi possível carregar os dados.'}
        </p>
        <Button variant="outline" size="sm" onClick={onBack} className="mt-4 gap-1.5 text-xs">
          <ArrowLeft className="w-3.5 h-3.5" />Voltar ao roster
        </Button>
      </div>
    );
  }

  const series: any[] = data?.series ?? [];
  const user = data?.user;

  // Engine is the source of truth — recompute from the series.
  const points: DailyPoint[] = series.map((r) => ({
    day: r.day,
    hrv: r.hrv != null ? Number(r.hrv) : null,
    hrvMethod: r.hrv_method ?? null,
    restingHr: r.resting_hr != null ? Number(r.resting_hr) : null,
    sleepTotalMin: r.sleep_total_min,
    timeInBedMin: r.time_in_bed_min,
    sleepDeepMin: r.sleep_deep_min,
    sleepRemMin: r.sleep_rem_min,
    srpeLoad: r.srpe_load != null ? Number(r.srpe_load) : null,
  }));
  const readiness = computeReadiness(points);

  const readinessSeries = series
    .filter((r) => r.readiness_score != null)
    .map((r) => ({ day: r.day, score: Number(r.readiness_score) }));

  const subBars = [
    { name: 'HRV', value: readiness.sub.hrv, w: readiness.usedWeights.hrv },
    { name: 'FC repouso', value: readiness.sub.rhr, w: readiness.usedWeights.rhr },
    { name: 'Sono', value: readiness.sub.sleep, w: readiness.usedWeights.sleep },
    { name: 'Carga', value: readiness.sub.load, w: readiness.usedWeights.load },
  ].filter((b) => b.value != null);

  const sleep = data?.lastSleep;
  const adherence = data?.adherence;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Avatar className="h-10 w-10 border border-border">
          {user?.avatar_url ? <AvatarImage src={user.avatar_url} alt={user?.name} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
            {(user?.name ?? '??').substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-foreground truncate">{user?.name}</h2>
          <p className="text-[11px] text-muted-foreground">
            {data?.lastSync ? `Última sincronização: ${new Date(data.lastSync).toLocaleString('pt-BR')}` : 'Sem sincronização registrada'}
          </p>
        </div>
        {readiness.score != null && readiness.band && (
          <div
            className="px-3 py-1.5 rounded-lg text-white text-sm font-bold tabular-nums shrink-0"
            style={{ background: bandColor(readiness.band) }}
          >
            {String(readiness.score).replace('.', ',')} · {BAND_LABEL[readiness.band]}
          </div>
        )}
      </div>

      {/* Narrative */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <p className="text-sm text-foreground">{readiness.narrative}</p>
        {readiness.flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {readiness.flags.map((f) => (
              <span key={f} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {series.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-xl">
          <Watch className="w-9 h-9 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Sem dados sincronizados para este membro.</p>
        </div>
      ) : (
        <>
          {/* Vitals baseline sparklines */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <VitalSpark title="FC repouso" unit="bpm" data={series} dataKey="resting_hr" color={CHART_COLORS.rose} />
            <VitalSpark title="HRV" unit="ms" data={series} dataKey="hrv" color={CHART_COLORS.primary} />
            <VitalSpark title="Freq. respiratória" unit="rpm" data={series} dataKey="respiratory_rate" color={CHART_COLORS.teal} />
            <VitalSpark title="SpO₂" unit="" data={series} dataKey="spo2" color={CHART_COLORS.indigo} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Readiness trend */}
            <ChartCard title="Prontidão (60 dias)" subtitle="Pontuação diária 0–100" className="min-h-[300px]">
              {readinessSeries.length < 2 ? (
                <div className="flex items-center justify-center h-52 text-xs text-muted-foreground italic">
                  Série insuficiente — pontuações aparecem conforme os dias sincronizam.
                </div>
              ) : (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={readinessSeries} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gRdy" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                      <XAxis dataKey="day" tickFormatter={fmtDate} {...axisStyle} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis domain={[0, 100]} {...axisStyle} tickLine={false} axisLine={false} width={30} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => fmtDate(String(l))} />
                      <ReferenceLine y={67} stroke={bandColor('green')} strokeOpacity={0.4} strokeDasharray="3 3" />
                      <ReferenceLine y={34} stroke={bandColor('red')} strokeOpacity={0.4} strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="score" name="Prontidão" stroke={CHART_COLORS.primary} strokeWidth={2} fill="url(#gRdy)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>

            {/* Sub-score breakdown */}
            <ChartCard
              title="Componentes de hoje"
              subtitle={`Pesos usados: HRV ${Math.round(readiness.usedWeights.hrv * 100)}% · FC ${Math.round(readiness.usedWeights.rhr * 100)}% · Sono ${Math.round(readiness.usedWeights.sleep * 100)}% · Carga ${Math.round(readiness.usedWeights.load * 100)}%`}
              className="min-h-[300px]"
            >
              {subBars.length === 0 ? (
                <div className="flex items-center justify-center h-52 text-xs text-muted-foreground italic">Sem componentes calculáveis hoje.</div>
              ) : (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subBars} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.12} />
                      <XAxis type="number" domain={[0, 100]} {...axisStyle} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" {...axisStyle} width={80} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${Number(v).toFixed(0)} / 100`, 'sub-score']} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                        {subBars.map((b) => (
                          <Cell key={b.name} fill={bandColor(b.value! >= 67 ? 'green' : b.value! >= 34 ? 'amber' : 'red')} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Last night sleep */}
            <ChartCard title="Última noite" subtitle="Composição do sono por estágio" className="min-h-[240px]">
              {!sleep ? (
                <div className="flex items-center justify-center h-40 text-xs text-muted-foreground italic">
                  <Moon className="w-4 h-4 mr-2" />Sem sessão de sono registrada.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex h-4 w-full rounded-full overflow-hidden">
                    {[
                      { label: 'Profundo', min: sleep.deep_min, color: CHART_COLORS.indigo },
                      { label: 'REM', min: sleep.rem_min, color: CHART_COLORS.gold },
                      { label: 'Leve', min: sleep.core_min, color: CHART_COLORS.slate },
                      { label: 'Acordado', min: sleep.awake_min, color: CHART_COLORS.rose },
                    ]
                      .filter((s) => s.min != null && s.min > 0)
                      .map((s) => {
                        const total = (sleep.deep_min ?? 0) + (sleep.rem_min ?? 0) + (sleep.core_min ?? 0) + (sleep.awake_min ?? 0) || 1;
                        return (
                          <div key={s.label} style={{ width: `${(s.min / total) * 100}%`, background: s.color }} title={`${s.label}: ${s.min} min`} />
                        );
                      })}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {[
                      { label: 'Profundo', min: sleep.deep_min, color: CHART_COLORS.indigo },
                      { label: 'REM', min: sleep.rem_min, color: CHART_COLORS.gold },
                      { label: 'Leve', min: sleep.core_min, color: CHART_COLORS.slate },
                      { label: 'Acordado', min: sleep.awake_min, color: CHART_COLORS.rose },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="font-semibold text-foreground ml-auto tabular-nums">
                          {s.min != null ? `${Math.floor(s.min / 60)}h${String(s.min % 60).padStart(2, '0')}` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ChartCard>

            {/* Adherence: prescribed vs watch-recorded */}
            <ChartCard title="Prescrito × Realizado (30 dias)" subtitle="Treinos do plano concluídos vs registrados pelo relógio" className="min-h-[240px]">
              {!adherence ? (
                <div className="flex items-center justify-center h-40 text-xs text-muted-foreground italic">Sem dados.</div>
              ) : (
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="bg-secondary/30 border border-border rounded-lg p-3 text-center">
                    <ClipboardCheck className="w-4 h-4 text-primary mx-auto mb-1.5" />
                    <div className="text-xl font-bold text-foreground tabular-nums">{adherence.prescribedDone30d ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">prescritos concluídos</div>
                  </div>
                  <div className="bg-secondary/30 border border-border rounded-lg p-3 text-center">
                    <Watch className="w-4 h-4 text-teal-600 mx-auto mb-1.5" />
                    <div className="text-xl font-bold text-foreground tabular-nums">{adherence.watchRecorded30d ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">registrados no relógio</div>
                  </div>
                  <div className="bg-secondary/30 border border-border rounded-lg p-3 text-center">
                    <HeartPulse className="w-4 h-4 text-destructive mx-auto mb-1.5" />
                    <div className="text-xl font-bold text-foreground tabular-nums">{adherence.watchMinutes30d ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">min ativos (relógio)</div>
                  </div>
                </div>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
