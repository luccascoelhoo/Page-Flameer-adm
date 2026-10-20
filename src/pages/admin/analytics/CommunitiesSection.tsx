import React from 'react';
import {
  Loader2,
  Users,
  Download,
  Sparkles,
  Filter,
  ChevronRight,
  Target,
} from 'lucide-react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import ChartCard from '@/components/admin/analytics/ChartCard';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useUserAggregates } from '@/hooks/admin/useIntelligence';
import { normalize, kmeans, suggestK, type Cluster } from '@/lib/admin/clustering';
import { describeCluster, type UserAggregate } from '@/lib/admin/analytics';
import { ratio } from '@/lib/admin/stats';
import { CATEGORICAL, tooltipStyle, axisStyle } from '@/lib/admin/charts';
import { downloadCsv } from '@/lib/admin/export';
import { cn } from '@/lib/utils';

const userCsvCols = [
  { header: 'Nome', accessor: (u: UserAggregate) => u.name },
  { header: 'ID', accessor: (u: UserAggregate) => u.user_id },
  { header: 'Nível', accessor: (u: UserAggregate) => u.level },
  { header: 'Pontos', accessor: (u: UserAggregate) => u.pontos },
  { header: 'Ofensiva', accessor: (u: UserAggregate) => u.streak },
  { header: 'Treinos', accessor: (u: UserAggregate) => u.workouts },
  { header: 'Dietas', accessor: (u: UserAggregate) => u.diets },
  {
    header: 'Aderência %',
    accessor: (u: UserAggregate) => Math.round(ratio(u.habitsDone, u.habitsTotal) * 100),
  },
  { header: 'Dias inativo', accessor: (u: UserAggregate) => u.daysSinceActive },
  { header: 'Categoria', accessor: (u: UserAggregate) => u.topCategory },
];

// ─────────────────────────────────────────────────── clustering panel ──

function ClusteringPanel({ aggregates, vectors }: { aggregates: UserAggregate[]; vectors: any[] }) {
  const auto = React.useMemo(() => (vectors.length ? suggestK(vectors, 5) : 2), [vectors]);
  const [k, setK] = React.useState(auto);
  React.useEffect(() => setK(auto), [auto]);

  const clusters: Cluster<UserAggregate>[] = React.useMemo(() => {
    if (vectors.length === 0) return [];
    const { normalized } = normalize(vectors);
    // kmeans devolve Cluster<unknown>[]; os vetores correspondem 1:1 aos
    // aggregates por posição — o cast só nomeia o que já é verdade.
    return (kmeans(normalized, k) as Cluster<UserAggregate>[]).sort((a, b) => b.size - a.size);
  }, [vectors, k]);

  // Assign a colour per cluster and build scatter series (pontos vs aderência)
  const scatterSeries = clusters.map((c, i) => ({
    id: i,
    color: CATEGORICAL[i % CATEGORICAL.length],
    label: describeCluster(c.members).label,
    points: c.members.map((m) => ({
      x: Math.round(ratio(m.habitsDone, m.habitsTotal) * 100),
      y: m.pontos,
      z: m.streak + 2,
      name: m.name,
    })),
  }));

  if (aggregates.length < 4) {
    return (
      <div className="text-xs text-muted-foreground italic text-center py-12">
        São necessários ao menos 4 usuários com atividade para descobrir comunidades.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-secondary/30 border border-border rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            {clusters.length} comunidades detectadas entre {aggregates.length} usuários
          </span>
        </div>
        <div className="flex items-center gap-3 min-w-[220px]">
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">Grupos: {k}</span>
          <Slider
            value={[k]}
            min={2}
            max={6}
            step={1}
            onValueChange={(v) => setK(v[0])}
            className="w-32"
          />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">sugerido: {auto}</span>
        </div>
      </div>

      <ChartCard
        title="Mapa comportamental"
        subtitle="Cada ponto é um usuário — aderência (x) × pontos (y), tamanho = ofensiva. Cores = comunidades."
        className="min-h-[360px]"
      >
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
              <XAxis
                type="number"
                dataKey="x"
                name="Aderência"
                unit="%"
                domain={[0, 100]}
                {...axisStyle}
                tickLine={false}
                axisLine={false}
              />
              <YAxis type="number" dataKey="y" name="Pontos" {...axisStyle} tickLine={false} axisLine={false} width={44} />
              <ZAxis type="number" dataKey="z" range={[30, 260]} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value: any, name: any) => [value, name]}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              {scatterSeries.map((s) => (
                <Scatter key={s.id} name={s.label} data={s.points} fill={s.color} fillOpacity={0.72} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid gap-4 md:grid-cols-2">
        {clusters.map((c, i) => {
          const desc = describeCluster(c.members);
          const color = CATEGORICAL[i % CATEGORICAL.length];
          const preview = [...c.members].sort((a, b) => b.pontos - a.pontos).slice(0, 4);
          return (
            <div key={i} className="bg-card border border-border rounded-md p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{desc.label}</h4>
                    <p className="text-[11px] text-muted-foreground">
                      {c.size} usuários ({Math.round((c.size / aggregates.length) * 100)}% da base)
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() =>
                    downloadCsv(`comunidade-${desc.label.toLowerCase().replace(/\s+/g, '-')}`, c.members, userCsvCols)
                  }
                >
                  <Download className="w-3 h-3" />
                  CSV
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {desc.traits.map((t, ti) => (
                  <span
                    key={ti}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border">
                {preview.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-foreground truncate max-w-[160px]">{m.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      Nv {m.level} · {m.pontos} pts · {m.streak}🔥
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────── segment builder ──

interface Rule {
  minAdherence: number;
  minStreak: number;
  minWorkouts: number;
  maxDaysInactive: number;
  category: string;
}

const DEFAULT_RULE: Rule = {
  minAdherence: 0,
  minStreak: 0,
  minWorkouts: 0,
  maxDaysInactive: 999,
  category: 'all',
};

function SegmentBuilder({ aggregates }: { aggregates: UserAggregate[] }) {
  const [rule, setRule] = React.useState<Rule>(DEFAULT_RULE);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    aggregates.forEach((a) => a.topCategory && a.topCategory !== '—' && set.add(a.topCategory));
    return ['all', ...Array.from(set)];
  }, [aggregates]);

  const matched = React.useMemo(
    () =>
      aggregates.filter((a) => {
        const adherence = ratio(a.habitsDone, a.habitsTotal) * 100;
        if (adherence < rule.minAdherence) return false;
        if (a.streak < rule.minStreak) return false;
        if (a.workouts < rule.minWorkouts) return false;
        if (a.daysSinceActive > rule.maxDaysInactive) return false;
        if (rule.category !== 'all' && a.topCategory !== rule.category) return false;
        return true;
      }),
    [aggregates, rule]
  );

  const set = (patch: Partial<Rule>) => setRule((r) => ({ ...r, ...patch }));

  const control = (label: string, value: number, onChange: (v: number) => void, max: number, unit = '') => (
    <div>
      <div className="flex justify-between text-[11px] mb-1.5">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-primary font-bold tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <Slider value={[value]} min={0} max={max} step={1} onValueChange={(v) => onChange(v[0])} />
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2 bg-card border border-border rounded-md p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm text-foreground">Regras do segmento</h3>
        </div>

        {control('Aderência mínima', rule.minAdherence, (v) => set({ minAdherence: v }), 100, '%')}
        {control('Ofensiva mínima (dias)', rule.minStreak, (v) => set({ minStreak: v }), 60)}
        {control('Treinos mínimos no período', rule.minWorkouts, (v) => set({ minWorkouts: v }), 30)}
        {control('Máx. dias inativo', rule.maxDaysInactive === 999 ? 60 : rule.maxDaysInactive, (v) => set({ maxDaysInactive: v }), 60)}

        <div>
          <span className="text-[11px] font-medium text-foreground block mb-1.5">Categoria de interesse</span>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => set({ category: c })}
                className={cn(
                  'text-[11px] px-2.5 py-1 rounded-full border transition-colors',
                  rule.category === c
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary text-secondary-foreground border-border hover:border-primary/40'
                )}
              >
                {c === 'all' ? 'Todas' : c}
              </button>
            ))}
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={() => setRule(DEFAULT_RULE)} className="text-xs">
          Limpar filtros
        </Button>
      </div>

      <div className="lg:col-span-3 bg-card border border-border rounded-md p-6 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">
              {matched.length} usuários no segmento
              <span className="text-muted-foreground font-normal ml-1">
                ({Math.round((matched.length / (aggregates.length || 1)) * 100)}% da base)
              </span>
            </h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={matched.length === 0}
            onClick={() => downloadCsv('segmento-personalizado', matched, userCsvCols)}
            className="gap-1.5 h-8 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground mb-3">
          Use este público para criar desafios, treinos ou dietas direcionados a quem tem esse perfil.
        </p>

        <div className="flex-1 overflow-y-auto max-h-80 -mx-2 px-2">
          {matched.length === 0 ? (
            <div className="text-xs text-muted-foreground italic text-center py-10">
              Nenhum usuário corresponde a essas regras.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {matched.slice(0, 50).map((m) => (
                <div key={m.user_id} className="flex items-center justify-between py-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate">{m.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{m.topCategory}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {Math.round(ratio(m.habitsDone, m.habitsTotal) * 100)}% · {m.streak}🔥 · {m.workouts}🏋️
                  </span>
                </div>
              ))}
              {matched.length > 50 && (
                <p className="text-[10px] text-muted-foreground text-center py-2">
                  +{matched.length - 50} outros — exporte o CSV para a lista completa.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────── section ──

export default function CommunitiesSection({ periodDays }: { periodDays: number }) {
  const { data, isLoading } = useUserAggregates(periodDays);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const aggregates = data?.aggregates ?? [];
  const vectors = data?.vectors ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="w-4 h-4" />
        Análise sobre {aggregates.length} perfis · janela de {periodDays} dias
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-1">
          Descoberta automática de comunidades
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Agrupamento não supervisionado (k-means) sobre aderência, frequência de treino/dieta, ofensiva, pontos e recência.
        </p>
        <ClusteringPanel aggregates={aggregates} vectors={vectors} />
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-1">
          Construtor de segmentos
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Defina regras de comportamento e exporte o público-alvo para novas ações.
        </p>
        <SegmentBuilder aggregates={aggregates} />
      </div>
    </div>
  );
}
