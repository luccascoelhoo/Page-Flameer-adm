-- ============================================================================
-- Flameer Admin — Intelligence Center analytics RPCs
--
-- Each returns JSON shaped EXACTLY like the client-side fallback in
-- src/hooks/admin/useIntelligence.ts, so the frontend can prefer these
-- (via tryRpc) and only fall back to browser aggregation when absent.
--
-- Why this matters: PostgREST caps table reads at ~1000 rows, so client-side
-- aggregation silently under-counts on large bases. These functions aggregate
-- in the database and are not subject to that cap.
-- ============================================================================

-- Supporting indexes (safe if they already exist)
create index if not exists workout_logs_date_idx on public.workout_logs (date);
create index if not exists diet_logs_date_idx on public.diet_logs (date);
create index if not exists daily_habit_logs_date_idx on public.daily_habit_logs (date);
create index if not exists challenge_enrollments_challenge_idx on public.challenge_enrollments (challenge_id);
create index if not exists profiles_created_idx on public.profiles (created_at);

-- ----------------------------------------------------------------------------
-- 1. Activity timeseries + rolling engagement + totals
-- ----------------------------------------------------------------------------
create or replace function public.admin_activity_analytics(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from date := current_date - greatest(p_days - 1, 0);
  v_series jsonb;
  v_dau int; v_wau int; v_mau int;
  v_workouts int; v_diets int;
  v_habit_total int; v_habit_done int;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  with days as (
    select generate_series(v_from, current_date, interval '1 day')::date d
  ),
  w as (select date, count(*) c from workout_logs where date >= v_from group by date),
  di as (select date, count(*) c from diet_logs where date >= v_from group by date),
  h as (select date, count(*) filter (where done) c from daily_habit_logs where date >= v_from group by date),
  act as (
    select date, count(distinct user_id) u from (
      select date, user_id from workout_logs where date >= v_from
      union all select date, user_id from diet_logs where date >= v_from
      union all select date, user_id from daily_habit_logs where date >= v_from and done
    ) e group by date
  )
  select jsonb_agg(jsonb_build_object(
    'date', to_char(days.d, 'YYYY-MM-DD'),
    'workouts', coalesce(w.c, 0),
    'diets', coalesce(di.c, 0),
    'habits', coalesce(h.c, 0),
    'activeUsers', coalesce(act.u, 0)
  ) order by days.d)
  into v_series
  from days
  left join w on w.date = days.d
  left join di on di.date = days.d
  left join h on h.date = days.d
  left join act on act.date = days.d;

  select count(distinct user_id) into v_dau from (
    select user_id from workout_logs where date >= current_date - 1
    union all select user_id from diet_logs where date >= current_date - 1
    union all select user_id from daily_habit_logs where date >= current_date - 1 and done
  ) x;

  select count(distinct user_id) into v_wau from (
    select user_id from workout_logs where date >= current_date - 7
    union all select user_id from diet_logs where date >= current_date - 7
    union all select user_id from daily_habit_logs where date >= current_date - 7 and done
  ) x;

  select count(distinct user_id) into v_mau from (
    select user_id from workout_logs where date >= current_date - 30
    union all select user_id from diet_logs where date >= current_date - 30
    union all select user_id from daily_habit_logs where date >= current_date - 30 and done
  ) x;

  select count(*) into v_workouts from workout_logs where date >= v_from;
  select count(*) into v_diets from diet_logs where date >= v_from;
  select count(*), count(*) filter (where done) into v_habit_total, v_habit_done
    from daily_habit_logs where date >= v_from;

  return jsonb_build_object(
    'timeseries', coalesce(v_series, '[]'::jsonb),
    'engagement', jsonb_build_object(
      'dau', v_dau, 'wau', v_wau, 'mau', v_mau,
      'stickiness', case when v_mau = 0 then 0 else round((v_dau::numeric / v_mau) * 1000) / 10 end
    ),
    'totals', jsonb_build_object(
      'workouts', v_workouts, 'diets', v_diets,
      'habitCompletion', case when v_habit_total = 0 then 0
        else round((v_habit_done::numeric / v_habit_total) * 1000) / 10 end
    )
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Challenge funnel
-- ----------------------------------------------------------------------------
create or replace function public.admin_challenge_funnel()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_table text := 'challenge_enrollments';
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  -- The iOS app enrols into challenge_participants; prefer it when present.
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'challenge_participants'
  ) then
    v_table := 'challenge_participants';
  end if;

  execute format($q$
    with agg as (
      select
        c.id, c.title,
        count(e.*) as enrolled,
        count(e.*) filter (where e.active) as active,
        count(e.*) filter (where e.completed_at is not null) as completed,
        avg(e.current_day) filter (where e.completed_at is null and coalesce(e.current_day,0) > 0) as avg_dropoff
      from challenges c
      join %I e on e.challenge_id = c.id
      group by c.id, c.title
    )
    select jsonb_agg(jsonb_build_object(
      'id', id, 'title', title,
      'enrolled', enrolled, 'active', active, 'completed', completed,
      'completionRate', case when enrolled = 0 then 0 else round((completed::numeric / enrolled) * 1000) / 10 end,
      'avgDropoffDay', case when avg_dropoff is null then null else round(avg_dropoff) end
    ) order by enrolled desc)
    from agg
    where enrolled > 0
  $q$, v_table) into v_result;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Weekly retention cohorts
-- ----------------------------------------------------------------------------
create or replace function public.admin_retention_cohorts(p_weeks int default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  with signups as (
    select id as user_id, date_trunc('week', created_at)::date as cohort_start
    from profiles
    where created_at >= current_date - ((p_weeks + 8) * 7)
  ),
  activity as (
    select distinct user_id, date_trunc('week', date)::date as active_week from (
      select user_id, date from workout_logs where date >= current_date - ((p_weeks + 8) * 7)
      union all select user_id, date from diet_logs where date >= current_date - ((p_weeks + 8) * 7)
      union all select user_id, date from daily_habit_logs where date >= current_date - ((p_weeks + 8) * 7)
    ) e
  ),
  cohort_sizes as (
    select cohort_start, count(*) size from signups group by cohort_start
  ),
  weeks as (select generate_series(0, p_weeks - 1) as w),
  retained as (
    select s.cohort_start, w.w,
      count(distinct a.user_id) as retained
    from signups s
    cross join weeks w
    left join activity a
      on a.user_id = s.user_id
     and a.active_week = s.cohort_start + (w.w * 7)
    group by s.cohort_start, w.w
  ),
  rows as (
    select r.cohort_start, cs.size,
      jsonb_agg(
        case when cs.size = 0 then 0
        else round((r.retained::numeric / cs.size) * 1000) / 10 end
        order by r.w
      ) as retention
    from retained r
    join cohort_sizes cs on cs.cohort_start = r.cohort_start
    group by r.cohort_start, cs.size
  )
  select jsonb_agg(jsonb_build_object(
    'cohort', to_char(cohort_start, 'IYYY-"W"IW'),
    'size', size,
    'retention', retention
  ) order by cohort_start desc)
  into v_result
  from rows;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Per-user behavioural aggregates (for clustering / segment builder)
-- ----------------------------------------------------------------------------
create or replace function public.admin_user_aggregates(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from date := current_date - greatest(p_days - 1, 0);
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  with w as (select user_id, count(*) c from workout_logs where date >= v_from group by user_id),
  di as (select user_id, count(*) c from diet_logs where date >= v_from group by user_id),
  h as (
    select user_id, count(*) total, count(*) filter (where done) done
    from daily_habit_logs where date >= v_from group by user_id
  ),
  cat as (
    select distinct on (e.user_id) e.user_id, c.category
    from challenge_enrollments e
    join challenges c on c.id = e.challenge_id
    order by e.user_id, e.joined_at desc
  )
  select jsonb_agg(jsonb_build_object(
    'user_id', p.id,
    'name', coalesce(p.name, 'Sem nome'),
    'avatar_url', p.avatar_url,
    'level', coalesce(p.level, 0),
    'xp', coalesce(p.xp, 0),
    'streak', coalesce(p.streak, 0),
    'workouts', coalesce(w.c, 0),
    'diets', coalesce(di.c, 0),
    'habitsDone', coalesce(h.done, 0),
    'habitsTotal', coalesce(h.total, 0),
    'daysSinceActive', case when p.last_active_at is null then 999
      else least(999, extract(day from now() - p.last_active_at)::int) end,
    'topCategory', coalesce(cat.category, '—')
  ))
  into v_result
  from profiles p
  left join w on w.user_id = p.id
  left join di on di.user_id = p.id
  left join h on h.user_id = p.id
  left join cat on cat.user_id = p.id;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

grant execute on function public.admin_activity_analytics(int) to authenticated;
grant execute on function public.admin_challenge_funnel() to authenticated;
grant execute on function public.admin_retention_cohorts(int) to authenticated;
grant execute on function public.admin_user_aggregates(int) to authenticated;
