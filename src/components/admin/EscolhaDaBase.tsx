// EscolhaDaBase.tsx — o campo que conhece o acervo (18/08/2026).
//
// Antes, montar um treino ou um cardápio no painel era DIGITAR o nome do
// exercício e do alimento. As bases (exercise_catalog com 62 itens, foods
// com 183) existiam sem ninguém para consumi-las — cadastro bonito, sem uso.
//
// Este campo resolve sem quebrar nada: continua aceitando texto livre (o
// conteúdo antigo e o exercício que ainda não está na base seguem
// funcionando), mas sugere da base enquanto se digita e, ao escolher,
// devolve os DADOS junto — músculo do exercício, macros do alimento.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Check, Database } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Fonte = 'exercicios' | 'alimentos';

export interface ItemDaBase {
  id: string;
  nome: string;
  // exercícios
  grupo?: string;
  equipamento?: string;
  // alimentos
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  porcao_g?: number;
}

/** Cache por sessão: a base inteira cabe na memória e evita ida ao servidor
 *  a cada tecla — são 62 e 183 linhas, não um catálogo de supermercado. */
const cache: Partial<Record<Fonte, ItemDaBase[]>> = {};

async function carregar(fonte: Fonte): Promise<ItemDaBase[]> {
  if (cache[fonte]) return cache[fonte]!;
  if (fonte === 'exercicios') {
    const { data } = await (supabase as any)
      .from('exercise_catalog')
      .select('id, nome, grupo, equipamento')
      .eq('is_active', true).order('nome');
    cache.exercicios = (data ?? []).map((e: any) => ({
      id: e.id, nome: e.nome, grupo: e.grupo, equipamento: e.equipamento,
    }));
    return cache.exercicios!;
  }
  const { data } = await (supabase as any)
    .from('foods')
    .select('id, name, kcal, protein, carbs, fat, portion_default_g')
    .order('name');
  cache.alimentos = (data ?? []).map((f: any) => ({
    id: f.id, nome: f.name, kcal: f.kcal, protein: f.protein,
    carbs: f.carbs, fat: f.fat, porcao_g: f.portion_default_g,
  }));
  return cache.alimentos!;
}

export default function EscolhaDaBase({
  fonte, valor, onChange, onEscolher, placeholder, className,
}: {
  fonte: Fonte;
  valor: string;
  /** Digitação livre — o comportamento de sempre. */
  onChange: (v: string) => void;
  /** Escolheu um item da base: vem com os dados junto. */
  onEscolher?: (item: ItemDaBase) => void;
  placeholder?: string;
  className?: string;
}) {
  const [base, setBase] = useState<ItemDaBase[]>([]);
  const [aberto, setAberto] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { carregar(fonte).then(setBase).catch(() => setBase([])); }, [fonte]);

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const sugestoes = useMemo(() => {
    const t = (valor ?? '').trim().toLowerCase();
    if (!t) return base.slice(0, 8);
    return base.filter((i) => i.nome.toLowerCase().includes(t)).slice(0, 8);
  }, [base, valor]);

  const daBase = base.some((i) => i.nome.toLowerCase() === (valor ?? '').trim().toLowerCase());

  return (
    <div ref={box} className="relative">
      <Input
        value={valor}
        onChange={(e) => { onChange(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        placeholder={placeholder}
        className={cn(className, daBase && 'pr-7')}
      />
      {daBase && (
        <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-success"
               aria-label="item da base" />
      )}
      {aberto && sugestoes.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          <p className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 border-b border-border">
            <Database className="w-2.5 h-2.5" /> da base ({base.length})
          </p>
          {sugestoes.map((i) => (
            <button key={i.id} type="button"
              onClick={() => { onChange(i.nome); onEscolher?.(i); setAberto(false); }}
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent transition-colors">
              <span className="text-foreground">{i.nome}</span>
              <span className="text-[10px] text-muted-foreground ml-1.5">
                {fonte === 'exercicios'
                  ? i.grupo
                  : `${Math.round(i.kcal ?? 0)} kcal/100g`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
