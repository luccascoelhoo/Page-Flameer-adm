import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSupabaseQuery, useSupabaseMutation } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Loader2, Check, X, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

export default function WorkoutAdaptations() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch pending adaptations
  const { data: adaptations, isLoading, refetch } = useSupabaseQuery<any[]>(
    ['admin', 'workouts', 'adaptations', 'pending'],
    async () => {
      const { data, error } = await supabase
        .from('workout_adaptations')
        .select(`
          *,
          profiles(name),
          exercises(name, workout_id, workouts(title))
        `)
        .eq('review_status', 'pending')
        .order('id', { ascending: false });
      return { data, error };
    }
  );

  // Review adaptation mutation
  const reviewAdaptation = useSupabaseMutation<any, any>(
    async ({ id, status }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const reviewerId = session?.user?.id;

      const { data, error } = await (supabase as any)
        .from('workout_adaptations')
        .update({
          review_status: status,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString()
        } as any)
        .eq('id', id);
      return { data, error };
    },
    {
      onSuccess: (_, variables) => {
        toast({
          title: variables.status === 'approved' ? "Adaptada aprovada" : "Adaptação rejeitada",
          description: `A solicitação foi avaliada com sucesso.`,
        });
        refetch();
      },
      onError: (err) => {
        toast({
          title: "Erro ao processar",
          description: err.message || "Ocorreu um erro ao salvar o status.",
          variant: "destructive",
        });
      }
    }
  );

  const handleReview = (id: string, status: 'approved' | 'rejected') => {
    reviewAdaptation.mutate({ id, status });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-9 w-9 text-muted-foreground hover:text-foreground">
          <Link to="/workouts">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-sans">Adaptações Biomecânicas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analise e responda às solicitações de substituição de exercícios por lesões ou limitações físicas.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground font-medium">Carregando solicitações...</span>
          </div>
        ) : adaptations && adaptations.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Treino</TableHead>
                <TableHead>Exercício Original</TableHead>
                <TableHead>Substituição Proposta</TableHead>
                <TableHead>Comentários do Aluno</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adaptations.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-semibold text-foreground">{a.profiles?.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm font-medium">
                    {a.exercises?.workouts?.title || 'Personalizado'}
                  </TableCell>
                  <TableCell className="font-medium text-destructive">{a.exercises?.name}</TableCell>
                  <TableCell className="font-bold text-green-600 flex items-center gap-1.5 py-4">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>{a.adapted_exercise_name}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                    {a.comments || <span className="italic text-xs">Sem comentários</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleReview(a.id, 'approved')}
                        disabled={reviewAdaptation.isPending}
                        className="h-8 gap-1 border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Aprovar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleReview(a.id, 'rejected')}
                        disabled={reviewAdaptation.isPending}
                        className="h-8 gap-1 border-destructive/20 text-destructive hover:bg-destructive/5 hover:text-destructive"
                      >
                        <X className="w-3.5 h-3.5" />
                        Recusar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <ShieldAlert className="w-8 h-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg text-foreground">Sem solicitações pendentes</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Todas as adaptações biomecânicas solicitadas pelos usuários foram revisadas e processadas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
