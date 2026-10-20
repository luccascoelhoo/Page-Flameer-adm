// BibliotecaDeAlimentos.tsx — alimentos e PRATOS (J8 · 18/08/2026).
//
// `foods` já tinha macros por 100 g e nenhuma tela. E faltava o prato: a
// composição de vários alimentos com o cruzamento automático dos valores —
// pedido do dono, em porção, quantidade e peso.
//
// Regra que vale a pena repetir: os macros do prato são COMPUTADOS da soma
// dos ingredientes, nunca digitados. Dois números para a mesma coisa foi o
// defeito mais caro deste projeto.

import React, { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { Apple, ChefHat, Loader2, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/admin/PageHeader';
import StatCard from '@/components/admin/StatCard';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const CATEGORIAS_PRATO = [
  ['refeicao', 'Refeição'], ['fitness', 'Fitness'], ['low_carb', 'Baixo carbo'],
  ['alto_carbo', 'Alto carbo'], ['lanche', 'Lanche'], ['bebida', 'Bebida'],
];

export default function BibliotecaDeAlimentos() {
  const { toast } = useToast();
  const [aba, setAba] = useState<'alimentos' | 'pratos'>('alimentos');
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const [prato, setPrato] = useState<any | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { data: alimentos, isLoading } = useSupabaseQuery<any[]>(['admin', 'foods'], async () => {
    const { data, error } = await (supabase as any)
      .from('foods').select('*').order('name');
    return { data, error };
  });

  const { data: pratos, refetch: refetchPratos } = useSupabaseQuery<any[]>(['admin', 'pratos'], async () => {
    const { data, error } = await (supabase as any).rpc('admin_pratos');
    return { data, error };
  });

  const categorias = useMemo(
    () => Array.from(new Set((alimentos ?? []).map((a: any) => a.category))).sort(),
    [alimentos]);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (alimentos ?? []).filter((a: any) =>
      (categoria === 'todas' || a.category === categoria) &&
      (!t || a.name.toLowerCase().includes(t)));
  }, [alimentos, busca, categoria]);

  // O cruzamento ao vivo: enquanto o prato é montado, os macros somam na tela
  // com a MESMA conta do servidor (kcal × gramas ÷ 100).
  const totalDoPrato = useMemo(() => {
    const itens = prato?.itens ?? [];
    return itens.reduce((acc: any, it: any) => {
      const f = (alimentos ?? []).find((x: any) => x.id === it.food_id);
      if (!f) return acc;
      const k = it.grams / 100;
      return {
        kcal: acc.kcal + (f.kcal ?? 0) * k, protein: acc.protein + (f.protein ?? 0) * k,
        carbs: acc.carbs + (f.carbs ?? 0) * k, fat: acc.fat + (f.fat ?? 0) * k,
        peso: acc.peso + it.grams,
      };
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0, peso: 0 });
  }, [prato, alimentos]);

  const salvarPrato = async () => {
    if (!prato?.nome?.trim() || (prato.itens ?? []).length === 0) {
      toast({ title: 'Faltam dados', description: 'O prato precisa de nome e pelo menos um alimento.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    const { error } = await (supabase as any).rpc('admin_salvar_prato', {
      p_dados: {
        id: prato.id ?? null, nome: prato.nome, descricao: prato.descricao ?? null,
        categoria: prato.categoria ?? 'refeicao',
        itens: (prato.itens ?? []).map((i: any) => ({ food_id: i.food_id, grams: i.grams })),
      },
    });
    setSalvando(false);
    if (error) {
      toast({ title: 'Não deu para salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Prato salvo', description: 'Os macros vieram da soma da composição.' });
    setPrato(null); refetchPratos();
  };

  const addAoPrato = (f: any) => {
    if (!prato) return;
    if ((prato.itens ?? []).some((i: any) => i.food_id === f.id)) return;
    setPrato({ ...prato, itens: [...(prato.itens ?? []),
      { food_id: f.id, nome: f.name, grams: f.portion_default_g ?? 100 }] });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Alimentos e pratos"
        subtitulo="A base que alimenta os cardápios. Valores por 100 g; no prato, a soma da composição é a verdade — nunca um número digitado."
        acoes={
          aba === 'pratos' ? (
            <Button size="sm" className="h-8 text-xs gap-1.5"
                    onClick={() => setPrato({ nome: '', categoria: 'refeicao', itens: [] })}>
              <Plus className="w-3.5 h-3.5" /> Novo prato
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard rotulo="Alimentos na base" valor={(alimentos ?? []).length} icone={Apple} tom="acento" />
        <StatCard rotulo="Categorias" valor={categorias.length} icone={Apple} />
        <StatCard rotulo="Pratos montados" valor={(pratos ?? []).length} icone={ChefHat} tom="acento" />
        <StatCard rotulo="Com porção definida"
                  valor={(alimentos ?? []).filter((a: any) => a.portion_default_g).length} icone={Apple} />
      </div>

      <div className="flex gap-1 border-b border-border">
        {(['alimentos', 'pratos'] as const).map((a) => (
          <button key={a} onClick={() => setAba(a)}
            className={cn('px-3.5 py-2 text-xs font-semibold capitalize transition-colors',
              aba === a ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground')}>
            {a}
          </button>
        ))}
      </div>

      {/* Editor de prato — o cruzamento ao vivo */}
      {prato && (
        <div className="bg-card border border-primary rounded-md p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">
              {prato.id ? `Editando: ${prato.nome}` : 'Novo prato'}
            </h2>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPrato(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Nome do prato</label>
              <Input className="h-8 text-xs" value={prato.nome}
                     onChange={(e) => setPrato({ ...prato, nome: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Categoria</label>
              <select className="h-8 px-2 rounded-md border border-input bg-background text-xs"
                      value={prato.categoria} onChange={(e) => setPrato({ ...prato, categoria: e.target.value })}>
                {CATEGORIAS_PRATO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Composição */}
          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
              Composição — clique num alimento da lista abaixo para incluir
            </p>
            {(prato.itens ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum alimento ainda.</p>
            ) : (
              <div className="space-y-1.5">
                {prato.itens.map((it: any, idx: number) => {
                  const f = (alimentos ?? []).find((x: any) => x.id === it.food_id);
                  return (
                    <div key={it.food_id} className="flex items-center gap-2">
                      <span className="text-xs text-foreground flex-1 truncate">{f?.name ?? it.nome}</span>
                      <Input type="number" className="h-7 w-20 text-xs" value={it.grams}
                             onChange={(e) => {
                               const itens = [...prato.itens];
                               itens[idx] = { ...it, grams: Number(e.target.value) || 0 };
                               setPrato({ ...prato, itens });
                             }} />
                      <span className="text-[10px] text-muted-foreground w-8">g</span>
                      <span className="text-[10px] text-muted-foreground w-16 text-right tabular-nums">
                        {Math.round(((f?.kcal ?? 0) * it.grams) / 100)} kcal
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6"
                              onClick={() => setPrato({ ...prato, itens: prato.itens.filter((_: any, i: number) => i !== idx) })}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* O cruzamento */}
          <div className="grid grid-cols-5 gap-2 rounded-md bg-secondary p-3">
            {[['kcal', Math.round(totalDoPrato.kcal)], ['proteína', `${totalDoPrato.protein.toFixed(1)} g`],
              ['carbo', `${totalDoPrato.carbs.toFixed(1)} g`], ['gordura', `${totalDoPrato.fat.toFixed(1)} g`],
              ['peso', `${Math.round(totalDoPrato.peso)} g`]].map(([r, v]: any) => (
              <div key={r} className="text-center">
                <p className="text-base font-bold text-foreground tabular-nums">{v}</p>
                <p className="text-[10px] text-muted-foreground">{r}</p>
              </div>
            ))}
          </div>

          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={salvarPrato} disabled={salvando}>
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar prato
          </Button>
        </div>
      )}

      {aba === 'alimentos' ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="h-8 pl-8 text-xs" placeholder="Buscar alimento…"
                     value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
              className="h-8 px-2 rounded-md border border-input bg-background text-xs">
              <option value="todas">Todas as categorias</option>
              {categorias.map((c: any) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-xs text-muted-foreground">{lista.length} alimento(s)</span>
          </div>

          {isLoading ? (
            <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="bg-card border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-4 py-2">Alimento</th><th className="px-4 py-2">Categoria</th>
                    <th className="px-4 py-2 text-right">kcal</th><th className="px-4 py-2 text-right">P</th>
                    <th className="px-4 py-2 text-right">C</th><th className="px-4 py-2 text-right">G</th>
                    <th className="px-4 py-2">Fonte</th>
                    {prato && <th className="px-4 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {lista.slice(0, 200).map((a: any) => (
                    <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2 text-foreground font-medium">{a.name}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{a.category}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{Math.round(a.kcal)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs">{a.protein?.toFixed(1)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs">{a.carbs?.toFixed(1)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs">{a.fat?.toFixed(1)}</td>
                      <td className="px-4 py-2 text-[10px] text-muted-foreground">{a.source}</td>
                      {prato && (
                        <td className="px-4 py-2 text-right">
                          <Button variant="ghost" size="sm" className="h-6 text-[10px]"
                                  onClick={() => addAoPrato(a)}>+ prato</Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {lista.length > 200 && (
                <p className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border">
                  Mostrando 200 de {lista.length} — refine a busca para ver o resto.
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {(pratos ?? []).map((p: any) => (
            <button key={p.id} onClick={() => setPrato({ ...p, itens: p.itens ?? [] })}
              className="bg-card border border-border rounded-md p-4 text-left hover:border-primary/50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{p.nome}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase shrink-0">
                  {p.categoria}
                </span>
              </div>
              <p className="text-lg font-bold text-primary mt-1 tabular-nums">{p.kcal} kcal</p>
              <p className="text-[11px] text-muted-foreground">
                P {p.protein} · C {p.carbs} · G {p.fat} · {p.peso_total_g} g
              </p>
              <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                {(p.itens ?? []).map((i: any) => i.nome).join(', ') || 'sem composição'}
              </p>
            </button>
          ))}
          {(pratos ?? []).length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-muted-foreground italic">
              Nenhum prato montado ainda. Crie um e monte a composição a partir da base de alimentos.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
