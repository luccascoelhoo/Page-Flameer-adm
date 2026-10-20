import React, { useMemo, useState } from 'react';
import { useConfirmar } from '@/components/admin/Confirmar';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Search,
  Trash2,
  Edit,
  Loader2,
  Dumbbell,
  Link as LinkIcon,
  Info,
  FolderOpen,
  MoreHorizontal,
  Rocket,
  PauseCircle,
  Archive,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useContentActions } from '@/hooks/admin/useContentActions';
import { STATUS_META, STATUS_TABS, statusOf, type ContentStatus } from '@/lib/admin/lifecycle';
import { cn } from '@/lib/utils';

export default function WorkoutsList() {
  const { toast } = useToast();
  const confirmar = useConfirmar();
  const actions = useContentActions('workouts');
  const [searchTerm, setSearchTerm] = useState('');
  const [focusFilter, setFocusFilter] = useState('all');
  const [statusTab, setStatusTab] = useState<ContentStatus | 'all'>('all');
  const [isImportOpen, setIsImportOpen] = useState(false);

  const { data: workouts, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'table', 'workouts', 'list'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('workouts')
        .select('*, challenges(id, title)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const rows = workouts ?? [];

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    rows.forEach((r) => {
      const s = statusOf(r, 'published');
      c[s] = (c[s] ?? 0) + 1;
    });
    return c;
  }, [rows]);

  const filtered = rows.filter((w) => {
    if (statusTab !== 'all' && statusOf(w, 'published') !== statusTab) return false;
    if (focusFilter !== 'all' && w.focus !== focusFilter) return false;
    if (searchTerm && !w.title?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const handleDelete = async (id: string, title: string) => {
    if (!await confirmar({
      titulo: 'Excluir treino?',
      descricao: `"${title}" e os exercícios e dias vinculados serão apagados.`,
      confirmar: 'Excluir', destrutivo: true,
    })) return;
    await actions.remove(id);
  };

  const setStatus = async (id: string, status: ContentStatus, label: string) => {
    if (await actions.setStatus(id, status)) toast({ title: label });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Treinos</h1>
          <p className="text-sm text-muted-foreground mt-1">{rows.length} no banco · templates e planos vinculados a desafios.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="gap-1.5 h-9 text-xs border-primary text-primary hover:bg-primary/5">
            <FolderOpen className="w-4 h-4" />
            Importar
          </Button>
          <Button variant="outline" size="sm" asChild className="text-xs h-9">
            <Link to="/workouts/adaptations">Ver Adaptações</Link>
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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar treino…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <select value={focusFilter} onChange={(e) => setFocusFilter(e.target.value)} className="h-10 px-3.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">Todos os focos</option>
          <option value="Hipertrofia">Hipertrofia</option>
          <option value="Força">Força</option>
          <option value="Cardio">Cardio</option>
          <option value="Volume">Volume</option>
          <option value="Queima Calórica">Queima Calórica</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-md overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Carregando treinos…</span>
          </div>
        ) : filtered.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Foco</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Desafio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((w) => {
                const status = statusOf(w, 'published');
                const meta = STATUS_META[status];
                const busy = actions.busyId === w.id;
                return (
                  <TableRow key={w.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-primary/10 text-primary rounded">
                          <Dumbbell className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-foreground">{w.title}</span>
                        {w.is_template && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">Template</span>}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{w.focus}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{w.duration_minutes} min</TableCell>
                    <TableCell>
                      {w.challenges ? (
                        <Link to={`/challenges/${w.challenges.id}`} className="inline-flex items-center gap-1 text-xs text-primary font-bold hover:underline truncate max-w-[180px]">
                          <LinkIcon className="w-3 h-3" />
                          <span>{w.challenges.title}</span>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Nenhum</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', meta.badge)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
                        {meta.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {w.challenges && (
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/5">
                            <Link to={`/challenges/${w.challenges.id}`} title="Editar no desafio"><Edit className="w-4 h-4" /></Link>
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
                              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {status !== 'published' && (
                              <DropdownMenuItem className="text-xs" onClick={() => setStatus(w.id, 'published', 'Treino publicado')}>
                                <Rocket className="w-3.5 h-3.5 mr-2 text-success" />Publicar
                              </DropdownMenuItem>
                            )}
                            {status === 'published' && (
                              <DropdownMenuItem className="text-xs" onClick={() => setStatus(w.id, 'paused', 'Treino pausado')}>
                                <PauseCircle className="w-3.5 h-3.5 mr-2 text-amber-500" />Pausar
                              </DropdownMenuItem>
                            )}
                            {status !== 'archived' && (
                              <DropdownMenuItem className="text-xs" onClick={() => setStatus(w.id, 'archived', 'Treino arquivado')}>
                                <Archive className="w-3.5 h-3.5 mr-2" />Arquivar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-xs text-destructive focus:text-destructive" onClick={() => handleDelete(w.id, w.title)}>
                              <Trash2 className="w-3.5 h-3.5 mr-2" />Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Info className="w-8 h-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg text-foreground">Nenhum treino encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">Ajuste os filtros ou importe um treino.</p>
          </div>
        )}
      </div>

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        type="workout"
        onImport={async ({ parsedData }) => {
          try {
            const { data: workoutData, error: wErr } = await (supabase as any)
              .from('workouts')
              .insert({
                title: parsedData.title || `Treino Importado (${new Date().toLocaleDateString('pt-BR')})`,
                duration_minutes: parsedData.duration_minutes || 45,
                focus: parsedData.focus || 'Geral',
                is_template: true,
                status: 'draft',
                metadata: parsedData.metadata || {},
              })
              .select()
              .single();
            if (wErr) throw wErr;

            if (parsedData.exercises?.length) {
              for (let ei = 0; ei < parsedData.exercises.length; ei++) {
                const ex = parsedData.exercises[ei];
                const { data: exData, error: exErr } = await (supabase as any)
                  .from('exercises')
                  .insert({
                    workout_id: workoutData.id,
                    name: ex.name,
                    muscle: ex.muscle || 'Outro',
                    rest_seconds: ex.rest_seconds || 60,
                    order_index: ei,
                    metadata: ex.metadata || {},
                  })
                  .select()
                  .single();
                if (exErr) throw exErr;

                if (ex.sets?.length) {
                  const setsToInsert = ex.sets.map((s: any, si: number) => ({
                    exercise_id: exData.id,
                    reps: String(s.reps ?? ''),
                    weight: String(s.weight ?? ''),
                    order_index: si,
                  }));
                  const { error: setsErr } = await (supabase as any).from('exercise_sets').insert(setsToInsert);
                  if (setsErr) throw setsErr;
                }
              }
            }

            if (parsedData.days?.length) {
              const daysToInsert = parsedData.days.map((day: number, i: number) => ({
                workout_id: workoutData.id,
                day_of_week: day,
                order_index: i,
              }));
              await (supabase as any).from('workout_days').insert(daysToInsert);
            }

            toast({ title: 'Sucesso!', description: 'Treino importado como rascunho — publique quando quiser.' });
            refetch();
          } catch (err: any) {
            toast({ title: 'Erro ao importar', description: err.message || 'Erro desconhecido.', variant: 'destructive' });
          }
        }}
      />
    </div>
  );
}
