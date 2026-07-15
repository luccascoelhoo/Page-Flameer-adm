import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { tryRpc } from '@/lib/admin/rpc';
import { daysAgo } from '@/lib/admin/analytics';
import { computeReadiness, type DailyPoint, type ReadinessResult } from '@/lib/admin/readiness';
import type { RosterRow } from '@/lib/admin/healthBriefing';

const sb = supabase as any;

function toDailyPoint(r: any): DailyPoint {
  return {
    day: r.day,
    hrv: r.hrv != null ? Number(r.hrv) : null,
    hrvMethod: r.hrv_method ?? null,
    restingHr: r.resting_hr != null ? Number(r.resting_hr) : null,
    sleepTotalMin: r.sleep_total_min,
    timeInBedMin: r.time_in_bed_min,
    sleepDeepMin: r.sleep_deep_min,
    sleepRemMin: r.sleep_rem_min,
    srpeLoad: r.srpe_load != null ? Number(r.srpe_load) : null,
  };
}

/**
 * Roster: latest snapshot + 90d history per consented member, readiness
 * recomputed locally by the engine (source of truth) when the cached score
 * is absent. RLS already restricts rows to share_with_coach members.
 * Client-read fallback is subject to the ~1000-row PostgREST cap; the
 * RPC-backed cohort views are not.
 */
export function useHealthRoster() {
  return useQuery({
    queryKey: ['admin', 'health', 'roster'],
    staleTime: 60_000,
    queryFn: async (): Promise<{ rows: RosterRow[]; totalRows: number }> => {
      const fromIso = daysAgo(90).toISOString().slice(0, 10);
      const { data: rows, error } = await sb
        .from('user_health_daily')
        .select(
          'user_id, day, hrv, hrv_method, resting_hr, sleep_total_min, time_in_bed_min, sleep_deep_min, sleep_rem_min, srpe_load, readiness_score, readiness_band, synced_at'
        )
        .gte('day', fromIso)
        .order('day', { ascending: true })
        .limit(5000);
      if (error) throw error;

      const byUser = new Map<string, any[]>();
      (rows ?? []).forEach((r: any) => {
        if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
        byUser.get(r.user_id)!.push(r);
      });

      if (byUser.size === 0) return { rows: [], totalRows: 0 };

      const ids = [...byUser.keys()];
      const { data: profiles } = await sb
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', ids);
      const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));

      const roster: RosterRow[] = ids.map((uid) => {
        const history = byUser.get(uid)!;
        const readiness: ReadinessResult = computeReadiness(history.map(toDailyPoint));
        const p = profileMap.get(uid);
        return {
          userId: uid,
          name: p?.name ?? 'Sem nome',
          avatarUrl: p?.avatar_url ?? null,
          readiness,
          lastDay: history[history.length - 1]?.day ?? null,
        };
      });

      // worst-first: red < amber < green; unscored (baseline) go last
      const bandRank = (r: RosterRow) =>
        r.readiness.score == null ? 3 : r.readiness.band === 'red' ? 0 : r.readiness.band === 'amber' ? 1 : 2;
      roster.sort((a, b) => bandRank(a) - bandRank(b) || (a.readiness.score ?? 101) - (b.readiness.score ?? 101));

      return { rows: roster, totalRows: (rows ?? []).length };
    },
  });
}

/** Per-member 14-day readiness sparkline data derived from the roster query rows. */
export function useHealthSparklines() {
  return useQuery({
    queryKey: ['admin', 'health', 'sparklines'],
    staleTime: 60_000,
    queryFn: async () => {
      const fromIso = daysAgo(14).toISOString().slice(0, 10);
      const { data, error } = await sb
        .from('user_health_daily')
        .select('user_id, day, readiness_score, readiness_band')
        .gte('day', fromIso)
        .order('day', { ascending: true })
        .limit(5000);
      if (error) throw error;
      const byUser = new Map<string, { day: string; score: number | null; band: string | null }[]>();
      (data ?? []).forEach((r: any) => {
        if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
        byUser.get(r.user_id)!.push({
          day: r.day,
          score: r.readiness_score != null ? Number(r.readiness_score) : null,
          band: r.readiness_band,
        });
      });
      return byUser;
    },
  });
}

/** Cohort daily trend — RPC first (no row cap, small-n suppression), client fallback. */
export function useHealthTrend(periodDays: number) {
  return useQuery({
    queryKey: ['admin', 'health', 'trend', periodDays],
    staleTime: 120_000,
    queryFn: async () => {
      const rpc = await tryRpc('admin_health_activity_trend', { p_days: periodDays });
      if (!rpc.missing && rpc.data) return rpc.data;

      // Fallback: aggregate whatever rows RLS lets us read (coach-consented).
      const fromIso = daysAgo(periodDays).toISOString().slice(0, 10);
      const { data, error } = await sb
        .from('user_health_daily')
        .select('user_id, day, readiness_score, resting_hr, hrv, sleep_total_min, steps, active_energy_kcal')
        .gte('day', fromIso)
        .limit(5000);
      if (error) throw error;

      const byDay = new Map<string, any[]>();
      (data ?? []).forEach((r: any) => {
        if (!byDay.has(r.day)) byDay.set(r.day, []);
        byDay.get(r.day)!.push(r);
      });
      const avg = (rows: any[], f: string) => {
        const vals = rows.map((r) => r[f]).filter((v: any) => v != null).map(Number);
        return vals.length ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10 : null;
      };
      const timeseries = [...byDay.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([day, rows]) => ({
          date: day,
          reporting: new Set(rows.map((r) => r.user_id)).size,
          avgReadiness: avg(rows, 'readiness_score'),
          avgRestingHr: avg(rows, 'resting_hr'),
          avgHrv: avg(rows, 'hrv'),
          avgSleepMin: avg(rows, 'sleep_total_min'),
          avgSteps: avg(rows, 'steps'),
          avgActiveKcal: avg(rows, 'active_energy_kcal'),
        }));
      const users = new Set((data ?? []).map((r: any) => r.user_id));
      return {
        timeseries,
        totals: { members: users.size, reporting: users.size, avgReadiness: null },
      };
    },
  });
}

/** Cohort per-metric averages for KPI tiles — RPC first, fallback client. */
export function useHealthCohortAverages(periodDays: number) {
  return useQuery({
    queryKey: ['admin', 'health', 'cohort-averages', periodDays],
    staleTime: 120_000,
    queryFn: async () => {
      const rpc = await tryRpc('admin_health_cohort_averages', { p_days: periodDays });
      if (!rpc.missing && rpc.data) return rpc.data;

      const fromIso = daysAgo(periodDays).toISOString().slice(0, 10);
      const { data, error } = await sb
        .from('user_health_daily')
        .select('user_id, resting_hr, hrv, sleep_total_min, vo2max, readiness_score, steps, active_energy_kcal')
        .gte('day', fromIso)
        .limit(5000);
      if (error) throw error;
      const metric = (f: string) => {
        const vals = (data ?? []).map((r: any) => r[f]).filter((v: any) => v != null).map(Number);
        if (vals.length === 0) return { n: 0 };
        const avgV = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
        return { avg: Math.round(avgV * 10) / 10, n: new Set((data ?? []).filter((r: any) => r[f] != null).map((r: any) => r.user_id)).size };
      };
      return {
        metrics: {
          resting_hr: metric('resting_hr'),
          hrv: metric('hrv'),
          sleep_total_min: metric('sleep_total_min'),
          vo2max: metric('vo2max'),
          readiness_score: metric('readiness_score'),
          steps: metric('steps'),
          active_energy_kcal: metric('active_energy_kcal'),
        },
        coverage: {
          members: new Set((data ?? []).map((r: any) => r.user_id)).size,
          reporting: new Set((data ?? []).map((r: any) => r.user_id)).size,
          pctReporting: null,
        },
      };
    },
  });
}

/** Named member drill-down — RPC (consent-checked + audited) with client fallback. */
export function useUserHealthSnapshot(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'health', 'snapshot', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const rpc = await tryRpc('admin_health_user_snapshot', { p_user: userId });
      if (!rpc.missing) {
        if (rpc.error) throw rpc.error;
        return rpc.data;
      }

      // Fallback: direct reads (RLS still enforces coach consent).
      const fromIso = daysAgo(60).toISOString().slice(0, 10);
      const [profile, series, sleep, prescribed, watch] = await Promise.all([
        sb.from('profiles').select('id, name, avatar_url').eq('id', userId).single(),
        sb
          .from('user_health_daily')
          // explicit columns (never '*'): keeps sensitive additions out of
          // coach-facing reads by default
          .select(
            'day, readiness_score, readiness_band, readiness_flags, resting_hr, hrv, hrv_method, vo2max, respiratory_rate, spo2, sleep_total_min, time_in_bed_min, sleep_deep_min, sleep_rem_min, sleep_efficiency, steps, active_energy_kcal, srpe_load, synced_at'
          )
          .eq('user_id', userId)
          .gte('day', fromIso)
          .order('day', { ascending: true }),
        sb
          .from('user_sleep_sessions')
          .select('day, start_at, end_at, segments, deep_min, rem_min, core_min, awake_min')
          .eq('user_id', userId)
          .order('day', { ascending: false })
          .limit(1),
        sb
          .from('workout_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('date', daysAgo(30).toISOString().slice(0, 10)),
        sb
          .from('user_hk_workouts')
          .select('duration_sec')
          .eq('user_id', userId)
          .gte('day', daysAgo(30).toISOString().slice(0, 10)),
      ]);

      const rows = series.data ?? [];
      if (!profile.data) throw new Error('membro não encontrado ou sem consentimento');
      const latest = rows[rows.length - 1] ?? null;
      return {
        user: { user_id: profile.data.id, name: profile.data.name, avatar_url: profile.data.avatar_url },
        latest,
        series: rows,
        lastSleep: sleep.data?.[0] ?? null,
        adherence: {
          prescribedDone30d: prescribed.count ?? 0,
          watchRecorded30d: (watch.data ?? []).length,
          watchMinutes30d: Math.round(
            (watch.data ?? []).reduce((a: number, w: any) => a + (w.duration_sec ?? 0), 0) / 60
          ),
        },
        lastSync: latest?.synced_at ?? null,
      };
    },
  });
}
