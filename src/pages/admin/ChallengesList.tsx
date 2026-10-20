import React, { useMemo, useState } from 'react';
import { useConfirmar } from '@/components/admin/Confirmar';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Plus,
  Search,
  Trash2,
  Edit,
  Users,
  Loader2,
  Eye,
  Info,
  FolderOpen,
  MoreHorizontal,
  Rocket,
  PauseCircle,
  Archive,
  Copy,
  Star,
  Trophy,
  Download,
} from 'lucide-react';
import ImportModal from '@/components/admin/ImportModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useContentActions, duplicateChallenge } from '@/hooks/admin/useContentActions';
import { tryRpc } from '@/lib/admin/rpc';
import { STATUS_META, STATUS_TABS, statusOf, timeStateOf, type ContentStatus } from '@/lib/admin/lifecycle';
import { downloadCsv } from '@/lib/admin/export';
import { cn } from '@/lib/utils';

const TIER_LABEL: Record<string, string> = {
  admin: 'Oficial 🏅',
  influencer: 'Influenciador ⭐',
  premium_user: 'Premium 💎',
  free_user: 'Grátis 🔓',
};

export default function ChallengesList() {
  const { toast } = useToast();
  const confirmar = useConfirmar();
  const { profile } = useAdminAuth(false);
  const actions = useContentActions('challenges');

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusTab, setStatusTab] = useState<ContentStatus | 'all'>('all');
  const [ownerOnly, setOwnerOnly] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [dupId, setDupId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'table', 'challenges', 'console'],
    queryFn: async () => {
      const { data: rows, error } = await (supabase as any)
        .from('challenges')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // accurate participant counts (reads challenge_participants when present)
      const countsRpc = await tryRpc<Record<string, number>>('admin_challenge_participant_counts');
      const counts = countsRpc.missing ? {} : countsRpc.data ?? {};
      return { rows: (rows ?? []) as any[], counts };
    },
  });

  const rows = data?.rows ?? [];
  const counts = data?.counts ?? {};

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    rows.forEach((r) => {
      const s = statusOf(r);
      c[s] = (c[s] ?? 0) + 1;
    });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return rows.filter((r) => {
      if (statusTab !== 'all' && statusOf(r) !== statusTab) return false;
      if (tierFilter !== 'all' && r.tier !== tierFilter) return false;
      if (ownerOnly && profile && r.creator_id !== profile.id) return false;
      if (term) {
        const hay = `${r.title ?? ''} ${r.subtitle ?? ''} ${r.category ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, search, statusTab, tierFilter, ownerOnly, profile]);

  const handleDelete = async (id: string, title: string) => {
    // A frase antiga prometia cascata: "remove hábitos, treinos e dieta
    // vinculados". Desde que `workouts`/`diets`/`habits` ganharam FK para
    // `challenges` com ON DELETE RESTRICT, o oposto é verdade — o banco RECUSA
    // enquanto houver conteúdo, e recusa de propósito: `challenge_id` nulo é o
    // estado que abre o ramo social de `can_read_workout`, então apagar em
    // cascata transformaria produto pago em conteúdo público.
    if (!await confirmar({
      titulo: `Excluir o desafio "${title}"?`,
      descricao: 'O conteúdo vinculado NÃO é apagado junto — enquanto houver treino, dieta ou hábito ligado a ele, a exclusão é recusada pelo banco. Remova o conteúdo primeiro.',
      confirmar: 'Excluir', destrutivo: true,
    })) return;
    await actions.remove(id);
  };

  const handleDuplicate = async (id: string) => {
    setDupId(id);
    const res = await duplicateChallenge(id);
    setDupId(null);
    if (res.ok) {
      toast({ title: 'Desafio duplicado', description: 'Uma cópia foi criada como rascunho.' });
      refetch();
    } else {
      toast({ title: 'Erro ao duplicar', description: res.error, variant: 'destructive' });
    }
  };

  const setStatus = async (id: string, status: ContentStatus, label: string) => {
    const ok = await actions.setStatus(id, status);
    if (ok) toast({ title: label });
  };

  const exportCsv = () => {
    downloadCsv('desafios', filtered, [
      { header: 'Título', accessor: (r) => r.title },
      { header: 'Categoria', accessor: (r) => r.category },
      { header: 'Tier', accessor: (r) => r.tier },
      { header: 'Status', accessor: (r) => STATUS_META[statusOf(r)].label },
      { header: 'Visibilidade', accessor: (r) => r.visibility },
      { header: 'Destaque', accessor: (r) => (r.is_featured ? 'Sim' : 'Não') },
      { header: 'Duração (dias)', accessor: (r) => r.duration_days },
      { header: 'Participantes', accessor: (r) => counts[r.id] ?? 0 },
      { header: 'Prêmio', accessor: (r) => r.prize ?? '' },
      { header: 'Criado em', accessor: (r) => new Date(r.created_at).toLocaleDateString('pt-BR') },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Desafios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rows.length} no banco · publique, pause, duplique e disponibilize para o app.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 h-9 text-xs" disabled={filtered.length === 0}>
            <Download className="w-4 h-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="gap-1.5 h-9 text-xs border-primary text-primary hover:bg-primary/5">
            <FolderOpen className="w-4 h-4" />
            Importar
          </Button>
          <Button asChild size="sm" className="gap-1.5 h-9 text-xs">
            <Link to="/challenges/new">
              <Plus className="w-4 h-4" />
              Novo Desafio
            </Link>
          </Button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatusTab(t.value)}
            className={cn(
              'relative px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors',
              statusTab === t.value ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
            <span className="ml-1.5 text-[10px] tabular-nums opacity-70">{statusCounts[t.value] ?? 0}</span>
            {statusTab === t.value && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-primary rounded-full" />}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por título, subtítulo ou categoria…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="h-10 px-3.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">Todos os tiers</option>
          <option value="admin">Oficial</option>
          <option value="influencer">Influenciador</option>
          <option value="premium_user">Premium</option>
          <option value="free_user">Grátis</option>
        </select>
        <button
          onClick={() => setOwnerOnly((v) => !v)}
          className={cn(
            'h-10 px-3.5 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap',
            ownerOnly ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-input hover:text-foreground'
          )}
        >
          {ownerOnly ? 'Meus desafios' : 'Todos os autores'}
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">Carregando desafios…</span>
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const status = statusOf(c);
            const meta = STATUS_META[status];
            const time = timeStateOf(c);
            const participants = counts[c.id] ?? 0;
            const busy = actions.busyId === c.id || dupId === c.id;
            const cover = c.cover_image_url;
            const themeColor = Array.isArray(c.theme_colors) && c.theme_colors[0] ? c.theme_colors[0] : '#6B1D2F';

            return (
              <div key={c.id} className="group bg-card border border-border rounded-md overflow-hidden flex flex-col">
                {/* Cover */}
                <div className="relative h-28 w-full overflow-hidden" style={{ background: themeColor }}>
                  {cover ? (
                    <img src={cover} alt={c.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Trophy className="w-9 h-9 text-white/40" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur', meta.badge)}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
                      {meta.label}
                    </span>
                  </div>
                  {c.is_featured && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">
                      <Star className="w-2.5 h-2.5 fill-current" /> Destaque
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-foreground truncate">{c.title}</h3>
                      <p className="text-[11px] text-muted-foreground truncate">{c.subtitle || 'Sem subtítulo'}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={busy}>
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem asChild className="text-xs">
                          <Link to={`/challenges/${c.id}`}><Edit className="w-3.5 h-3.5 mr-2" />Editar</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="text-xs">
                          <Link to={`/challenges/${c.id}/participants`}><Users className="w-3.5 h-3.5 mr-2" />Participantes ({participants})</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {status !== 'published' && (
                          <DropdownMenuItem className="text-xs" onClick={() => setStatus(c.id, 'published', 'Desafio publicado e disponível no app')}>
                            <Rocket className="w-3.5 h-3.5 mr-2 text-success" />Publicar
                          </DropdownMenuItem>
                        )}
                        {status === 'published' && (
                          <DropdownMenuItem className="text-xs" onClick={() => setStatus(c.id, 'paused', 'Desafio pausado (oculto no app)')}>
                            <PauseCircle className="w-3.5 h-3.5 mr-2 text-amber-500" />Pausar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-xs" onClick={() => actions.toggleFeatured(c.id, !c.is_featured)}>
                          <Star className={cn('w-3.5 h-3.5 mr-2', c.is_featured ? 'text-amber-500 fill-amber-500' : '')} />
                          {c.is_featured ? 'Remover destaque' : 'Destacar'}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs" onClick={() => handleDuplicate(c.id)}>
                          <Copy className="w-3.5 h-3.5 mr-2" />Duplicar
                        </DropdownMenuItem>
                        {status !== 'archived' && (
                          <DropdownMenuItem className="text-xs" onClick={() => setStatus(c.id, 'archived', 'Desafio arquivado')}>
                            <Archive className="w-3.5 h-3.5 mr-2" />Arquivar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-xs text-destructive focus:text-destructive" onClick={() => handleDelete(c.id, c.title)}>
                          <Trash2 className="w-3.5 h-3.5 mr-2" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Meta chips */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-primary border border-primary/10">
                      {TIER_LABEL[c.tier] ?? c.tier}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border capitalize">
                      {c.category}
                    </span>
                    <span className={cn('text-[10px] font-medium', time.className)}>· {time.label}</span>
                  </div>

                  {/* Footer stats */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground">
                    <span>{c.duration_days} dias</span>
                    <Link to={`/challenges/${c.id}/participants`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                      <Users className="w-3.5 h-3.5" />
                      {participants}
                    </Link>
                    <span className="inline-flex items-center gap-1">
                      {c.prize ? <><Trophy className="w-3 h-3 text-amber-500" />{c.prize.length > 12 ? c.prize.slice(0, 11) + '…' : c.prize}</> : 'sem prêmio'}
                    </span>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button asChild variant="outline" size="sm" className="flex-1 h-8 text-xs">
                      <Link to={`/challenges/${c.id}`}><Edit className="w-3.5 h-3.5 mr-1.5" />Editar</Link>
                    </Button>
                    {status !== 'published' ? (
                      <Button size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={() => setStatus(c.id, 'published', 'Desafio publicado')} disabled={busy}>
                        <Rocket className="w-3.5 h-3.5" />Publicar
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={() => setStatus(c.id, 'paused', 'Desafio pausado')} disabled={busy}>
                        <PauseCircle className="w-3.5 h-3.5" />Pausar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4 bg-card border border-border rounded-md">
          <Info className="w-8 h-8 text-muted-foreground mb-3" />
          <h3 className="font-semibold text-lg text-foreground">Nenhum desafio encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">Ajuste os filtros ou crie um novo desafio.</p>
        </div>
      )}

      {isFetching && !isLoading && (
        <p className="text-[11px] text-muted-foreground text-center">atualizando…</p>
      )}

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        type="challenge"
        onImport={async ({ parsedData }) => {
          try {
            const { error } = await (supabase as any).rpc('save_challenge_package', { p_payload: parsedData });
            if (error) throw error;
            toast({ title: 'Sucesso!', description: 'Desafio completo importado (hábitos, treinos e dieta).' });
            refetch();
          } catch (err: any) {
            toast({ title: 'Erro na importação', description: err.message || 'Erro desconhecido.', variant: 'destructive' });
          }
        }}
      />
    </div>
  );
}
