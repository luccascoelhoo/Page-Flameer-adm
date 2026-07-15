-- ============================================================================
-- Flameer Admin — Content lifecycle (status) for challenges / workouts / diets
--
-- The iOS app has no "status" concept: it shows a challenge when
-- visibility='public'. To give professionals a real draft→publish→pause
-- workflow WITHOUT changing the app, we:
--   * add an explicit `status` column (source of truth for the admin), and
--   * keep `visibility` in sync via the admin actions (publish→public,
--     pause/archive/draft→private) so the app honours availability as-is.
--
-- Safe to run multiple times.
-- ============================================================================

-- ---- challenges ------------------------------------------------------------
alter table public.challenges add column if not exists status text;

update public.challenges
  set status = case when visibility = 'public' then 'published' else 'draft' end
  where status is null;

alter table public.challenges alter column status set default 'draft';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'challenges_status_chk') then
    alter table public.challenges
      add constraint challenges_status_chk
      check (status in ('draft', 'published', 'paused', 'archived'));
  end if;
end $$;

create index if not exists challenges_status_idx on public.challenges (status);
create index if not exists challenges_creator_idx on public.challenges (creator_id);

-- ---- workouts --------------------------------------------------------------
alter table public.workouts add column if not exists status text default 'published';
update public.workouts set status = 'published' where status is null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'workouts_status_chk') then
    alter table public.workouts
      add constraint workouts_status_chk
      check (status in ('draft', 'published', 'paused', 'archived'));
  end if;
end $$;
create index if not exists workouts_status_idx on public.workouts (status);

-- ---- diets -----------------------------------------------------------------
alter table public.diets add column if not exists status text default 'published';
update public.diets set status = 'published' where status is null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'diets_status_chk') then
    alter table public.diets
      add constraint diets_status_chk
      check (status in ('draft', 'published', 'paused', 'archived'));
  end if;
end $$;
create index if not exists diets_status_idx on public.diets (status);

-- ---------------------------------------------------------------------------
-- Accurate participant counts. The app enrols into `challenge_participants`;
-- older data may live in `challenge_enrollments`. This RPC returns per-challenge
-- counts from whichever table exists, so the admin never shows a false 0.
-- ---------------------------------------------------------------------------
create or replace function public.admin_challenge_participant_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_has_participants boolean;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'challenge_participants'
  ) into v_has_participants;

  if v_has_participants then
    execute $q$
      select coalesce(jsonb_object_agg(challenge_id, cnt), '{}'::jsonb)
      from (select challenge_id, count(*) cnt from challenge_participants group by challenge_id) t
    $q$ into v_result;
  else
    select coalesce(jsonb_object_agg(challenge_id, cnt), '{}'::jsonb)
      into v_result
      from (select challenge_id, count(*) cnt from challenge_enrollments group by challenge_id) t;
  end if;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

grant execute on function public.admin_challenge_participant_counts() to authenticated;
