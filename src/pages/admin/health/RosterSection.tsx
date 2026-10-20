import React from 'react';
import {
  Activity,
  BedDouble,
  Eye,
  HeartPulse,
  Loader2,
  ShieldCheck,
  Sunrise,
  Watch,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import StatTile from '@/components/admin/analytics/StatTile';
import { useHealthRoster, useHealthSparklines } from '@/hooks/admin/useHealth';
import { buildBriefing, type RosterRow } from '@/lib/admin/healthBriefing';
import { bandColor, BAND_LABEL } from '@/lib/admin/readiness';
import { cn } from '@/lib/utils';

function Sparkline({ points }: { points: { day: string; score: number | null }[] }) {
  const data = points.filter((p) => p.score != null);
  if (data.length < 2) return <div className="w-24 h-8" />;
  return (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <YAxis domain={[0, 100]} hide />
          <Line type="monotone" dataKey="score" stroke="hsl(346 57% 32%)" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function RosterSection({ onSelectMember }: { onSelectMember: (id: string) => void }) {
  const { data, isLoading } = useHealthRoster();
  const { data: sparklines } = useHealthSparklines();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rows: RosterRow[] = data?.rows ?? [];

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-md">
        <Watch className="w-10 h-10 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg text-foreground">Nenhum dado de wearable ainda</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Os dados aparecem aqui quando membros conectarem o Apple Health no app e consentirem o
          compartilhamento com a equipe. Nada é exibido sem consentimento explícito.
        </p>
      </div>
    );
  }

  const briefing = buildBriefing(rows);
  const scored = rows.filter((r) => r.readiness.score != null);
  const green = scored.filter((r) => r.readiness.band === 'green').length;
  const amber = scored.filter((r) => r.readiness.band === 'amber').length;
  const red = scored.filter((r) => r.readiness.band === 'red').length;
  const avg =
    scored.length > 0
      ? Math.round((scored.reduce((a, r) => a + (r.readiness.score as number), 0) / scored.length) * 10) / 10
      : null;

  return (
    <div className="space-y-6">
      {/* Morning briefing */}
      <div className="bg-card border border-border rounded-md p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sunrise className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm text-foreground">Briefing do dia</h3>
        </div>
        <p className="text-sm font-semibold text-foreground">{briefing.headline}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {briefing.cohortLine}
          {briefing.collecting > 0 && ` · ${briefing.collecting} membro(s) ainda coletando linha de base.`}
        </p>
        {briefing.atRisk.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {briefing.atRisk.map((item) => (
              <button
                key={item.userId}
                onClick={() => onSelectMember(item.userId)}
                className="w-full flex items-start gap-2.5 text-left p-2 rounded-lg hover:bg-secondary/60 transition-colors"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                  style={{ background: bandColor(item.band) }}
                />
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-foreground">
                    {item.name}
                    <span className="text-muted-foreground font-normal ml-1.5 tabular-nums">
                      {String(item.score).replace('.', ',')}
                    </span>
                  </span>
                  <p className="text-[11px] text-muted-foreground truncate">{item.drivers}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          title="Prontidão média"
          value={avg != null ? String(avg).replace('.', ',') : '—'}
          icon={HeartPulse}
          accent="text-primary bg-primary/10"
          hint={`${scored.length} membros com pontuação`}
        />
        <StatTile title="Prontos" value={green} icon={ShieldCheck} accent="text-success bg-success/10" hint="banda verde" />
        <StatTile title="Monitorar" value={amber} icon={Eye} accent="text-amber-500 bg-amber-500/10" hint="banda âmbar" />
        <StatTile title="Descanso" value={red} icon={BedDouble} accent="text-destructive bg-destructive/10" hint="banda vermelha" />
      </div>

      {/* Traffic-light roster */}
      <div className="bg-card border border-border rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm text-foreground">Prontidão por membro</h3>
          <span className="text-[11px] text-muted-foreground ml-auto">
            piores primeiro · clique para detalhar
          </span>
        </div>
        <div className="divide-y divide-border">
          {rows.map((r) => {
            const spark = sparklines?.get(r.userId) ?? [];
            const hasScore = r.readiness.score != null;
            return (
              <button
                key={r.userId}
                onClick={() => onSelectMember(r.userId)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-secondary/40 transition-colors"
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: bandColor(r.readiness.band) }}
                  title={r.readiness.band ? BAND_LABEL[r.readiness.band] : 'sem pontuação'}
                />
                <Avatar className="h-8 w-8 border border-border shrink-0">
                  {r.avatarUrl ? <AvatarImage src={r.avatarUrl} alt={r.name} /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-[10px]">
                    {r.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-foreground block truncate">{r.name}</span>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    {r.readiness.narrative}
                  </span>
                </div>
                <Sparkline points={spark} />
                <span
                  className={cn(
                    'text-sm font-bold tabular-nums w-12 text-right shrink-0',
                    !hasScore && 'text-muted-foreground text-xs font-medium'
                  )}
                >
                  {hasScore ? String(r.readiness.score).replace('.', ',') : '…'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
