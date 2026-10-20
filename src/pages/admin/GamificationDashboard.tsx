import React, { useState, useEffect } from 'react';
import { useConfirmar } from '@/components/admin/Confirmar';
import { useSupabaseQuery, useSupabaseMutation } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { 
  Award, 
  Plus, 
  Edit,
  Trash2, 
  Loader2, 
  Trophy, 
  Calendar, 
  Sparkles,
  Award as BadgeIcon,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

// Helper to get current ISO week number and year
function getISOWeek() {
  const now = new Date();
  const target = new Date(now.valueOf());
  const dayNr = (now.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = new Date(firstThursday).getFullYear();
  return { weekNumber, year };
}

export default function GamificationDashboard() {
  const { weekNumber, year } = getISOWeek();
  const { toast } = useToast();
  const confirmar = useConfirmar();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconName, setIconName] = useState('medal');
  const [challengeId, setChallengeId] = useState('');

  // 1. Fetch weekly leaderboard rankings
  const { data: leaderboard, isLoading: loadingLeaderboard } = useSupabaseQuery<any[]>(
    ['admin', 'gamification', 'leaderboard', year, weekNumber],
    async () => {
      const { data, error } = await supabase
        .from('weekly_leaderboard')
        .select(`
          pontos_ganhos,
          rank,
          profiles(name, streak, level)
        `)
        .eq('year', year)
        .eq('week_number', weekNumber)
        .order('pontos_ganhos', { ascending: false });
      return { data, error };
    }
  );

  // 2. Fetch badges list
  const { data: badges, isLoading: loadingBadges, refetch: refetchBadges } = useSupabaseQuery<any[]>(
    ['admin', 'gamification', 'badges'],
    async () => {
      const { data, error } = await supabase
        .from('badges')
        .select(`
          *,
          challenges(id, title)
        `)
        .order('created_at', { ascending: false });
      return { data, error };
    }
  );

  // 3. Fetch challenges list (for badge form selection)
  const { data: challenges } = useSupabaseQuery<any[]>(
    ['admin', 'gamification', 'challenges'],
    async () => {
      const { data, error } = await supabase
        .from('challenges')
        .select('id, title')
        .order('title');
      return { data, error };
    }
  );

  // Reset form
  const resetForm = () => {
    setName('');
    setDescription('');
    setIconName('medal');
    setChallengeId('');
    setEditingBadge(null);
  };

  const handleEditClick = (badge: any) => {
    setEditingBadge(badge);
    setName(badge.name || '');
    setDescription(badge.description || '');
    setIconName(badge.icon_name || 'medal');
    setChallengeId(badge.challenge_id || '');
    setIsDialogOpen(true);
  };

  // Save Badge Mutation
  const saveBadge = useSupabaseMutation<any, any>(
    async (payload) => {
      const badgeData = {
        name: payload.name,
        description: payload.description || null,
        icon_name: payload.icon_name,
        challenge_id: payload.challenge_id,
      };

      if (payload.id) {
        // Update
        const { data, error } = await (supabase as any)
          .from('badges')
          .update(badgeData)
          .eq('id', payload.id);
        return { data, error };
      } else {
        // Insert
        const { data, error } = await (supabase as any)
          .from('badges')
          .insert([badgeData]);
        return { data, error };
      }
    },
    {
      onSuccess: () => {
        toast({
          title: editingBadge ? "Medalha atualizada" : "Medalha criada",
          description: "A medalha de conquista foi salva com sucesso no banco.",
        });
        setIsDialogOpen(false);
        resetForm();
        refetchBadges();
      },
      onError: (err) => {
        toast({
          title: "Erro ao salvar",
          description: err.message || "Não foi possível gravar a medalha.",
          variant: "destructive",
        });
      }
    }
  );

  // Delete Badge Mutation
  const deleteBadge = useSupabaseMutation<string, null>(
    async (badgeId) => {
      const { data, error } = await supabase
        .from('badges')
        .delete()
        .eq('id', badgeId);
      return { data, error };
    },
    {
      onSuccess: () => {
        toast({
          title: "Medalha excluída",
          description: "A conquista foi removida do banco.",
        });
        refetchBadges();
      },
      onError: (err) => {
        toast({
          title: "Erro ao excluir",
          description: err.message || "Não foi possível excluir a medalha.",
          variant: "destructive",
        });
      }
    }
  );

  const handleDelete = async (id: string, label: string) => {
    if (await confirmar({
      titulo: 'Excluir medalha?',
      descricao: `A medalha "${label}" some do catálogo de conquistas.`,
      confirmar: 'Excluir', destrutivo: true,
    })) {
      deleteBadge.mutate(id);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !challengeId) {
      toast({
        title: "Campos obrigatórios",
        description: "Título e Desafio são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    saveBadge.mutate({
      id: editingBadge?.id,
      name,
      description,
      icon_name: iconName,
      challenge_id: challengeId
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Gamificação</h1>
          <p className="text-sm text-muted-foreground mt-1">Configuração de medalhas (badges) de conquistas e visualização dos rankings semanais.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-3.5 py-1.5 bg-secondary text-secondary-foreground rounded-lg border border-border">
          <Calendar className="w-4 h-4" />
          <span>Semana {weekNumber} / {year}</span>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Columns (Leaderboard Table) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-md p-6 flex flex-col">
          <h2 className="font-bold text-lg text-foreground border-b border-border pb-3 flex items-center gap-2 mb-6">
            <Trophy className="w-5 h-5 text-amber-500" />
            Ranking Semanal Completo (Leaderboard)
          </h2>

          {loadingLeaderboard ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
              <span className="text-sm text-muted-foreground font-medium">Carregando posições...</span>
            </div>
          ) : leaderboard && leaderboard.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Posição</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="text-center">Fogo (Streak)</TableHead>
                  <TableHead className="text-right">Pontos acumulados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-bold text-foreground text-center">
                      {idx + 1}º
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-foreground">{item.profiles?.name || 'Recruta'}</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">Level {item.profiles?.level || 1}</span>
                    </TableCell>
                    <TableCell className="text-center font-bold text-amber-500">
                      {item.profiles?.streak || 0} dias
                    </TableCell>
                    <TableCell className="text-right font-bold text-foreground">
                      {item.pontos_ganhos} pts
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-16 text-muted-foreground text-sm flex-1 flex flex-col items-center justify-center">
              Nenhuma atividade registrada na leaderboard da semana atual.
            </div>
          )}
        </div>

        {/* Right Column (Badges Management) */}
        <div className="bg-card border border-border rounded-md p-6 flex flex-col">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-6">
            <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
              <BadgeIcon className="w-5 h-5 text-primary" />
              Medalhas de Conquista
            </h2>
            
            {/* Dialog trigger */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                  <Plus className="w-3.5 h-3.5" />
                  Nova Medalha
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingBadge ? 'Editar Medalha' : 'Nova Medalha'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleFormSubmit} className="space-y-4 pt-3">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="badge-name">Título da Medalha *</Label>
                    <Input
                      id="badge-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Conquistador do Deserto"
                      required
                    />
                  </div>
                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label htmlFor="badge-desc">Descrição / Como ganhar</Label>
                    <Input
                      id="badge-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ex: Conclua 100% dos hábitos por 15 dias"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Icon Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="badge-icon">Ícone (SF Symbol)</Label>
                      <Input
                        id="badge-icon"
                        value={iconName}
                        onChange={(e) => setIconName(e.target.value)}
                        placeholder="medal, star, crown"
                      />
                    </div>
                    {/* Linked Challenge */}
                    <div className="space-y-1.5">
                      <Label htmlFor="badge-challenge">Desafio Gatilho *</Label>
                      <select
                        id="badge-challenge"
                        value={challengeId}
                        onChange={(e) => setChallengeId(e.target.value)}
                        className="w-full h-10 px-3.5 py-1.5 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        required
                      >
                        <option value="">Selecione...</option>
                        {challenges?.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saveBadge.isPending}>
                      {saveBadge.isPending ? 'Salvando...' : 'Salvar Medalha'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Badges List */}
          <div className="flex-1 space-y-4">
            {loadingBadges ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : badges && badges.length > 0 ? (
              <div className="space-y-3.5 overflow-y-auto max-h-[500px] pr-2">
                {badges.map((badge) => (
                  <div key={badge.id} className="bg-secondary/25 border border-border rounded-lg p-3.5 flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground leading-tight">{badge.name}</h4>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">{badge.description || 'Sem descrição'}</p>
                        <p className="text-[9px] text-primary font-bold mt-1.5">Gatilho: {badge.challenges?.title}</p>
                      </div>
                    </div>
                    {/* Badge action buttons */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(badge)} className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/5">
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(badge.id, badge.name)}
                        disabled={deleteBadge.isPending}
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm flex flex-col items-center justify-center h-full">
                <Info className="w-8 h-8 text-muted-foreground mb-3" />
                <p>Nenhuma medalha de conquista cadastrada no sistema.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
