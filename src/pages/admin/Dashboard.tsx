import React from 'react';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Trophy, 
  Dumbbell, 
  AlertTriangle,
  Award,
  Loader2,
  Calendar,
  ShieldAlert,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';

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

export default function Dashboard() {
  const { weekNumber, year } = getISOWeek();

  // 1. Total active users count
  const { data: usersCount, isLoading: loadingUsers } = useSupabaseQuery<number>(
    ['admin', 'users', 'count'],
    async () => {
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      return { data: count, error };
    }
  );

  // 2. Active challenges count
  const { data: challengesCount, isLoading: loadingChallenges } = useSupabaseQuery<number>(
    ['admin', 'challenges', 'count'],
    async () => {
      const { count, error } = await supabase
        .from('challenges')
        .select('id', { count: 'exact', head: true });
      return { data: count, error };
    }
  );

  // 3. Workout templates count
  const { data: workoutsCount, isLoading: loadingWorkouts } = useSupabaseQuery<number>(
    ['admin', 'workouts', 'count'],
    async () => {
      const { count, error } = await supabase
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('is_template', true);
      return { data: count, error };
    }
  );

  // 4. Pending reports count
  const { data: reportsCount, isLoading: loadingReports } = useSupabaseQuery<number>(
    ['admin', 'reports', 'count'],
    async () => {
      const { count, error } = await supabase
        .from('user_reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      return { data: count, error };
    }
  );

  // 5. Recent pending reports list
  const { data: recentReports, isLoading: loadingRecentReports } = useSupabaseQuery<any[]>(
    ['admin', 'reports', 'recent'],
    async () => {
      const { data, error } = await supabase
        .from('user_reports')
        .select(`
          id,
          reason,
          created_at,
          profiles!user_reports_reporter_id_fkey(name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);
      return { data, error };
    }
  );

  // 6. Top leaderboard players of current week
  const { data: topPlayers, isLoading: loadingLeaderboard } = useSupabaseQuery<any[]>(
    ['admin', 'leaderboard', 'top', year, weekNumber],
    async () => {
      const { data, error } = await supabase
        .from('weekly_leaderboard')
        .select(`
          pontos_ganhos,
          rank,
          profiles(name, avatar_url, streak)
        `)
        .eq('year', year)
        .eq('week_number', weekNumber)
        .order('pontos_ganhos', { ascending: false })
        .limit(5);
      return { data, error };
    }
  );

  // 7. Fetch workout logs timestamps for peak hours analysis (last 30 days)
  const { data: allWorkoutLogs } = useSupabaseQuery<any[]>(
    ['admin', 'analytics', 'workout-logs'],
    async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await (supabase as any)
        .from('workout_logs')
        .select('completed_at')
        .gte('completed_at', thirtyDaysAgo.toISOString());
      return { data, error };
    }
  );

  // 8. Fetch diet logs timestamps for peak hours analysis (last 30 days)
  const { data: allDietLogs } = useSupabaseQuery<any[]>(
    ['admin', 'analytics', 'diet-logs'],
    async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await (supabase as any)
        .from('diet_logs')
        .select('consumed_at')
        .gte('created_at', thirtyDaysAgo.toISOString());
      return { data, error };
    }
  );

  // 9. Fetch challenge enrollments categories for user segments (last 30 days)
  const { data: segmentEnrollments } = useSupabaseQuery<any[]>(
    ['admin', 'analytics', 'segments'],
    async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await (supabase as any)
        .from('challenge_enrollments')
        .select('*, challenges(category)')
        .gte('joined_at', thirtyDaysAgo.toISOString());
      return { data, error };
    }
  );

  // 9b. Fetch profiles cohort groups (recent profiles - last 60 days)
  const { data: cohortProfiles } = useSupabaseQuery<any[]>(
    ['admin', 'analytics', 'cohort_groups'],
    async () => {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const { data, error } = await supabase
        .from('profiles')
        .select('cohort_group')
        .gte('created_at', sixtyDaysAgo.toISOString());
      return { data, error };
    }
  );

  // 10. Fetch adapted exercises for top obstacles list (last 30 days)
  const { data: adaptations } = useSupabaseQuery<any[]>(
    ['admin', 'analytics', 'adaptations'],
    async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await (supabase as any)
        .from('workout_adaptations')
        .select('*, exercises(name)')
        .gte('created_at', thirtyDaysAgo.toISOString());
      return { data, error };
    }
  );

  // 11. Fetch daily habit logs consistency (last 30 days)
  const { data: habitLogsConsistency } = useSupabaseQuery<any[]>(
    ['admin', 'analytics', 'habits-consistency'],
    async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await (supabase as any)
        .from('daily_habit_logs')
        .select('done')
        .gte('created_at', thirtyDaysAgo.toISOString());
      return { data, error };
    }
  );

  // Memoized process data for peak hours
  const peakHoursData = React.useMemo(() => {
    const buckets = [
      { name: 'Madrugada (0h-6h)', acessos: 0 },
      { name: 'Manhã (6h-12h)', acessos: 0 },
      { name: 'Tarde (12h-18h)', acessos: 0 },
      { name: 'Noite (18h-24h)', acessos: 0 }
    ];

    if (allWorkoutLogs) {
      allWorkoutLogs.forEach((log) => {
        if (log.completed_at) {
          const hour = new Date(log.completed_at).getHours();
          if (hour >= 0 && hour < 6) buckets[0].acessos++;
          else if (hour >= 6 && hour < 12) buckets[1].acessos++;
          else if (hour >= 12 && hour < 18) buckets[2].acessos++;
          else buckets[3].acessos++;
        }
      });
    }

    if (allDietLogs) {
      allDietLogs.forEach((log) => {
        if (log.consumed_at) {
          const hour = new Date(log.consumed_at).getHours();
          if (hour >= 0 && hour < 6) buckets[0].acessos++;
          else if (hour >= 6 && hour < 12) buckets[1].acessos++;
          else if (hour >= 12 && hour < 18) buckets[2].acessos++;
          else buckets[3].acessos++;
        }
      });
    }

    return buckets;
  }, [allWorkoutLogs, allDietLogs]);

  // Memoized process data for user segments (coortes)
  const segmentsData = React.useMemo(() => {
    const counts: Record<string, number> = {
      'Treino': 0,
      'Nutrição': 0,
      'Mente': 0,
      'Outros': 0
    };

    if (segmentEnrollments) {
      segmentEnrollments.forEach((enroll) => {
        const cat = enroll.challenges?.category || 'Outros';
        counts[cat] = (counts[cat] || 0) + 1;
      });
    }

    // Burgundy / Beige themes
    const COLORS = ['#800020', '#D2B48C', '#E6C229', '#708090'];
    return Object.keys(counts).map((key, idx) => ({
      name: key,
      value: counts[key],
      color: COLORS[idx % COLORS.length]
    })).filter(item => item.value > 0);
  }, [segmentEnrollments]);

  // Memoized process data for user cohort groups
  const cohortGroupsData = React.useMemo(() => {
    const counts: Record<string, number> = {
      'Emagrecimento': 0,
      'Hipertrofia': 0,
      'Bem-Estar': 0,
      'Não Definido': 0
    };

    if (cohortProfiles) {
      cohortProfiles.forEach((profile) => {
        const group = profile.cohort_group || 'Não Definido';
        counts[group] = (counts[group] || 0) + 1;
      });
    }

    const COLORS = ['#FF6B00', '#007AFF', '#34C759', '#8E8E93'];
    return Object.keys(counts).map((key, idx) => ({
      name: key,
      value: counts[key],
      color: COLORS[idx % COLORS.length]
    })).filter(item => item.value > 0);
  }, [cohortProfiles]);

  // Memoized consistency metrics
  const consistencyMetrics = React.useMemo(() => {
    if (!habitLogsConsistency || habitLogsConsistency.length === 0) return 0;
    const completed = habitLogsConsistency.filter(l => l.done).length;
    return Math.round((completed / habitLogsConsistency.length) * 100);
  }, [habitLogsConsistency]);

  // Memoized top adapted exercises
  const topAdaptedExercises = React.useMemo(() => {
    const counts: Record<string, number> = {};
    if (adaptations) {
      adaptations.forEach((a) => {
        const name = a.exercises?.name || 'Exercício';
        counts[name] = (counts[name] || 0) + 1;
      });
    }
    return Object.keys(counts)
      .map(name => ({ name, count: counts[name] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [adaptations]);

  const stats = [
    { title: 'Usuários Ativos', value: usersCount ?? 0, icon: Users, loading: loadingUsers, color: 'text-blue-500 bg-blue-500/10' },
    { title: 'Desafios Ativos', value: challengesCount ?? 0, icon: Trophy, loading: loadingChallenges, color: 'text-amber-500 bg-amber-500/10' },
    { title: 'Treinos (Templates)', value: workoutsCount ?? 0, icon: Dumbbell, loading: loadingWorkouts, color: 'text-green-500 bg-green-500/10' },
    { title: 'Denúncias Pendentes', value: reportsCount ?? 0, icon: AlertTriangle, loading: loadingReports, color: 'text-destructive bg-destructive/10' },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão integrada das operações do Flameer.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-3.5 py-1.5 bg-secondary text-secondary-foreground rounded-lg border border-border">
          <Calendar className="w-4 h-4" />
          <span>Semana ISO {weekNumber} / {year}</span>
        </div>
      </div>

      {/* Stats Summary Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-card border border-border rounded-md p-6 transition-all duration-200 hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stat.title}</span>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              {stat.loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <span className="text-2xl font-bold text-foreground tracking-tight">{stat.value}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Analytics & Segmentos Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Peak Hours accesses */}
        <div className="bg-card border border-border rounded-md p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-foreground uppercase tracking-wider mb-1">Horários de Pico de Acesso</h3>
            <p className="text-xs text-muted-foreground mb-4">Acessos com base em treinos e alimentação.</p>
          </div>
          <div className="h-44 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHoursData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                <XAxis dataKey="name" stroke="#888" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#888" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(128,0,32,0.05)' }} contentStyle={{ background: '#1c1c1c', border: '1px solid #333', borderRadius: '8px', fontSize: '10px' }} />
                <Bar dataKey="acessos" fill="#800020" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User cohorts/segments */}
        <div className="bg-card border border-border rounded-md p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-foreground uppercase tracking-wider mb-1">Segmentação por Coortes</h3>
            <p className="text-xs text-muted-foreground mb-4">Distribuição de alunos por grupo do questionário.</p>
          </div>
          <div className="h-44 w-full relative flex items-center justify-center">
            {cohortGroupsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cohortGroupsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {cohortGroupsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1c1c1c', border: '1px solid #333', borderRadius: '8px', fontSize: '10px' }} />
                  <Legend verticalAlign="bottom" height={36} iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '9px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-muted-foreground italic text-center">Nenhum dado cadastrado.</div>
            )}
          </div>
        </div>

        {/* Consistency metrics & biomechanics pain points */}
        <div className="bg-card border border-border rounded-md p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-foreground uppercase tracking-wider mb-1">Indicadores Operacionais</h3>
            <p className="text-xs text-muted-foreground mb-4">Consistência e dificuldades observadas.</p>
          </div>
          <div className="space-y-4">
            {/* Completion rate progress */}
            <div className="bg-secondary/15 p-3 rounded-lg border border-border">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-foreground">Taxa de Hábito Concluído</span>
                <span className="font-bold text-primary">{consistencyMetrics}%</span>
              </div>
              <div className="w-full bg-secondary h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${consistencyMetrics}%` }} />
              </div>
            </div>

            {/* Top biomechanics pain points (adapted exercises) */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Treinos: Top Exercícios Adaptados
              </h4>
              {topAdaptedExercises.length > 0 ? (
                <div className="space-y-1.5">
                  {topAdaptedExercises.map((ex, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-secondary/10 px-2.5 py-1 rounded border border-border/40">
                      <span className="font-medium text-foreground truncate max-w-[170px]">{ex.name}</span>
                      <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">{ex.count} adaptações</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">Nenhuma adaptação biomecânica pendente.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lower Dashboard Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Recent reports */}
        <div className="lg:col-span-2 bg-card border border-border rounded-md p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              <h2 className="font-bold text-lg text-foreground">Denúncias Pendentes</h2>
            </div>
            <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs text-primary font-semibold hover:text-primary">
              <Link to="/community">
                Ver Todas
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>

          <div className="flex-1 space-y-4">
            {loadingRecentReports ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentReports && recentReports.length > 0 ? (
              <div className="divide-y divide-border">
                {recentReports.map((report) => (
                  <div key={report.id} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{report.reason}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Por: <span className="font-semibold text-foreground">{(report.profiles as any)?.name || 'Anônimo'}</span> • {new Date(report.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive uppercase tracking-wider">Pendente</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhuma denúncia pendente. Tudo limpo! 🎉
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Leaderboard top list */}
        <div className="bg-card border border-border rounded-md p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border">
            <Award className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-lg text-foreground">Leaderboard da Semana</h2>
          </div>

          <div className="flex-1 space-y-4">
            {loadingLeaderboard ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : topPlayers && topPlayers.length > 0 ? (
              <div className="space-y-4">
                {topPlayers.map((player, idx) => (
                  <div key={idx} className="flex items-center gap-3.5">
                    {/* Rank indicator */}
                    <div className="w-6 text-center font-bold text-sm text-muted-foreground">
                      {idx + 1}º
                    </div>
                    {/* Avatar */}
                    <Avatar className="w-8 h-8 border border-border">
                      {player.profiles?.avatar_url ? (
                        <AvatarImage src={player.profiles.avatar_url} alt={player.profiles.name} />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                        {player.profiles?.name?.substring(0, 2).toUpperCase() || 'AD'}
                      </AvatarFallback>
                    </Avatar>
                    {/* Profile detail */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{player.profiles?.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Fogo: {player.profiles?.streak || 0} dias</p>
                    </div>
                    {/* pontos ganhos */}
                    <div className="text-right">
                      <span className="text-xs font-bold text-foreground">{player.pontos_ganhos} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhuma pontuação registrada esta semana.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
