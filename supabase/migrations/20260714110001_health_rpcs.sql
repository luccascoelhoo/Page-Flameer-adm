-- ============================================================================
-- Flameer Health — admin aggregation RPCs
--
-- All SECURITY DEFINER + is_admin()-gated, returning jsonb shaped exactly
-- like the client fallback in src/hooks/admin/useHealth.ts (tryRpc pattern).
--
-- Privacy rules enforced here (not in the client):
--  * Cohort RPCs include only members with allow_cohort_anon = true AND
--    revoked_at IS NULL, return aggregates only (no user_id/name), and apply
--    small-n suppression: any day/bucket with < 5 reporters returns counts
--    nulled, so a lone member is never re-identifiable.
--  * The per-user snapshot additionally requires that member's
--    share_with_coach consent, hides wrist temperature (a menstrual-cycle
--    proxy) unless share_sensitive, and audit-logs the view server-side.
--  * Timezone note: `day` is device-local; server current_date is UTC. Edges
--    can drift ±1 day for non-UTC members — accepted for v1, and "today"
--    reads prefer each user's latest row over a hard current_date match.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Cohort daily trend
-- ----------------------------------------------------------------------------
create or replace function public.admin_health_activity_trend(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from date := current_date - greatest(p_days - 1, 0);
  v_series jsonb;
  v_members int;
  v_reporting int;
  v_avg_readiness numeric;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  with cohort as (
    select user_id from user_health_consent
    where allow_cohort_anon and revoked_at is null
  ),
  daily as (
    select d.day,
      count(distinct d.user_id) as reporting,
      avg(d.readiness_score)    as avg_readiness,
      avg(d.resting_hr)         as avg_rhr,
      avg(d.hrv)                as avg_hrv,
      avg(d.sleep_total_min)    as avg_sleep,
      avg(d.steps)              as avg_steps,
      avg(d.active_energy_kcal) as avg_kcal
    from user_health_daily d
    join cohort c on c.user_id = d.user_id
    where d.day >= v_from
    group by d.day
  )
  select jsonb_agg(jsonb_build_object(
    'date', to_char(day, 'YYYY-MM-DD'),
    'reporting', reporting,
    -- small-n suppression: below 5 reporters the averages are withheld
    'avgReadiness', case when reporting >= 5 then round(avg_readiness::numeric, 1) end,
    'avgRestingHr', case when reporting >= 5 then round(avg_rhr::numeric, 1) end,
    'avgHrv',       case when reporting >= 5 then round(avg_hrv::numeric, 1) end,
    'avgSleepMin',  case when reporting >= 5 then round(avg_sleep::numeric, 0) end,
    'avgSteps',     case when reporting >= 5 then round(avg_steps::numeric, 0) end,
    'avgActiveKcal',case when reporting >= 5 then round(avg_kcal::numeric, 0) end
  ) order by day)
  into v_series
  from daily;

  select count(*) into v_members from user_health_consent
    where allow_cohort_anon and revoked_at is null;

  select count(distinct d.user_id), avg(d.readiness_score)
    into v_reporting, v_avg_readiness
    from user_health_daily d
    join user_health_consent c on c.user_id = d.user_id
      and c.allow_cohort_anon and c.revoked_at is null
    where d.day >= v_from;

  return jsonb_build_object(
    'timeseries', coalesce(v_series, '[]'::jsonb),
    'totals', jsonb_build_object(
      'members', v_members,
      'reporting', coalesce(v_reporting, 0),
      'avgReadiness', case when coalesce(v_reporting,0) >= 5
        then round(v_avg_readiness::numeric, 1) end
    )
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Readiness distribution (latest row per member within a 3-day window,
--    tolerant of tz drift and missed syncs)
-- ----------------------------------------------------------------------------
create or replace function public.admin_health_readiness_distribution(p_day date default current_date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_buckets jsonb;
  v_hist jsonb;
  v_reporting int;
  v_total int;
  v_avg numeric;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  with cohort as (
    select user_id from user_health_consent
    where allow_cohort_anon and revoked_at is null
  ),
  latest as (
    select distinct on (d.user_id) d.user_id, d.readiness_score, d.readiness_band
    from user_health_daily d
    join cohort c on c.user_id = d.user_id
    where d.day between p_day - 2 and p_day
      and d.readiness_score is not null
    order by d.user_id, d.day desc
  )
  select
    count(*),
    avg(readiness_score),
    jsonb_agg_bands.j,
    jsonb_hist.j
  into v_reporting, v_avg, v_buckets, v_hist
  from latest
  cross join lateral (
    select jsonb_agg(x) as j from (
      select jsonb_build_object('band', readiness_band, 'n', count(*)) as x
      from latest group by readiness_band
    ) b
  ) jsonb_agg_bands
  cross join lateral (
    select jsonb_agg(x order by bin) as j from (
      select (floor(readiness_score / 10) * 10)::int as bin,
             jsonb_build_object('bin', (floor(readiness_score / 10) * 10)::int, 'n', count(*)) as x
      from latest group by 1
    ) h
  ) jsonb_hist;

  select count(*) into v_total from user_health_consent
    where allow_cohort_anon and revoked_at is null;

  -- small-n suppression: with < 5 reporters even band counts could
  -- re-identify a member alongside the named roster — withhold buckets.
  if coalesce(v_reporting, 0) < 5 then
    return jsonb_build_object(
      'day', to_char(p_day, 'YYYY-MM-DD'),
      'reporting', coalesce(v_reporting, 0),
      'total', v_total,
      'suppressed', true,
      'buckets', null, 'histogram', null, 'cohortAvg', null
    );
  end if;

  return jsonb_build_object(
    'day', to_char(p_day, 'YYYY-MM-DD'),
    'reporting', v_reporting,
    'total', v_total,
    'suppressed', false,
    'buckets', coalesce(v_buckets, '[]'::jsonb),
    'histogram', coalesce(v_hist, '[]'::jsonb),
    'cohortAvg', round(v_avg::numeric, 1)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Cohort averages per metric family (KPI tiles)
-- ----------------------------------------------------------------------------
create or replace function public.admin_health_cohort_averages(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from date := current_date - greatest(p_days - 1, 0);
  v_result jsonb;
  v_members int;
  v_reporting int;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  select count(*) into v_members from user_health_consent
    where allow_cohort_anon and revoked_at is null;

  with cohort as (
    select user_id from user_health_consent
    where allow_cohort_anon and revoked_at is null
  ),
  rows_in as (
    select d.* from user_health_daily d
    join cohort c on c.user_id = d.user_id
    where d.day >= v_from
  ),
  agg as (
    select
      count(distinct user_id) as reporting,
      -- each metric: avg / median / sd / n(users with data)
      avg(resting_hr) as rhr_avg, percentile_cont(0.5) within group (order by resting_hr) as rhr_med,
      stddev_samp(resting_hr) as rhr_sd, count(distinct user_id) filter (where resting_hr is not null) as rhr_n,
      avg(hrv) as hrv_avg, percentile_cont(0.5) within group (order by hrv) as hrv_med,
      stddev_samp(hrv) as hrv_sd, count(distinct user_id) filter (where hrv is not null) as hrv_n,
      avg(sleep_total_min) as slp_avg, percentile_cont(0.5) within group (order by sleep_total_min) as slp_med,
      stddev_samp(sleep_total_min) as slp_sd, count(distinct user_id) filter (where sleep_total_min is not null) as slp_n,
      avg(vo2max) as vo2_avg, percentile_cont(0.5) within group (order by vo2max) as vo2_med,
      stddev_samp(vo2max) as vo2_sd, count(distinct user_id) filter (where vo2max is not null) as vo2_n,
      avg(readiness_score) as rdy_avg, percentile_cont(0.5) within group (order by readiness_score) as rdy_med,
      stddev_samp(readiness_score) as rdy_sd, count(distinct user_id) filter (where readiness_score is not null) as rdy_n,
      avg(steps) as stp_avg, percentile_cont(0.5) within group (order by steps) as stp_med,
      stddev_samp(steps) as stp_sd, count(distinct user_id) filter (where steps is not null) as stp_n,
      avg(active_energy_kcal) as kcal_avg, percentile_cont(0.5) within group (order by active_energy_kcal) as kcal_med,
      stddev_samp(active_energy_kcal) as kcal_sd, count(distinct user_id) filter (where active_energy_kcal is not null) as kcal_n
    from rows_in
  )
  select
    reporting,
    jsonb_build_object(
      'resting_hr', case when rhr_n >= 5 then jsonb_build_object('avg', round(rhr_avg::numeric,1), 'median', round(rhr_med::numeric,1), 'sd', round(rhr_sd::numeric,1), 'n', rhr_n) else jsonb_build_object('n', rhr_n) end,
      'hrv', case when hrv_n >= 5 then jsonb_build_object('avg', round(hrv_avg::numeric,1), 'median', round(hrv_med::numeric,1), 'sd', round(hrv_sd::numeric,1), 'n', hrv_n) else jsonb_build_object('n', hrv_n) end,
      'sleep_total_min', case when slp_n >= 5 then jsonb_build_object('avg', round(slp_avg::numeric,0), 'median', round(slp_med::numeric,0), 'sd', round(slp_sd::numeric,0), 'n', slp_n) else jsonb_build_object('n', slp_n) end,
      'vo2max', case when vo2_n >= 5 then jsonb_build_object('avg', round(vo2_avg::numeric,1), 'median', round(vo2_med::numeric,1), 'sd', round(vo2_sd::numeric,1), 'n', vo2_n) else jsonb_build_object('n', vo2_n) end,
      'readiness_score', case when rdy_n >= 5 then jsonb_build_object('avg', round(rdy_avg::numeric,1), 'median', round(rdy_med::numeric,1), 'sd', round(rdy_sd::numeric,1), 'n', rdy_n) else jsonb_build_object('n', rdy_n) end,
      'steps', case when stp_n >= 5 then jsonb_build_object('avg', round(stp_avg::numeric,0), 'median', round(stp_med::numeric,0), 'sd', round(stp_sd::numeric,0), 'n', stp_n) else jsonb_build_object('n', stp_n) end,
      'active_energy_kcal', case when kcal_n >= 5 then jsonb_build_object('avg', round(kcal_avg::numeric,0), 'median', round(kcal_med::numeric,0), 'sd', round(kcal_sd::numeric,0), 'n', kcal_n) else jsonb_build_object('n', kcal_n) end
    )
  into v_reporting, v_result
  from agg;

  return jsonb_build_object(
    'metrics', coalesce(v_result, '{}'::jsonb),
    'coverage', jsonb_build_object(
      'members', v_members,
      'reporting', coalesce(v_reporting, 0),
      'pctReporting', case when v_members = 0 then 0
        else round((coalesce(v_reporting,0)::numeric / v_members) * 1000) / 10 end
    )
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Per-user snapshot (named drill-down) — requires that member's consent,
--    hides cycle-proxy signals unless share_sensitive, audit-logs the view.
-- ----------------------------------------------------------------------------
create or replace function public.admin_health_user_snapshot(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share_sensitive boolean;
  v_user jsonb;
  v_latest jsonb;
  v_series jsonb;
  v_sleep jsonb;
  v_adherence jsonb;
  v_synced timestamptz;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  select share_sensitive into v_share_sensitive
  from user_health_consent
  where user_id = p_user and share_with_coach and revoked_at is null;

  if not found then
    raise exception 'member has not consented to share health data';
  end if;

  -- server-side audit of the named view (never trust the client to log)
  insert into admin_audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'health.view', 'user_health_daily', p_user::text, '{}'::jsonb);

  select jsonb_build_object('user_id', p.id, 'name', p.name, 'avatar_url', p.avatar_url)
    into v_user from profiles p where p.id = p_user;

  select jsonb_build_object(
      'day', to_char(d.day, 'YYYY-MM-DD'),
      'readiness_score', d.readiness_score,
      'readiness_band', d.readiness_band,
      'readiness_flags', d.readiness_flags,
      'resting_hr', d.resting_hr,
      'hrv', d.hrv,
      'hrv_method', d.hrv_method,
      'vo2max', d.vo2max,
      'respiratory_rate', d.respiratory_rate,
      'spo2', d.spo2,
      'wrist_temp_dev', case when v_share_sensitive then d.wrist_temp_dev end,
      'sleep_total_min', d.sleep_total_min,
      'sleep_deep_min', d.sleep_deep_min,
      'sleep_rem_min', d.sleep_rem_min,
      'sleep_efficiency', d.sleep_efficiency,
      'steps', d.steps,
      'active_energy_kcal', d.active_energy_kcal,
      'srpe_load', d.srpe_load
    ), d.synced_at
    into v_latest, v_synced
    from user_health_daily d
    where d.user_id = p_user
    order by d.day desc
    limit 1;

  select jsonb_agg(jsonb_build_object(
      'day', to_char(day, 'YYYY-MM-DD'),
      'readiness_score', readiness_score,
      'resting_hr', resting_hr,
      'hrv', hrv,
      'hrv_method', hrv_method,
      'respiratory_rate', respiratory_rate,
      'spo2', spo2,
      'sleep_total_min', sleep_total_min,
      'time_in_bed_min', time_in_bed_min,
      'sleep_deep_min', sleep_deep_min,
      'sleep_rem_min', sleep_rem_min,
      'steps', steps,
      'active_energy_kcal', active_energy_kcal,
      'srpe_load', srpe_load
    ) order by day)
    into v_series
    from user_health_daily
    where user_id = p_user and day >= current_date - 60;

  select jsonb_build_object(
      'day', to_char(s.day, 'YYYY-MM-DD'),
      'start_at', s.start_at,
      'end_at', s.end_at,
      'segments', s.segments,
      'deep_min', s.deep_min, 'rem_min', s.rem_min,
      'core_min', s.core_min, 'awake_min', s.awake_min
    )
    into v_sleep
    from user_sleep_sessions s
    where s.user_id = p_user
    order by s.day desc
    limit 1;

  -- adherence cross-check: prescribed sessions completed vs watch-recorded
  select jsonb_build_object(
      'prescribedDone30d', (select count(*) from workout_logs w
        where w.user_id = p_user and w.date >= current_date - 30),
      'watchRecorded30d', (select count(*) from user_hk_workouts h
        where h.user_id = p_user and h.day >= current_date - 30),
      'watchMinutes30d', (select coalesce(sum(duration_sec) / 60, 0)::int from user_hk_workouts h
        where h.user_id = p_user and h.day >= current_date - 30)
    )
    into v_adherence;

  return jsonb_build_object(
    'user', v_user,
    'latest', v_latest,
    'series', coalesce(v_series, '[]'::jsonb),
    'lastSleep', v_sleep,
    'adherence', v_adherence,
    'lastSync', v_synced
  );
end;
$$;

grant execute on function public.admin_health_activity_trend(int) to authenticated;
grant execute on function public.admin_health_readiness_distribution(date) to authenticated;
grant execute on function public.admin_health_cohort_averages(int) to authenticated;
grant execute on function public.admin_health_user_snapshot(uuid) to authenticated;
