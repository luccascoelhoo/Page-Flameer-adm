import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { tryRpc } from '@/lib/admin/rpc';
import {
  buildActivityTimeseries,
  buildChallengeFunnel,
  buildRetentionCohorts,
  buildUserVectors,
  daysAgo,
  isoWeek,
  rollingEngagement,
  type ActivityEvent,
  type UserAggregate,
} from '@/lib/admin/analytics';

const sb = supabase as any;

/** Pull raw activity logs for a window and derive the trend + engagement. */
export function useActivityAnalytics(periodDays: number) {
  return useQuery({
    queryKey: ['admin', 'intel', 'activity', periodDays],
    queryFn: async () => {
      // Prefer the DB-side RPC (no 1000-row cap); fall back to client aggregation.
      const rpc = await tryRpc('admin_activity_analytics', { p_days: periodDays });
      if (!rpc.missing && rpc.data) return rpc.data;

      const from = daysAgo(periodDays);
      const fromIso = from.toISOString().slice(0, 10);

      const [workouts, diets, habits] = await Promise.all([
        sb.from('workout_logs').select('user_id, date').gte('date', fromIso),
        sb.from('diet_logs').select('user_id, date').gte('date', fromIso),
        sb.from('daily_habit_logs').select('user_id, date, done').gte('date', fromIso),
      ]);

      const wEvents: ActivityEvent[] = (workouts.data ?? []).map((r: any) => ({
        user_id: r.user_id,
        ts: r.date,
      }));
      const dEvents: ActivityEvent[] = (diets.data ?? []).map((r: any) => ({
        user_id: r.user_id,
        ts: r.date,
      }));
      const hEvents: ActivityEvent[] = (habits.data ?? [])
        .filter((r: any) => r.done)
        .map((r: any) => ({ user_id: r.user_id, ts: r.date }));

      const timeseries = buildActivityTimeseries(from, new Date(), wEvents, dEvents, hEvents);
      const allEvents = [...wEvents, ...dEvents, ...hEvents];
      const engagement = rollingEngagement(allEvents);

      const totalHabits = (habits.data ?? []).length;
      const doneHabits = (habits.data ?? []).filter((r: any) => r.done).length;

      return {
        timeseries,
        engagement,
        totals: {
          workouts: wEvents.length,
          diets: dEvents.length,
          habitCompletion: totalHabits ? Math.round((doneHabits / totalHabits) * 1000) / 10 : 0,
        },
      };
    },
    staleTime: 60_000,
  });
}

/** Retention cohorts by signup week. */
export function useRetentionCohorts(weeks = 8) {
  return useQuery({
    queryKey: ['admin', 'intel', 'retention', weeks],
    queryFn: async () => {
      const rpc = await tryRpc('admin_retention_cohorts', { p_weeks: weeks });
      if (!rpc.missing && rpc.data) return rpc.data;

      const horizon = daysAgo(weeks * 7 + 60).toISOString().slice(0, 10);
      const [profiles, workouts, diets, habits] = await Promise.all([
        sb.from('profiles').select('id, created_at').gte('created_at', horizon),
        sb.from('workout_logs').select('user_id, date').gte('date', horizon),
        sb.from('diet_logs').select('user_id, date').gte('date', horizon),
        sb.from('daily_habit_logs').select('user_id, date').gte('date', horizon),
      ]);

      const activityByUser = new Map<string, Set<string>>();
      const record = (rows: any[]) => {
        rows.forEach((r) => {
          if (!r.user_id || !r.date) return;
          if (!activityByUser.has(r.user_id)) activityByUser.set(r.user_id, new Set());
          activityByUser.get(r.user_id)!.add(isoWeek(r.date));
        });
      };
      record(workouts.data ?? []);
      record(diets.data ?? []);
      record(habits.data ?? []);

      const signups = (profiles.data ?? []).map((p: any) => ({
        user_id: p.id,
        created_at: p.created_at,
      }));
      return buildRetentionCohorts(signups, activityByUser, weeks);
    },
    staleTime: 300_000,
  });
}

/** Enrollment → active → completion funnel per challenge. */
export function useChallengeFunnel() {
  return useQuery({
    queryKey: ['admin', 'intel', 'funnel'],
    queryFn: async () => {
      const rpc = await tryRpc('admin_challenge_funnel');
      if (!rpc.missing && rpc.data) return rpc.data;

      const [challenges, enrollments] = await Promise.all([
        sb.from('challenges').select('id, title, duration_days'),
        sb
          .from('challenge_enrollments')
          .select('challenge_id, active, completed_at, current_day'),
      ]);
      return buildChallengeFunnel(challenges.data ?? [], enrollments.data ?? []);
    },
    staleTime: 120_000,
  });
}

/**
 * Per-user behavioural aggregates over the window — the raw material for
 * community discovery (clustering) and the segment builder.
 */
export function useUserAggregates(periodDays: number) {
  return useQuery({
    queryKey: ['admin', 'intel', 'user-aggregates', periodDays],
    queryFn: async () => {
      const rpc = await tryRpc<UserAggregate[]>('admin_user_aggregates', { p_days: periodDays });
      if (!rpc.missing && rpc.data) {
        return { aggregates: rpc.data, vectors: buildUserVectors(rpc.data) };
      }

      const from = daysAgo(periodDays);
      const fromIso = from.toISOString().slice(0, 10);

      const [profiles, workouts, diets, habits, enrollments] = await Promise.all([
        sb
          .from('profiles')
          .select('id, name, avatar_url, level, pontos, streak, last_active_at, created_at'),
        sb.from('workout_logs').select('user_id, date').gte('date', fromIso),
        sb.from('diet_logs').select('user_id, date').gte('date', fromIso),
        sb.from('daily_habit_logs').select('user_id, done, date').gte('date', fromIso),
        sb
          .from('challenge_enrollments')
          .select('user_id, challenges(category)')
          .gte('joined_at', daysAgo(periodDays + 30).toISOString()),
      ]);

      const count = (rows: any[]) => {
        const m = new Map<string, number>();
        rows.forEach((r) => m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1));
        return m;
      };
      const wMap = count(workouts.data ?? []);
      const dMap = count(diets.data ?? []);

      const habitDone = new Map<string, number>();
      const habitTotal = new Map<string, number>();
      (habits.data ?? []).forEach((r: any) => {
        habitTotal.set(r.user_id, (habitTotal.get(r.user_id) ?? 0) + 1);
        if (r.done) habitDone.set(r.user_id, (habitDone.get(r.user_id) ?? 0) + 1);
      });

      const categoryByUser = new Map<string, Map<string, number>>();
      (enrollments.data ?? []).forEach((r: any) => {
        const cat = r.challenges?.category ?? 'Outros';
        if (!categoryByUser.has(r.user_id)) categoryByUser.set(r.user_id, new Map());
        const m = categoryByUser.get(r.user_id)!;
        m.set(cat, (m.get(cat) ?? 0) + 1);
      });
      const topCat = (uid: string) => {
        const m = categoryByUser.get(uid);
        if (!m) return '—';
        return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
      };

      const now = Date.now();
      const aggregates: UserAggregate[] = (profiles.data ?? []).map((p: any) => {
        const lastActive = p.last_active_at ? new Date(p.last_active_at).getTime() : null;
        const daysSinceActive = lastActive
          ? Math.floor((now - lastActive) / 864e5)
          : 999;
        return {
          user_id: p.id,
          name: p.name ?? 'Sem nome',
          avatar_url: p.avatar_url ?? null,
          level: p.level ?? 0,
          pontos: p.pontos ?? 0,
          streak: p.streak ?? 0,
          workouts: wMap.get(p.id) ?? 0,
          diets: dMap.get(p.id) ?? 0,
          habitsDone: habitDone.get(p.id) ?? 0,
          habitsTotal: habitTotal.get(p.id) ?? 0,
          daysSinceActive,
          topCategory: topCat(p.id),
        };
      });

      return { aggregates, vectors: buildUserVectors(aggregates) };
    },
    staleTime: 120_000,
  });
}
