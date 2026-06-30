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
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

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
        .select('*', { count: 'exact', head: true });
      return { data: count, error };
    }
  );

  // 2. Active challenges count
  const { data: challengesCount, isLoading: loadingChallenges } = useSupabaseQuery<number>(
    ['admin', 'challenges', 'count'],
    async () => {
      const { count, error } = await supabase
        .from('challenges')
        .select('*', { count: 'exact', head: true });
      return { data: count, error };
    }
  );

  // 3. Workout templates count
  const { data: workoutsCount, isLoading: loadingWorkouts } = useSupabaseQuery<number>(
    ['admin', 'workouts', 'count'],
    async () => {
      const { count, error } = await supabase
        .from('workouts')
        .select('*', { count: 'exact', head: true })
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
        .select('*', { count: 'exact', head: true })
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
          xp_gained,
          rank,
          profiles(name, avatar_url, streak)
        `)
        .eq('year', year)
        .eq('week_number', weekNumber)
        .order('xp_gained', { ascending: false })
        .limit(5);
      return { data, error };
    }
  );

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
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-sans">Dashboard</h1>
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
          <div key={i} className="bg-card border border-border rounded-xl p-6 shadow-sm transition-all duration-200 hover:shadow-md">
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
                <span className="text-3xl font-bold text-foreground tracking-tight">{stat.value}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lower Dashboard Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Recent reports */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
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
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
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
                    {/* XP gained */}
                    <div className="text-right">
                      <span className="text-xs font-bold text-foreground">{player.xp_gained} XP</span>
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
