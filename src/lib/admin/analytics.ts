/**
 * Domain analytics for the Intelligence Center.
 *
 * These are PURE functions: they take raw rows (already fetched by hooks) and
 * derive the cross-cutting metrics the operator cares about — activity trends,
 * retention cohorts, conversion funnels, and per-user behavioural feature
 * vectors used to auto-discover communities.
 *
 * Keeping them pure means the same code path works whether rows came from a
 * Supabase RPC or from client-side table scans (the graceful fallback).
 */

import { mean, pct, ratio } from './stats';
import type { FeatureVector } from './clustering';

// ─────────────────────────────────────────────────────────── date helpers ──

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export function isoDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function isoWeek(d: Date | string): string {
  const date = new Date(typeof d === 'string' ? d : d.getTime());
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const week = 1 + Math.round((firstThursday - target.getTime()) / (7 * 864e5));
  return `${new Date(firstThursday).getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function eachDay(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    out.push(isoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// ───────────────────────────────────────────────────────────────── types ──

export interface ActivityEvent {
  user_id: string;
  ts: string; // ISO timestamp or date
}

export interface ActivityPoint {
  date: string;
  workouts: number;
  diets: number;
  habits: number;
  activeUsers: number;
}

export interface RollingEngagement {
  dau: number;
  wau: number;
  mau: number;
  stickiness: number; // DAU/MAU %
}

export interface RetentionCohort {
  cohort: string; // signup week label
  size: number;
  retention: number[]; // % retained at week 0..N
}

export interface FunnelChallenge {
  id: string;
  title: string;
  enrolled: number;
  active: number;
  completed: number;
  completionRate: number;
  avgDropoffDay: number | null;
}

// ─────────────────────────────────────────────────────── activity trends ──

/** Bucket workout/diet/habit events into a per-day time series. */
export function buildActivityTimeseries(
  from: Date,
  to: Date,
  workouts: ActivityEvent[],
  diets: ActivityEvent[],
  habits: ActivityEvent[]
): ActivityPoint[] {
  const days = eachDay(from, to);
  const index = new Map<string, ActivityPoint & { _users: Set<string> }>();
  days.forEach((d) =>
    index.set(d, { date: d, workouts: 0, diets: 0, habits: 0, activeUsers: 0, _users: new Set() })
  );

  const add = (events: ActivityEvent[], field: 'workouts' | 'diets' | 'habits') => {
    events.forEach((e) => {
      if (!e.ts) return;
      const key = isoDate(e.ts);
      const point = index.get(key);
      if (!point) return;
      point[field]++;
      if (e.user_id) point._users.add(e.user_id);
    });
  };

  add(workouts, 'workouts');
  add(diets, 'diets');
  add(habits, 'habits');

  return days.map((d) => {
    const p = index.get(d)!;
    return {
      date: d,
      workouts: p.workouts,
      diets: p.diets,
      habits: p.habits,
      activeUsers: p._users.size,
    };
  });
}

/** DAU / WAU / MAU + stickiness from a flat list of activity events. */
export function rollingEngagement(events: ActivityEvent[], now = new Date()): RollingEngagement {
  const today = isoDate(now);
  const d1 = daysAgo(1);
  const d7 = daysAgo(7);
  const d30 = daysAgo(30);
  const dau = new Set<string>();
  const wau = new Set<string>();
  const mau = new Set<string>();
  events.forEach((e) => {
    if (!e.ts || !e.user_id) return;
    const t = new Date(e.ts);
    if (isoDate(t) === today || t >= d1) dau.add(e.user_id);
    if (t >= d7) wau.add(e.user_id);
    if (t >= d30) mau.add(e.user_id);
  });
  return {
    dau: dau.size,
    wau: wau.size,
    mau: mau.size,
    stickiness: pct(dau.size, mau.size),
  };
}

// ─────────────────────────────────────────────────────────────  retention ──

/**
 * Weekly retention cohorts. `signups` maps user → signup date, `activity`
 * maps user → set of active-week labels. Retention[w] = % of the cohort that
 * was active w weeks after signing up.
 */
export function buildRetentionCohorts(
  signups: { user_id: string; created_at: string }[],
  activityByUser: Map<string, Set<string>>,
  weeks = 8
): RetentionCohort[] {
  const cohorts = new Map<string, { users: string[]; created: Map<string, Date> }>();
  signups.forEach((s) => {
    if (!s.created_at) return;
    const label = isoWeek(s.created_at);
    if (!cohorts.has(label)) cohorts.set(label, { users: [], created: new Map() });
    const c = cohorts.get(label)!;
    c.users.push(s.user_id);
    c.created.set(s.user_id, new Date(s.created_at));
  });

  const result: RetentionCohort[] = [];
  Array.from(cohorts.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // newest first
    .slice(0, weeks + 4)
    .forEach(([label, c]) => {
      const retention: number[] = [];
      for (let w = 0; w < weeks; w++) {
        let retained = 0;
        c.users.forEach((u) => {
          const created = c.created.get(u)!;
          const target = new Date(created);
          target.setDate(target.getDate() + w * 7);
          const targetWeek = isoWeek(target);
          if (activityByUser.get(u)?.has(targetWeek)) retained++;
        });
        retention.push(pct(retained, c.users.length));
      }
      result.push({ cohort: label, size: c.users.length, retention });
    });
  return result;
}

// ─────────────────────────────────────────────────────────────────  funnel ──

export function buildChallengeFunnel(
  challenges: { id: string; title: string; duration_days?: number | null }[],
  enrollments: {
    challenge_id: string;
    active?: boolean | null;
    completed_at?: string | null;
    current_day?: number | null;
  }[]
): FunnelChallenge[] {
  const byChallenge = new Map<string, typeof enrollments>();
  enrollments.forEach((e) => {
    if (!byChallenge.has(e.challenge_id)) byChallenge.set(e.challenge_id, []);
    byChallenge.get(e.challenge_id)!.push(e);
  });

  return challenges
    .map((ch) => {
      const rows = byChallenge.get(ch.id) ?? [];
      const enrolled = rows.length;
      const active = rows.filter((r) => r.active).length;
      const completed = rows.filter((r) => r.completed_at).length;
      const dropoffDays = rows
        .filter((r) => !r.completed_at && (r.current_day ?? 0) > 0)
        .map((r) => r.current_day ?? 0);
      return {
        id: ch.id,
        title: ch.title,
        enrolled,
        active,
        completed,
        completionRate: pct(completed, enrolled),
        avgDropoffDay: dropoffDays.length ? Math.round(mean(dropoffDays)) : null,
      };
    })
    .filter((f) => f.enrolled > 0)
    .sort((a, b) => b.enrolled - a.enrolled);
}

// ──────────────────────────────────────────────  user behaviour vectors ──

export interface UserAggregate {
  user_id: string;
  name: string;
  avatar_url: string | null;
  level: number;
  xp: number;
  streak: number;
  workouts: number;
  diets: number;
  habitsDone: number;
  habitsTotal: number;
  daysSinceActive: number;
  topCategory: string;
}

export interface UserFacet {
  adherence: number; // 0..1 habit completion
  workoutFreq: number;
  dietFreq: number;
  streak: number;
  progression: number; // xp
  recency: number; // higher = more recent
}

/** Build normalisable feature vectors for clustering + a readable aggregate. */
export function buildUserVectors(aggregates: UserAggregate[]): FeatureVector<UserAggregate>[] {
  return aggregates.map((a) => {
    const adherence = ratio(a.habitsDone, a.habitsTotal);
    const recency = Math.max(0, 30 - Math.min(a.daysSinceActive, 30)) / 30;
    return {
      item: a,
      features: [
        adherence,
        a.workouts,
        a.diets,
        a.streak,
        a.xp,
        recency,
      ],
    };
  });
}

/** Human-readable characterisation of a cluster centroid (post-normalisation). */
export function describeCluster(members: UserAggregate[]): {
  label: string;
  traits: string[];
} {
  if (members.length === 0) return { label: 'Vazio', traits: [] };
  const adherence = mean(members.map((m) => ratio(m.habitsDone, m.habitsTotal)));
  const workouts = mean(members.map((m) => m.workouts));
  const diets = mean(members.map((m) => m.diets));
  const streak = mean(members.map((m) => m.streak));
  const recency = mean(members.map((m) => m.daysSinceActive));
  const xp = mean(members.map((m) => m.xp));

  const traits: string[] = [];
  traits.push(`Aderência ${Math.round(adherence * 100)}%`);
  traits.push(`${workouts.toFixed(1)} treinos/período`);
  traits.push(`${diets.toFixed(1)} refeições logadas`);
  traits.push(`Ofensiva média ${Math.round(streak)} dias`);

  // Heuristic labelling
  let label: string;
  if (recency > 21) label = 'Em risco de churn';
  else if (adherence > 0.7 && streak > 7) label = 'Embaixadores engajados';
  else if (workouts > diets * 1.5) label = 'Focados em treino';
  else if (diets > workouts * 1.5) label = 'Focados em nutrição';
  else if (xp < mean(members.map((m) => m.xp)) * 0.5) label = 'Iniciantes';
  else label = 'Consistentes equilibrados';

  return { label, traits };
}
