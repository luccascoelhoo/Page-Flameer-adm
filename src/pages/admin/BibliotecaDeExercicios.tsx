// BibliotecaDeExercicios.tsx — o acervo do produto (J7 · 18/08/2026).
//
// Os 62 exercícios viviam DENTRO do binário do app: mudar um nome exigia
// release na App Store. Agora eles moram no banco, com mídia de execução e
// dono — e esta é a tela que cura o acervo.
//
// Filtros na linguagem do motor (grupo muscular × equipamento × nível),
// porque é assim que ele escolhe e substitui exercício com segurança.

import React, { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { Dumbbell, Loader2, Plus, Save, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/admin/PageHeader';
import StatCard from '@/components/admin/StatCard';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const GRUPOS = ['Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Abdômen', 'Cardio', 'Corpo inteiro'];
const EQUIP: Record<string, string> = {
  casa: 'Peso do corpo / casa', academia_basica: 'Academia de prédio', academia_completa: 'Academia completa',
};
const NIVEL = ['Iniciante', 'Intermediário', 'Avançado'];
// Categoria = o ESTILO do exercício (D3). É o que casa com o local do desafio:
// casa→funcional, academia→hipertrofia/condicionamento, ar livre→cardio/calistenia.
const CATEGORIAS: Record<string, string> = {
  forca_hipertrofia: 'Força / hipertrofia', funcional: 'Funcional',
  condicionamento: 'Condicionamento', cardio: 'Cardio',
  calistenia: 'Calistenia', mobilidade: 'Mobilidade',
};
// Locais onde o exercício cabe (D3). Um exercício pode servir a vários.
const LOCAIS: Record<string, string> = {
  casa: 'Casa', academia: 'Academia', ar_livre: 'Ar livre',
};
const PADROES = [
  'empurrar_horizontal', 'empurrar_vertical', 'puxar_horizontal', 'puxar_vertical',
  'dominante_joelho', 'dominante_quadril', 'panturrilha', 'nucleo_anti_extensao',
  'nucleo_anti_flexao', 'nucleo_anti_rotacao', 'nucleo_rotacao', 'nucleo_flexao',
  'isolamento_biceps', 'isolamento_triceps', 'isolamento_ombro',
  'cardio', 'pliometria', 'locomocao', 'isometria', 'isometria_core', 'extensao_lombar',
];
const CARGAS: [string, string][] = [
  ['carga_joelho', 'Joelho'], ['carga_lombar', 'Lombar'], ['acima_da_cabeca', 'Acima da cabeça'],
  ['carga_punho', 'Punho'], ['carga_cervical', 'Cervical'], ['impacto', 'Impacto'],
];

export default function BibliotecaDeExercicios() {
  const { toast } = useToast();
  const [grupo, setGrupo] = useState('todos');
  const [equip, setEquip] = useState('todos');
  const [categoria, setCategoria] = useState('todos');
  const [local, setLocal] = useState('todos');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<any | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { data: catalogo, isLoading, refetch } = useSupabaseQuery<any[]>(
    ['admin', 'catalogo-exercicios'], async () => {
      const { data, error } = await (supabase as any).rpc('admin_catalogo_de_exercicios');
      return { data, error };
    });

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (catalogo ?? []).filter((e: any) =>
      (grupo === 'todos' || e.grupo === grupo) &&
      (equip === 'todos' || e.equipamento === equip) &&
      (categoria === 'todos' || e.categoria === categoria) &&
      (local === 'todos' || (Array.isArray(e.locais) && e.locais.includes(local))) &&
      (!t || e.nome.toLowerCase().includes(t)));
  }, [catalogo, grupo, equip, categoria, local, busca]);

  const salvar = async () => {
    if (!editando?.nome?.trim()) {
      toast({ title: 'Falta o nome', variant: 'destructive' }); return;
    }
    setSalvando(true);
    const { error } = await (supabase as any).rpc('admin_salvar_exercicio', { p_dados: editando });
    setSalvando(false);
    if (error) {
      toast({ title: 'Não deu para salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editando.id ? 'Exercício atualizado' : 'Exercício criado' });
    setEditando(null); refetch();
  };

  const porGrupo = (g: string) => (catalogo ?? []).filter((e: any) => e.grupo === g).length;

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Biblioteca de exercícios"
        subtitulo="O acervo que alimenta treinos livres, desafios e periodizações. Padrão de movimento e cargas articulares são o que permitem trocar um exercício com segurança."
        acoes={
          <Button size="sm" className="h-8 text-xs gap-1.5"
                  onClick={() => setEditando({ grupo: 'Peito', equipamento: 'academia_completa',
                                               padrao_de_movimento: 'empurrar_horizontal', nivel_minimo: 0,
                                               categoria: 'forca_hipertrofia', locais: ['academia'], is_active: true })}>
            <Plus className="w-3.5 h-3.5" /> Novo exercício
          </Button>
        }
      />

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {GRUPOS.map((g) => (
          <StatCard key={g} rotulo={g} valor={porGrupo(g)} icone={Dumbbell}
                    tom={grupo === g ? 'acento' : 'neutro'} />
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input className="h-8 pl-8 text-xs" placeholder="Buscar exercício…"
                 value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <select value={grupo} onChange={(e) => setGrupo(e.target.value)}
          className="h-8 px-2 rounded-md border border-input bg-background text-xs">
          <option value="todos">Todos os grupos</option>
          {GRUPOS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={equip} onChange={(e) => setEquip(e.target.value)}
          className="h-8 px-2 rounded-md border border-input bg-background text-xs">
          <option value="todos">Todo equipamento</option>
          {Object.entries(EQUIP).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
          className="h-8 px-2 rounded-md border border-input bg-background text-xs">
          <option value="todos">Toda categoria</option>
          {Object.entries(CATEGORIAS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={local} onChange={(e) => setLocal(e.target.value)}
          className="h-8 px-2 rounded-md border border-input bg-background text-xs">
          <option value="todos">Todo local</option>
          {Object.entries(LOCAIS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">{lista.length} exercício(s)</span>
      </div>

      {/* Editor */}
      {editando && (
        <div className="bg-card border border-primary rounded-md p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">
              {editando.id ? `Editando: ${editando.nome}` : 'Novo exercício'}
            </h2>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditando(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Nome</label>
              <Input className="h-8 text-xs" value={editando.nome ?? ''}
                     onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Grupo</label>
              <select className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                      value={editando.grupo} onChange={(e) => setEditando({ ...editando, grupo: e.target.value })}>
                {GRUPOS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Equipamento</label>
              <select className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                      value={editando.equipamento} onChange={(e) => setEditando({ ...editando, equipamento: e.target.value })}>
                {Object.entries(EQUIP).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Padrão de movimento</label>
              <select className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                      value={editando.padrao_de_movimento}
                      onChange={(e) => setEditando({ ...editando, padrao_de_movimento: e.target.value })}>
                {PADROES.map((p) => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Nível mínimo</label>
              <select className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                      value={editando.nivel_minimo}
                      onChange={(e) => setEditando({ ...editando, nivel_minimo: Number(e.target.value) })}>
                {NIVEL.map((n, i) => <option key={n} value={i}>{n}</option>)}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Subgrupo (alvo granular)</label>
              <Input className="h-8 text-xs" placeholder="ex.: Deltoide lateral, Quadríceps, Oblíquos"
                     value={editando.subgrupo ?? ''}
                     onChange={(e) => setEditando({ ...editando, subgrupo: e.target.value })} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Categoria (estilo)</label>
              <select className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                      value={editando.categoria ?? ''}
                      onChange={(e) => setEditando({ ...editando, categoria: e.target.value })}>
                <option value="">— sem categoria —</option>
                {Object.entries(CATEGORIAS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Imagem ou GIF (URL)</label>
              <Input className="h-8 text-xs" value={editando.gif_url ?? editando.image_url ?? ''}
                     onChange={(e) => setEditando({ ...editando, image_url: e.target.value })} />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
              Onde o exercício cabe — filtra o acervo por local do desafio
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(LOCAIS).map(([v, l]) => {
                const ativos: string[] = Array.isArray(editando.locais) ? editando.locais : [];
                const on = ativos.includes(v);
                return (
                  <button key={v}
                    onClick={() => setEditando({ ...editando,
                      locais: on ? ativos.filter((x) => x !== v) : [...ativos, v] })}
                    className={cn('text-xs px-2.5 py-1 rounded border transition-colors',
                      on ? 'bg-primary/15 border-primary text-primary font-semibold'
                         : 'border-border text-muted-foreground')}>
                    {l}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
              Cargas articulares — é com isto que o motor protege quem declarou lesão
            </p>
            <div className="flex flex-wrap gap-2">
              {CARGAS.map(([campo, rot]) => (
                <button key={campo} onClick={() => setEditando({ ...editando, [campo]: !editando[campo] })}
                  className={cn('text-xs px-2.5 py-1 rounded border transition-colors',
                    editando[campo] ? 'bg-primary/15 border-primary text-primary font-semibold'
                                    : 'border-border text-muted-foreground')}>
                  {rot}
                </button>
              ))}
              <button onClick={() => setEditando({ ...editando, composto: !editando.composto })}
                className={cn('text-xs px-2.5 py-1 rounded border transition-colors',
                  editando.composto ? 'bg-success/15 border-success text-success font-semibold'
                                    : 'border-border text-muted-foreground')}>
                Composto
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Instruções de execução</label>
            <textarea className="w-full min-h-[60px] p-2 rounded-md border border-input bg-background text-xs"
                      value={editando.instrucoes ?? ''}
                      onChange={(e) => setEditando({ ...editando, instrucoes: e.target.value })} />
          </div>

          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar na base
          </Button>
        </div>
      )}

      {/* Acervo */}
      {isLoading ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {lista.map((e: any) => (
            <button key={e.id} onClick={() => setEditando(e)}
              className="bg-card border border-border rounded-md p-4 text-left hover:border-primary/50 transition-colors">
              <div className="flex items-start gap-3">
                {(e.gif_url || e.image_url) ? (
                  <img src={e.gif_url ?? e.image_url} alt="" className="w-14 h-14 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded bg-secondary flex items-center justify-center shrink-0">
                    <Dumbbell className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{e.nome}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {e.grupo}{e.subgrupo ? ` · ${e.subgrupo}` : ''} · {NIVEL[e.nivel_minimo]}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {CATEGORIAS[e.categoria] ?? e.categoria ?? '—'}
                    {Array.isArray(e.locais) && e.locais.length > 0
                      ? ` · ${e.locais.map((l: string) => LOCAIS[l] ?? l).join(', ')}`
                      : ''}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {e.owner_id && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-primary/15 text-primary font-bold uppercase">Só meu</span>
                    )}
                    {!e.is_active && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-bold uppercase">Inativo</span>
                    )}
                    {CARGAS.filter(([c]) => e[c]).map(([c, rot]) => (
                      <span key={c} className="text-[9px] px-1 py-0.5 rounded bg-destructive/10 text-destructive">{rot}</span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
          {lista.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-muted-foreground italic">
              Nenhum exercício com esses filtros.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
