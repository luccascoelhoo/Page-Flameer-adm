-- ============================================================================
-- Flameer Admin — correções da revisão adversarial (2026-07-15)
--
-- 1. admin_health_readiness_distribution quebrava em TODA chamada (42803:
--    agregados + colunas laterais sem GROUP BY). Reescrita com subqueries.
-- 2. PRIVACIDADE: wrist_temp_dev/body_temp (proxies de ciclo menstrual) eram
--    legíveis por qualquer staff via SELECT direto — RLS é por linha, o gate
--    no RPC era cosmético. Colunas removidas de user_health_daily; dados
--    dessa natureza pertencem exclusivamente a user_health_sensitive
--    (criptografado, sem política de leitura p/ staff). O app iOS nunca as
--    enviou (decisão v1 documentada), então não há dados a migrar.
-- 3. admin_challenge_funnel: challenge_participants pode não ter
--    active/completed_at/current_day — agora detecta as colunas existentes.
-- 4. admin_user_aggregates: topCategory lia challenge_enrollments (que o app
--    não escreve) — agora usa a tabela de participação detectada.
-- 5. ai_settings: drop dinâmico de TODAS as políticas (nomes de setup ad-hoc
--    variam) antes de recriar a admin-only.
-- 6. admin_log_action: valida formato/tamanho para impedir forja/flood da
--    trilha por staff.
--
-- Idempotente. Apply with: supabase db push
-- ============================================================================

-- ---- 2. remover colunas sensíveis do caminho legível por staff ---------------
alter table public.user_health_daily drop column if exists wrist_temp_dev;
alter table public.user_health_daily drop column if exists body_temp;
alter table public.user_health_daily drop column if exists temp_kind;

-- ---- 1. distribution: reescrita sem o erro 42803 -----------------------------
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
    (select count(*) from latest),
    (select round(avg(readiness_score)::numeric, 1) from latest),
    (select jsonb_agg(jsonb_build_object('band', readiness_band, 'n', n))
       from (select readiness_band, count(*) n from latest group by readiness_band) b),
    (select jsonb_agg(jsonb_build_object('bin', bin, 'n', n) order by bin)
       from (select (floor(readiness_score / 10) * 10)::int as bin, count(*) n
             from latest group by 1) h)
  into v_reporting, v_avg, v_buckets, v_hist;

  select count(*) into v_total from user_health_consent
    where allow_cohort_anon and revoked_at is null;

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
    'cohortAvg', v_avg
  );
end;
$$;

-- ---- 3. funnel: detecta colunas realmente existentes -------------------------
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
  v_active_expr text := 'null::bigint';
  v_completed_expr text := 'null::bigint';
  v_dropoff_expr text := 'null::numeric';
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'challenge_participants'
  ) then
    v_table := 'challenge_participants';
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = v_table and column_name = 'active') then
    v_active_expr := 'count(e.*) filter (where e.active)';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = v_table and column_name = 'completed_at') then
    v_completed_expr := 'count(e.*) filter (where e.completed_at is not null)';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = v_table and column_name = 'current_day')
     and v_completed_expr <> 'null::bigint' then
    v_dropoff_expr := 'avg(e.current_day) filter (where e.completed_at is null and coalesce(e.current_day,0) > 0)';
  end if;

  execute format($q$
    with agg as (
      select
        c.id, c.title,
        count(e.*) as enrolled,
        %s as active,
        %s as completed,
        %s as avg_dropoff
      from challenges c
      join %I e on e.challenge_id = c.id
      group by c.id, c.title
    )
    select jsonb_agg(jsonb_build_object(
      'id', id, 'title', title,
      'enrolled', enrolled, 'active', active, 'completed', completed,
      'completionRate', case when completed is null then null
        when enrolled = 0 then 0
        else round((completed::numeric / enrolled) * 1000) / 10 end,
      'avgDropoffDay', case when avg_dropoff is null then null else round(avg_dropoff) end
    ) order by enrolled desc)
    from agg
    where enrolled > 0
  $q$, v_active_expr, v_completed_expr, v_dropoff_expr, v_table) into v_result;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

-- ---- 4. user aggregates: categoria via tabela de participação detectada -----
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
  v_ptable text := 'challenge_enrollments';
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'challenge_participants'
  ) then
    v_ptable := 'challenge_participants';
  end if;

  execute format($q$
    with w as (select user_id, count(*) c from workout_logs where date >= %L group by user_id),
    di as (select user_id, count(*) c from diet_logs where date >= %L group by user_id),
    h as (
      select user_id, count(*) total, count(*) filter (where done) done
      from daily_habit_logs where date >= %L group by user_id
    ),
    cat as (
      select user_id, category from (
        select e.user_id, c.category,
               row_number() over (partition by e.user_id order by count(*) desc) rn
        from %I e
        join challenges c on c.id = e.challenge_id
        group by e.user_id, c.category
      ) t where rn = 1
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
    from profiles p
    left join w on w.user_id = p.id
    left join di on di.user_id = p.id
    left join h on h.user_id = p.id
    left join cat on cat.user_id = p.id
  $q$, v_from, v_from, v_from, v_ptable) into v_result;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

-- ---- snapshot: recriada sem as colunas sensíveis removidas -------------------
create or replace function public.admin_health_user_snapshot(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user jsonb;
  v_latest jsonb;
  v_series jsonb;
  v_sleep jsonb;
  v_adherence jsonb;
  v_synced timestamptz;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  if not exists (
    select 1 from user_health_consent
    where user_id = p_user and share_with_coach and revoked_at is null
  ) then
    raise exception 'member has not consented to share health data';
  end if;

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

-- ---- 5. ai_settings: drop dinâmico de todas as políticas ----------------------
do $$
declare pol record;
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_settings'
  ) then
    alter table public.ai_settings enable row level security;
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'ai_settings'
    loop
      execute format('drop policy %I on public.ai_settings', pol.policyname);
    end loop;
    create policy "ai settings admin only" on public.ai_settings
      for all using (public.is_platform_admin())
      with check (public.is_platform_admin());
  end if;
end $$;

-- ---- 6. admin_log_action: validação anti-forja/flood -------------------------
create or replace function public.admin_log_action(
  p_action text,
  p_entity text default null,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_action !~ '^[a-z0-9_.]{1,64}$' then
    raise exception 'invalid action format';
  end if;
  if length(coalesce(p_entity, '')) > 64
     or length(coalesce(p_entity_id, '')) > 2048
     or length(coalesce(p_metadata, '{}'::jsonb)::text) > 8192 then
    raise exception 'audit payload too large';
  end if;
  insert into public.admin_audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;
