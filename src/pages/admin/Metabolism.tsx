import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Flame, Search, User, Zap, Target, Loader2, Copy, Check, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import {
  ACTIVITY_FACTORS,
  ACTIVITY_LABEL,
  GOAL_ADJUSTMENT,
  GOAL_LABEL,
  ageFromBirthYear,
  computeMetabolism,
  type ActivityLevel,
  type Gender,
  type Goal,
} from '@/lib/admin/metabolism';
import { cn } from '@/lib/utils';

const sb = supabase as any;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-lg border border-border bg-secondary/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 px-2 py-1.5 text-xs font-semibold rounded-md transition-all',
            value === o.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Metabolism() {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [gender, setGender] = useState<Gender>('male');
  const [goal, setGoal] = useState<Goal>('maintain');
  const [activity, setActivity] = useState<ActivityLevel>('active');
  const [weight, setWeight] = useState(75);
  const [height, setHeight] = useState(175);
  const [age, setAge] = useState(28);
  const [proteinPerKg, setProteinPerKg] = useState(2.0);
  const [fatPct, setFatPct] = useState(25);

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ['admin', 'metabolism', 'search', query],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      const { data } = await sb
        .from('profiles')
        .select('id, name, avatar_url, gender, goal, height, weight, daily_routine, birth_year, cohort_group')
        .ilike('name', `%${query}%`)
        .limit(8);
      return (data ?? []) as any[];
    },
  });

  const applyProfile = (p: any) => {
    setSelectedName(p.name);
    setQuery('');
    if (p.gender === 'male' || p.gender === 'female') setGender(p.gender);
    if (p.goal === 'lose' || p.goal === 'maintain' || p.goal === 'gain') setGoal(p.goal);
    if (['sedentary', 'active', 'heavy'].includes(p.daily_routine)) setActivity(p.daily_routine);
    if (p.weight) setWeight(Math.round(Number(p.weight)));
    if (p.height) setHeight(Math.round(Number(p.height)));
    const derivedAge = ageFromBirthYear(p.birth_year);
    if (derivedAge) setAge(derivedAge);
    toast({
      title: `Perfil de ${p.name} carregado`,
      description: p.birth_year ? `Idade real: ${ageFromBirthYear(p.birth_year)} anos` : 'Sem ano de nascimento — ajuste a idade manualmente.',
    });
  };

  const result = useMemo(
    () => computeMetabolism({ gender, weightKg: weight, heightCm: height, age, activity, goal, proteinPerKg, fatPct: fatPct / 100 }),
    [gender, weight, height, age, activity, goal, proteinPerKg, fatPct]
  );

  const copyPrescription = () => {
    const text = [
      `Prescrição metabólica${selectedName ? ` — ${selectedName}` : ''}`,
      `TMB: ${result.bmr} kcal · TDEE: ${result.tdee} kcal`,
      `Meta (${GOAL_LABEL[goal]}): ${result.target} kcal/dia`,
      `Proteína: ${result.macros.protein} g · Carboidrato: ${result.macros.carbs} g · Gordura: ${result.macros.fat} g`,
    ].join('\n');
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const macroBar = [
    { label: 'Proteína', g: result.macros.protein, kcal: result.macros.proteinKcal, color: 'bg-primary' },
    { label: 'Carboidrato', g: result.macros.carbs, kcal: result.macros.carbsKcal, color: 'bg-teal-500' },
    { label: 'Gordura', g: result.macros.fat, kcal: result.macros.fatKcal, color: 'bg-amber-500' },
  ];
  const totalKcal = result.macros.proteinKcal + result.macros.carbsKcal + result.macros.fatKcal || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Flame className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Calculadora Metabólica (TMB)</h1>
          <p className="text-sm text-muted-foreground">
            Mifflin-St Jeor com idade real do perfil, TDEE e metas de macros para prescrição.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Inputs */}
        <div className="lg:col-span-3 space-y-5">
          {/* User picker */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Carregar dados de um usuário</h3>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar usuário por nome…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
              {query.trim().length >= 2 && (
                <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                  {isFetching ? (
                    <div className="p-3 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Buscando…</div>
                  ) : (searchResults ?? []).length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">Nenhum usuário encontrado.</div>
                  ) : (
                    (searchResults ?? []).map((p) => (
                      <button key={p.id} onClick={() => applyProfile(p)} className="w-full text-left px-3 py-2 hover:bg-secondary flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground truncate">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {p.weight ? `${Math.round(p.weight)}kg` : '—'} · {p.cohort_group ?? '—'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedName && (
              <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                <Check className="w-3 h-3 text-success" /> Dados de <span className="font-semibold text-foreground">{selectedName}</span> aplicados. Edite abaixo se necessário.
              </p>
            )}
          </div>

          {/* Manual inputs */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Sexo">
                <Segmented value={gender} onChange={setGender} options={[{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Feminino' }]} />
              </Field>
              <Field label="Objetivo">
                <Segmented value={goal} onChange={setGoal} options={(['lose', 'maintain', 'gain'] as Goal[]).map((g) => ({ value: g, label: GOAL_LABEL[g].split(' ')[0] }))} />
              </Field>
            </div>

            <Field label="Nível de atividade">
              <Segmented value={activity} onChange={setActivity} options={(['sedentary', 'active', 'heavy'] as ActivityLevel[]).map((a) => ({ value: a, label: ACTIVITY_LABEL[a] }))} />
            </Field>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Peso (kg)">
                <Input type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
              </Field>
              <Field label="Altura (cm)">
                <Input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
              </Field>
              <Field label="Idade">
                <Input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-5 pt-1">
              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="font-medium text-foreground">Proteína / kg</span>
                  <span className="text-primary font-bold">{proteinPerKg.toFixed(1)} g</span>
                </div>
                <Slider value={[proteinPerKg]} min={1.2} max={3} step={0.1} onValueChange={(v) => setProteinPerKg(v[0])} />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="font-medium text-foreground">Gordura (% kcal)</span>
                  <span className="text-primary font-bold">{fatPct}%</span>
                </div>
                <Slider value={[fatPct]} min={15} max={40} step={1} onValueChange={(v) => setFatPct(v[0])} />
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-foreground">Resultado</h3>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[11px]" onClick={copyPrescription}>
                {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-primary" />TMB (basal)</span>
                <span className="text-lg font-bold text-foreground tabular-nums">{result.bmr} <span className="text-[11px] font-normal text-muted-foreground">kcal</span></span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-teal-500" />TDEE (×{ACTIVITY_FACTORS[activity]})</span>
                <span className="text-lg font-bold text-foreground tabular-nums">{result.tdee} <span className="text-[11px] font-normal text-muted-foreground">kcal</span></span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-xs text-primary font-semibold flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />Meta ({GOAL_LABEL[goal]})
                  <span className="text-[10px] font-normal">{GOAL_ADJUSTMENT[goal] > 0 ? `+${GOAL_ADJUSTMENT[goal]}` : GOAL_ADJUSTMENT[goal]}</span>
                </span>
                <span className="text-xl font-bold text-primary tabular-nums">{result.target} <span className="text-[11px] font-normal">kcal</span></span>
              </div>
            </div>
          </div>

          {/* Macros */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-sm text-foreground mb-4">Distribuição de macros</h3>
            <div className="flex h-2.5 w-full rounded-full overflow-hidden mb-4">
              {macroBar.map((m) => (
                <div key={m.label} className={m.color} style={{ width: `${(m.kcal / totalKcal) * 100}%` }} title={`${m.label}: ${m.kcal} kcal`} />
              ))}
            </div>
            <div className="space-y-2">
              {macroBar.map((m) => (
                <div key={m.label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className={cn('w-2.5 h-2.5 rounded-full', m.color)} />
                    <span className="text-foreground font-medium">{m.label}</span>
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    <span className="text-foreground font-bold">{m.g} g</span> · {m.kcal} kcal · {Math.round((m.kcal / totalKcal) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-secondary/30 border border-border rounded-lg p-3">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Corrige o bug do app (idade fixa em 25). Use a meta e os macros ao montar a dieta do desafio para este perfil.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
