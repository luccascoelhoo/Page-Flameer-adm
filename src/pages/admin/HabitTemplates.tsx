import React, { useState, useEffect } from 'react';
import { useSupabaseQuery, useSupabaseMutation } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { 
  Trophy, 
  Plus, 
  Trash2, 
  Edit, 
  Loader2, 
  Activity, 
  Settings, 
  Sparkles,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface HabitFormState {
  id?: string;
  label: string;
  icon_name: string;
  color: string;
  kind: 'units' | 'quantity' | 'single';
  unit: string;
  target: number;
}

export default function HabitTemplates() {
  const { toast } = useToast();
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitFormState | null>(null);

  // Form State
  const [label, setLabel] = useState('');
  const [iconName, setIconName] = useState('flame');
  const [color, setColor] = useState('#6B1D2F');
  const [kind, setKind] = useState<'units' | 'quantity' | 'single'>('single');
  const [unit, setUnit] = useState('');
  const [target, setTarget] = useState(1);

  // Fetch challenges for selection
  const { data: challenges, isLoading: loadingChallenges } = useSupabaseQuery<any[]>(
    ['admin', 'habits', 'challenges'],
    async () => {
      const { data, error } = await supabase
        .from('challenges')
        .select('id, title')
        .order('title');
      return { data, error };
    }
  );

  // Set initial selected challenge once challenges are loaded
  useEffect(() => {
    if (challenges && challenges.length > 0 && !selectedChallengeId) {
      setSelectedChallengeId(challenges[0].id);
    }
  }, [challenges, selectedChallengeId]);

  // Fetch habit templates linked to selected challenge
  const { data: habits, isLoading: loadingHabits, refetch } = useSupabaseQuery<any[]>(
    ['admin', 'habits', 'by-challenge', selectedChallengeId],
    async () => {
      if (!selectedChallengeId) return { data: [], error: null };
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('challenge_id', selectedChallengeId);
      return { data, error };
    },
    { enabled: !!selectedChallengeId }
  );

  // Reset form helper
  const resetForm = () => {
    setLabel('');
    setIconName('flame');
    setColor('#6B1D2F');
    setKind('single');
    setUnit('');
    setTarget(1);
    setEditingHabit(null);
  };

  const handleEditClick = (habit: any) => {
    setEditingHabit({
      id: habit.id,
      label: habit.label,
      icon_name: habit.icon_name,
      color: habit.color,
      kind: habit.kind,
      unit: habit.unit || '',
      target: Number(habit.target) || 1
    });
    setLabel(habit.label);
    setIconName(habit.icon_name);
    setColor(habit.color);
    setKind(habit.kind);
    setUnit(habit.unit || '');
    setTarget(Number(habit.target) || 1);
    setIsDialogOpen(true);
  };

  // Create/Update Habit Template Mutation
  const saveHabit = useSupabaseMutation<any, any>(
    async (payload) => {
      const { data: { session } } = await supabase.auth.getSession();
      const adminUserId = session?.user?.id;
      if (!adminUserId) throw new Error("Sessão admin expirada.");

      const habitData = {
        user_id: adminUserId,
        challenge_id: selectedChallengeId,
        is_locked_by_challenge: true,
        label: payload.label,
        icon_name: payload.icon_name,
        color: payload.color,
        kind: payload.kind,
        unit: payload.kind !== 'single' ? payload.unit || null : null,
        target: payload.kind !== 'single' ? Number(payload.target) : 1.0,
      };

      if (payload.id) {
        // Update
        const { data, error } = await supabase
          .from('habits')
          .update(habitData)
          .eq('id', payload.id);
        return { data, error };
      } else {
        // Insert
        const { data, error } = await supabase
          .from('habits')
          .insert([habitData]);
        return { data, error };
      }
    },
    {
      onSuccess: () => {
        toast({
          title: editingHabit ? "Hábito atualizado" : "Hábito criado",
          description: "O modelo de hábito foi salvo com sucesso.",
        });
        setIsDialogOpen(false);
        resetForm();
        refetch();
      },
      onError: (err) => {
        toast({
          title: "Erro ao salvar",
          description: err.message || "Falha ao gravar hábito no banco.",
          variant: "destructive",
        });
      }
    }
  );

  // Delete Habit Template Mutation
  const deleteHabit = useSupabaseMutation<string, null>(
    async (habitId) => {
      const { data, error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId);
      return { data, error };
    },
    {
      onSuccess: () => {
        toast({
          title: "Hábito removido",
          description: "O modelo foi excluído do desafio.",
        });
        refetch();
      },
      onError: (err) => {
        toast({
          title: "Erro ao excluir",
          description: err.message || "Não foi possível excluir o hábito.",
          variant: "destructive",
        });
      }
    }
  );

  const handleDelete = (id: string, label: string) => {
    if (confirm(`Excluir o hábito-modelo "${label}" deste desafio?`)) {
      deleteHabit.mutate(id);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label) return;

    saveHabit.mutate({
      id: editingHabit?.id,
      label,
      icon_name: iconName,
      color,
      kind,
      unit,
      target
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-sans">Modelos de Hábitos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre os hábitos que serão cobrados e injetados na lista dos usuários ao entrarem em cada desafio.
          </p>
        </div>
        
        {/* Dialog for adding */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0" disabled={!selectedChallengeId}>
              <Plus className="w-4 h-4" />
              Novo Hábito Modelo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingHabit ? 'Editar Hábito Modelo' : 'Novo Hábito Modelo'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleFormSubmit} className="space-y-5 pt-3">
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="label">Título / Meta do Hábito *</Label>
                <Input
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex: Beber água, Passos diários"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Kind */}
                <div className="space-y-1.5">
                  <Label htmlFor="kind">Tipo</Label>
                  <select
                    id="kind"
                    value={kind}
                    onChange={(e: any) => setKind(e.target.value)}
                    className="w-full h-10 px-3.5 py-1.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="single">Marcador Simples</option>
                    <option value="units">Por Unidades</option>
                    <option value="quantity">Quantidade Livre</option>
                  </select>
                </div>
                {/* Icon key */}
                <div className="space-y-1.5">
                  <Label htmlFor="icon_name">Ícone (SF Symbol)</Label>
                  <Input
                    id="icon_name"
                    value={iconName}
                    onChange={(e) => setIconName(e.target.value)}
                    placeholder="flame, water, heart"
                  />
                </div>
              </div>

              {/* Targets (only for non-single) */}
              {kind !== 'single' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="target">Meta Diária</Label>
                    <Input
                      id="target"
                      type="number"
                      value={target}
                      onChange={(e) => setTarget(Number(e.target.value))}
                      min={0.1}
                      step="any"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="unit">Unidade de Medida</Label>
                    <Input
                      id="unit"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="Ex: copos, passos, km"
                    />
                  </div>
                </div>
              )}

              {/* Color */}
              <div className="space-y-1.5">
                <Label htmlFor="color">Cor Principal (Hex)</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#6B1D2F"
                  />
                  <input
                    type="color"
                    value={color.startsWith('#') ? color : '#6B1D2F'}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 rounded border border-border p-1 bg-background cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveHabit.isPending}>
                  {saveHabit.isPending ? 'Salvando...' : 'Salvar Hábito'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Select Challenge Selector */}
      <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-5 shadow-sm">
        <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
        <Label htmlFor="challenge-select" className="font-semibold text-sm text-foreground shrink-0">Selecione o Desafio:</Label>
        {loadingChallenges ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : (
          <select
            id="challenge-select"
            value={selectedChallengeId}
            onChange={(e) => setSelectedChallengeId(e.target.value)}
            className="flex-1 max-w-md h-10 px-3.5 py-1.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {challenges?.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}
      </div>

      {/* Habit Grid list */}
      <div className="space-y-4">
        <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
          <Activity className="w-4.5 h-4.5 text-primary" />
          Hábitos Injetados no Desafio
        </h2>

        {loadingHabits ? (
          <div className="flex items-center justify-center py-20 bg-card border border-border rounded-xl">
            <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground font-medium">Carregando hábitos do desafio...</span>
          </div>
        ) : habits && habits.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {habits.map((h) => (
              <div 
                key={h.id} 
                className="bg-card border border-border rounded-xl p-5 shadow-sm relative flex flex-col justify-between hover:shadow-md transition-all duration-200"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    {/* Color badge & Label */}
                    <div 
                      className="w-4 h-4 rounded-full border border-black/10 shrink-0" 
                      style={{ backgroundColor: h.color || '#6B1D2F' }}
                    />
                    <span className="font-bold text-foreground text-sm leading-tight">{h.label}</span>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div>Tipo: <span className="font-semibold text-foreground capitalize">{h.kind}</span></div>
                    {h.kind !== 'single' && (
                      <div>Meta: <span className="font-semibold text-foreground">{h.target} {h.unit}</span></div>
                    )}
                    <div>Ícone: <span className="font-mono text-[10px] text-foreground">{h.icon_name}</span></div>
                  </div>
                </div>

                {/* Footer action buttons */}
                <div className="flex justify-end gap-1.5 mt-4 pt-3 border-t border-border/50">
                  <Button variant="ghost" size="icon" onClick={() => handleEditClick(h)} className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/5">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDelete(h.id, h.label)}
                    disabled={deleteHabit.isPending}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/5"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-xl px-4">
            <Info className="w-8 h-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg text-foreground">Sem hábitos associados</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Os usuários que participarem deste desafio não terão nenhum hábito automático cobrado. Clique em "Novo Hábito" para cadastrar um.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
