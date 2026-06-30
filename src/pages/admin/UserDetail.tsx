import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSupabaseQuery, useSupabaseMutation } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, 
  Loader2, 
  Flame, 
  Award, 
  User, 
  Heart, 
  Dumbbell, 
  Apple, 
  Trophy, 
  ShieldCheck,
  Calendar,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [role, setRole] = useState<'user' | 'professional' | 'admin'>('user');

  // 1. Fetch main user profile info
  const { data: profile, isLoading: loadingProfile, refetch: refetchProfile } = useSupabaseQuery<any>(
    ['admin', 'users', 'detail', id],
    async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      return { data, error };
    }
  );

  // Set local state when profile is loaded
  React.useEffect(() => {
    if (profile) {
      setRole(profile.role);
    }
  }, [profile]);

  // 2. Fetch health profile (allergies & injuries)
  const { data: healthProfile } = useSupabaseQuery<any>(
    ['admin', 'users', 'health', id],
    async () => {
      const { data, error } = await supabase
        .from('user_health_profile')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();
      return { data, error };
    }
  );

  // 3. Fetch challenge enrollments
  const { data: enrollments } = useSupabaseQuery<any[]>(
    ['admin', 'users', 'enrollments', id],
    async () => {
      const { data, error } = await supabase
        .from('challenge_enrollments')
        .select('*, challenges(title, category)')
        .eq('user_id', id)
        .order('joined_at', { ascending: false });
      return { data, error };
    }
  );

  // 4. Fetch workouts history logs
  const { data: workoutLogs } = useSupabaseQuery<any[]>(
    ['admin', 'users', 'workouts', id],
    async () => {
      const { data, error } = await supabase
        .from('workout_logs')
        .select('*, workouts(title)')
        .eq('user_id', id)
        .order('date', { ascending: false });
      return { data, error };
    }
  );

  // 5. Fetch diet logs (meal consumption history)
  const { data: dietLogs } = useSupabaseQuery<any[]>(
    ['admin', 'users', 'diets', id],
    async () => {
      const { data, error } = await supabase
        .from('diet_logs')
        .select('*, meals(name)')
        .eq('user_id', id)
        .order('date', { ascending: false });
      return { data, error };
    }
  );

  // Update role mutation
  const updateRole = useSupabaseMutation<string, any>(
    async (newRole) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole } as any)
        .eq('id', id);
      return { data, error };
    },
    {
      onSuccess: () => {
        toast({
          title: "Permissão atualizada",
          description: "O nível de acesso do usuário foi modificado no banco.",
        });
        refetchProfile();
      },
      onError: (err) => {
        toast({
          title: "Erro ao atualizar",
          description: err.message || "Falha ao gravar alteração.",
          variant: "destructive",
        });
      }
    }
  );

  const handleRoleSave = () => {
    updateRole.mutate(role);
  };

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground font-medium">Carregando detalhes do perfil...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-9 w-9 text-muted-foreground hover:text-foreground">
          <Link to="/users">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-sans">
            Ficha do Usuário
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualização completa das conquistas, limitações físicas e atividades do aluno.
          </p>
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border border-border shadow-sm">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={profile.name} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
              {profile?.name?.substring(0, 2).toUpperCase() || 'AD'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold text-foreground">{profile?.name}</h2>
            <p className="text-xs text-muted-foreground mt-1">ID: {profile?.id}</p>
            <div className="flex gap-4 mt-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                <Flame className="w-4 h-4" />
                <span>{profile?.streak} dias de fogo</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Award className="w-4 h-4 text-primary" />
                <span>Nível {profile?.level} ({profile?.xp} XP)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Access level editor */}
        <div className="flex items-end gap-3 self-start md:self-center bg-secondary/20 p-4 rounded-lg border border-border">
          <div className="space-y-1.5">
            <Label htmlFor="role-select" className="text-xs font-bold text-muted-foreground uppercase">Nível de Acesso</Label>
            <select
              id="role-select"
              value={role}
              onChange={(e: any) => setRole(e.target.value)}
              className="w-44 h-9 px-3.5 py-1.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="user">Usuário Comum</option>
              <option value="professional">Profissional / Personal</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <Button size="sm" onClick={handleRoleSave} className="gap-1 h-9" disabled={updateRole.isPending}>
            {updateRole.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="health" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-11 bg-card border border-border p-1 rounded-xl">
          <TabsTrigger value="health" className="rounded-lg gap-1.5 font-bold text-xs">
            <Heart className="w-4 h-4" />
            Saúde & Limitações
          </TabsTrigger>
          <TabsTrigger value="workouts" className="rounded-lg gap-1.5 font-bold text-xs">
            <Dumbbell className="w-4 h-4" />
            Histórico de Treinos
          </TabsTrigger>
          <TabsTrigger value="diets" className="rounded-lg gap-1.5 font-bold text-xs">
            <Apple className="w-4 h-4" />
            Histórico Alimentar
          </TabsTrigger>
          <TabsTrigger value="challenges" className="rounded-lg gap-1.5 font-bold text-xs">
            <Trophy className="w-4 h-4" />
            Desafios Inscritos
          </TabsTrigger>
        </TabsList>

        {/* HEALTH TAB */}
        <TabsContent value="health" className="mt-6 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg text-foreground border-b border-border pb-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Perfil Clínico e Biomecânico
            </h3>
            
            <div className="grid gap-6 md:grid-cols-2 mt-6">
              {/* Injuries list */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Lesões / Limitações Físicas</h4>
                {healthProfile && healthProfile.injuries && healthProfile.injuries.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {healthProfile.injuries.map((injury: string, i: number) => (
                      <span key={i} className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
                        {injury}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sem lesões relatadas.</p>
                )}
              </div>

              {/* Allergies list */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Alergias / Restrições Alimentares</h4>
                {healthProfile && healthProfile.allergies && healthProfile.allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {healthProfile.allergies.map((allergy: string, i: number) => (
                      <span key={i} className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/25">
                        {allergy}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sem alergias relatadas.</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* WORKOUTS TAB */}
        <TabsContent value="workouts" className="mt-6 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg text-foreground border-b border-border pb-3 flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-primary" />
              Treinos Concluídos (Logs)
            </h3>

            <div className="mt-6">
              {workoutLogs && workoutLogs.length > 0 ? (
                <div className="divide-y divide-border">
                  {workoutLogs.map((log, idx) => (
                    <div key={idx} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{log.workouts?.title || 'Exercício Avulso'}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(log.date).toLocaleDateString('pt-BR')} às {log.completed_at ? new Date(log.completed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--'}</span>
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-sm font-bold text-foreground">+{log.xp_gained} XP</div>
                        <div className="text-xs text-muted-foreground">Volume: {log.total_volume_kg} kg • Tempo: {Math.round(log.elapsed_seconds / 60)} min</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-10">Nenhum treino registrado pelo usuário.</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* DIETS TAB */}
        <TabsContent value="diets" className="mt-6 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg text-foreground border-b border-border pb-3 flex items-center gap-2">
              <Apple className="w-5 h-5 text-green-500" />
              Refeições Registradas (Logs)
            </h3>

            <div className="mt-6">
              {dietLogs && dietLogs.length > 0 ? (
                <div className="divide-y divide-border">
                  {dietLogs.map((log, idx) => (
                    <div key={idx} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{log.meals?.name || 'Refeição'}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(log.date).toLocaleDateString('pt-BR')} {log.consumed_at ? `às ${new Date(log.consumed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                        </p>
                      </div>
                      <div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${
                          log.consumed 
                            ? 'bg-green-500/10 text-green-500' 
                            : 'bg-destructive/10 text-destructive'
                        }`}>
                          {log.consumed ? 'Consumida' : 'Ignorada'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-10">Nenhum log alimentar registrado pelo usuário.</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* CHALLENGES TAB */}
        <TabsContent value="challenges" className="mt-6 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg text-foreground border-b border-border pb-3 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Inscrições em Desafios
            </h3>

            <div className="mt-6">
              {enrollments && enrollments.length > 0 ? (
                <div className="divide-y divide-border">
                  {enrollments.map((enroll, idx) => (
                    <div key={idx} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{enroll.challenges?.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Início: {new Date(enroll.joined_at).toLocaleDateString('pt-BR')} • Categoria: {enroll.challenges?.category}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${
                          enroll.active 
                            ? 'bg-green-500/10 text-green-500' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {enroll.active ? `Dia ${enroll.current_day}` : 'Encerrado'}
                        </span>
                        {enroll.completed_at && (
                          <div className="text-[10px] text-amber-500 font-semibold mt-1">
                            Concluído em: {new Date(enroll.completed_at).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-10">Nenhum desafio associado ao usuário.</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
