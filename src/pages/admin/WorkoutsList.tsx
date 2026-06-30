import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSupabaseQuery, useSupabaseMutation } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Trash2, Edit, Loader2, Dumbbell, Link as LinkIcon, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

export default function WorkoutsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [focusFilter, setFocusFilter] = useState('all');
  const { toast } = useToast();

  // Fetch workouts templates and challenge-specific plans
  const { data: workouts, isLoading, refetch } = useSupabaseQuery<any[]>(
    ['admin', 'workouts', 'list'],
    async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          challenges(id, title)
        `)
        .order('created_at', { ascending: false });
      return { data, error };
    }
  );

  // Delete workout mutation
  const deleteWorkout = useSupabaseMutation<string, null>(
    async (id) => {
      const { data, error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', id);
      return { data, error };
    },
    {
      onSuccess: () => {
        toast({
          title: "Treino excluído",
          description: "O treino foi removido com sucesso.",
        });
        refetch();
      },
      onError: (err) => {
        toast({
          title: "Erro ao excluir",
          description: err.message || "Não foi possível excluir o treino.",
          variant: "destructive",
        });
      }
    }
  );

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Tem certeza que deseja excluir o treino "${title}"? Todos os exercícios e dias vinculados serão apagados.`)) {
      deleteWorkout.mutate(id);
    }
  };

  // Filters logic
  const filteredWorkouts = workouts?.filter((w) => {
    const matchesSearch = w.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFocus = focusFilter === 'all' || w.focus === focusFilter;
    return matchesSearch && matchesFocus;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-sans">Treinos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os planos de exercícios, divisões e templates.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link to="/workouts/adaptations">
              Ver Adaptações
            </Link>
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar treino..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={focusFilter}
          onChange={(e) => setFocusFilter(e.target.value)}
          className="h-10 px-3.5 py-1.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">Todos os Focos</option>
          <option value="Hipertrofia">Hipertrofia</option>
          <option value="Força">Força</option>
          <option value="Cardio">Cardio</option>
          <option value="Volume">Volume</option>
          <option value="Queima Calórica">Queima Calórica</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground font-medium">Carregando treinos...</span>
          </div>
        ) : filteredWorkouts && filteredWorkouts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Foco</TableHead>
                <TableHead>Duração Média</TableHead>
                <TableHead>Desafio Vinculado</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkouts.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-primary/10 text-primary rounded">
                        <Dumbbell className="w-4.5 h-4.5" />
                      </div>
                      <span className="font-semibold text-foreground">{w.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{w.focus}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{w.duration_minutes} min</TableCell>
                  <TableCell>
                    {w.challenges ? (
                      <Link 
                        to={`/challenges/${w.challenges.id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary font-bold hover:underline truncate max-w-[200px]"
                      >
                        <LinkIcon className="w-3 h-3" />
                        <span>{w.challenges.title}</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Nenhum</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      w.is_template 
                        ? 'bg-blue-500/10 text-blue-500' 
                        : 'bg-secondary text-secondary-foreground'
                    }`}>
                      {w.is_template ? 'Template' : 'Personalizado'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {w.challenges ? (
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/5">
                          <Link to={`/challenges/${w.challenges.id}`} title="Editar treino no desafio">
                            <Edit className="w-4 h-4" />
                          </Link>
                        </Button>
                      ) : null}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(w.id, w.title)}
                        disabled={deleteWorkout.isPending}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/5"
                        title="Excluir treino"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Info className="w-8 h-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg text-foreground">Nenhum treino encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Crie um novo plano ou mude os filtros para buscar treinos cadastrados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
