-- ============================================================================
-- Flameer Health — wearable metric storage synced from Apple Health / others
--
-- One row per user per day in user_health_daily (the board's workhorse),
-- plus sleep sessions (hypnogram), watch-recorded workouts (adherence +
-- training load), sparse raw samples (baselines), a segregated encrypted
-- store for sensitive data, and an explicit consent ledger.
--
-- Design rules baked in:
--  * Everything nullable — HealthKit cannot distinguish "denied" from
--    "no data"; the board tolerates sparse rows and never fabricates.
--  * Provenance on every value (source enum) — never sum across sources.
--  * SDNN (Apple) vs RMSSD (most others) are NOT comparable → hrv_method.
--  * Sensitive data (menstrual/clinical) segregated + encrypted, with NO
--    admin read policy; coach surfaces see derived flags only.
--
-- Idempotent. Apply with: supabase db push
-- ============================================================================

-- ---- enums -----------------------------------------------------------------
do $$ begin
  create type public.health_source as enum (
    'apple_health', 'health_connect', 'garmin', 'fitbit', 'whoop', 'oura', 'manual'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.hrv_method as enum ('sdnn', 'rmssd');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.temp_kind as enum ('absolute', 'wrist_deviation');
exception when duplicate_object then null; end $$;

-- ---- consent ledger (checked by every coach-facing read) -------------------
-- NOTE: share_with_coach exposes the member to ALL admin/professional staff
-- (is_admin() is role-wide). If per-coach scoping is ever needed, this table
-- gains a coach_id column and the policies change — v1 is explicit about it.
create table if not exists public.user_health_consent (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  share_with_coach   boolean not null default false,   -- named visibility to staff
  share_sensitive    boolean not null default false,   -- menstrual/clinical + cycle-proxy signals (wrist temp)
  allow_cohort_anon  boolean not null default false,   -- anonymized cohort aggregation
  consented_at       timestamptz,
  revoked_at         timestamptz,
  policy_version     text not null default 'v1',
  updated_at         timestamptz not null default now()
);

-- ---- daily aggregates: one row per (user, local day) ------------------------
create table if not exists public.user_health_daily (
  user_id            uuid not null references public.profiles(id) on delete cascade,
  day                date not null,          -- device-local calendar day
  tz                 text,                   -- IANA tz the day was computed in

  -- cardio / vitals
  resting_hr         numeric(5,1),           -- bpm
  walking_hr_avg     numeric(5,1),           -- bpm
  hrv                numeric(6,2),           -- ms
  hrv_method         public.hrv_method,      -- 'sdnn' on Apple
  hr_recovery_1min   numeric(5,1),           -- bpm drop after workout
  vo2max             numeric(5,2),           -- ml/kg/min
  respiratory_rate   numeric(4,1),           -- breaths/min (sleeping)
  spo2               numeric(4,3),           -- fraction 0..1
  wrist_temp_dev     numeric(4,2),           -- °C deviation vs personal baseline (cycle-proxy: sensitive-gated on reads)
  body_temp          numeric(4,2),           -- °C absolute
  temp_kind          public.temp_kind,

  -- activity / energy
  steps              integer,
  distance_m         numeric(9,1),
  active_energy_kcal numeric(7,1),
  basal_energy_kcal  numeric(7,1),
  exercise_minutes   integer,
  stand_minutes      integer,
  move_minutes       integer,
  flights_climbed    integer,

  -- sleep (reduced totals; intervals live in user_sleep_sessions)
  sleep_total_min       integer,
  time_in_bed_min       integer,
  sleep_efficiency      numeric(4,3),        -- TST / time in bed, 0..1
  sleep_awake_min       integer,             -- WASO
  sleep_core_min        integer,
  sleep_deep_min        integer,
  sleep_rem_min         integer,
  sleep_unspecified_min integer,
  sleep_latency_min     integer,

  -- body composition (manual/scale; trend only)
  body_mass_kg       numeric(5,2),
  body_fat_pct       numeric(4,3),
  lean_body_mass_kg  numeric(5,2),
  height_m           numeric(3,2),

  -- training load (derived on device: effort_score × duration, or HR-based)
  srpe_load          numeric(7,1),           -- arbitrary units (AU)
  trimp              numeric(7,1),

  -- readiness cache (device/board-computed; the web board recomputes when null.
  -- NOTE: owner-writable, therefore device-spoofable — treat as a hint, the
  -- engine in src/lib/admin/readiness.ts is the source of truth.)
  readiness_score    numeric(4,1),
  readiness_band     text check (readiness_band in ('green','amber','red') or readiness_band is null),
  readiness_flags    jsonb default '[]'::jsonb,

  -- provenance / freshness
  primary_source     public.health_source,
  sources            public.health_source[] default '{}',
  synced_at          timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  primary key (user_id, day)
);

create index if not exists uhd_day_idx       on public.user_health_daily (day desc);
create index if not exists uhd_user_day_idx  on public.user_health_daily (user_id, day desc);
create index if not exists uhd_band_idx      on public.user_health_daily (readiness_band, day desc);

-- ---- sparse raw samples (baselines / backfill; NOT continuous streams) ------
create table if not exists public.user_health_samples (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  metric        text not null,               -- 'hrv'|'resting_hr'|'respiratory_rate'|'spo2'|'wrist_temp_dev'
  value         numeric not null,
  unit          text not null,
  method        text,                        -- 'sdnn'|'rmssd' for hrv
  measured_at   timestamptz not null,
  source        public.health_source not null,
  source_bundle text,                        -- HKSourceRevision bundle id
  external_uuid text,                        -- HK sample UUID (informational)
  created_at    timestamptz not null default now()
);

-- Single full (non-partial) unique index so PostgREST upsert has a stable
-- conflict target: onConflict "user_id,metric,measured_at,source".
create unique index if not exists uhs_conflict_idx
  on public.user_health_samples (user_id, metric, measured_at, source);
create index if not exists uhs_user_metric_idx
  on public.user_health_samples (user_id, metric, measured_at desc);
create index if not exists uhs_extuuid_idx
  on public.user_health_samples (external_uuid) where external_uuid is not null;

-- ---- sleep sessions (intervals for hypnogram) -------------------------------
create table if not exists public.user_sleep_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  day             date not null,             -- night attributed to this day
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  in_bed_min      integer,
  awake_min       integer,
  core_min        integer,
  deep_min        integer,
  rem_min         integer,
  unspecified_min integer,
  segments        jsonb default '[]'::jsonb, -- [{stage,start,end}] for hypnogram
  source          public.health_source not null,
  external_uuid   text,
  created_at      timestamptz not null default now()
);
-- Full (non-partial) unique index: PostgREST upsert onConflict "external_uuid"
-- cannot infer a partial index; Postgres allows multiple NULLs in a unique index.
create unique index if not exists uss_extuuid_uq
  on public.user_sleep_sessions (external_uuid);
create index if not exists uss_user_day_idx on public.user_sleep_sessions (user_id, day desc);

-- ---- watch-recorded workouts (HKWorkout) ------------------------------------
create table if not exists public.user_hk_workouts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  day             date not null,
  activity_type   text not null,             -- canonical name mapped from HKWorkoutActivityType
  hk_activity_raw integer,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  duration_sec    integer not null,
  energy_kcal     numeric(7,1),
  distance_m      numeric(9,1),
  avg_hr          numeric(5,1),
  max_hr          numeric(5,1),
  flights         integer,
  swim_strokes    integer,
  effort_score    numeric(4,1),              -- iOS 18 workoutEffortScore (1–10)
  is_indoor       boolean,
  source          public.health_source not null,
  external_uuid   text,
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
-- Full unique index for the same PostgREST onConflict reason as sleep sessions.
create unique index if not exists uhw_extuuid_uq
  on public.user_hk_workouts (external_uuid);
create index if not exists uhw_user_day_idx on public.user_hk_workouts (user_id, day desc);
create index if not exists uhw_type_idx on public.user_hk_workouts (activity_type);

-- ---- segregated sensitive store (menstrual / clinical) ----------------------
-- Encrypted payload only; NO admin select policy — the coach board NEVER
-- reads this table, only the owner via the gated decrypt RPC (vault migration).
create table if not exists public.user_health_sensitive (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  day          date not null,
  kind         text not null,                -- 'menstrual_flow' | 'clinical_vital'
  payload_enc  bytea,
  source       public.health_source not null,
  created_at   timestamptz not null default now(),
  primary key (user_id, day, kind)           -- PK already leads on user_id
);

-- ============================================================================
-- RLS — owner read/write via the app's JWT; staff read gated on consent.
-- Drop-then-create so re-running the migration never errors.
-- ============================================================================
alter table public.user_health_daily     enable row level security;
alter table public.user_health_samples   enable row level security;
alter table public.user_sleep_sessions   enable row level security;
alter table public.user_hk_workouts      enable row level security;
alter table public.user_health_sensitive enable row level security;
alter table public.user_health_consent   enable row level security;

-- owner policies
drop policy if exists "own health daily rw" on public.user_health_daily;
create policy "own health daily rw" on public.user_health_daily
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own health samples rw" on public.user_health_samples;
create policy "own health samples rw" on public.user_health_samples
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own sleep rw" on public.user_sleep_sessions;
create policy "own sleep rw" on public.user_sleep_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own hk workouts rw" on public.user_hk_workouts;
create policy "own hk workouts rw" on public.user_hk_workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own sensitive rw" on public.user_health_sensitive;
create policy "own sensitive rw" on public.user_health_sensitive
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own consent rw" on public.user_health_consent;
create policy "own consent rw" on public.user_health_consent
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- staff read of NON-sensitive tables, only for members who consented and
-- have not revoked. (user_health_sensitive intentionally has NO staff policy.)
drop policy if exists "coach reads consented daily" on public.user_health_daily;
create policy "coach reads consented daily" on public.user_health_daily
  for select using (
    public.is_admin() and exists (
      select 1 from public.user_health_consent c
      where c.user_id = user_health_daily.user_id
        and c.share_with_coach and c.revoked_at is null
    )
  );

drop policy if exists "coach reads consented samples" on public.user_health_samples;
create policy "coach reads consented samples" on public.user_health_samples
  for select using (
    public.is_admin() and exists (
      select 1 from public.user_health_consent c
      where c.user_id = user_health_samples.user_id
        and c.share_with_coach and c.revoked_at is null
    )
  );

drop policy if exists "coach reads consented sleep" on public.user_sleep_sessions;
create policy "coach reads consented sleep" on public.user_sleep_sessions
  for select using (
    public.is_admin() and exists (
      select 1 from public.user_health_consent c
      where c.user_id = user_sleep_sessions.user_id
        and c.share_with_coach and c.revoked_at is null
    )
  );

drop policy if exists "coach reads consented hk workouts" on public.user_hk_workouts;
create policy "coach reads consented hk workouts" on public.user_hk_workouts
  for select using (
    public.is_admin() and exists (
      select 1 from public.user_health_consent c
      where c.user_id = user_hk_workouts.user_id
        and c.share_with_coach and c.revoked_at is null
    )
  );

drop policy if exists "coach reads consent flags" on public.user_health_consent;
create policy "coach reads consent flags" on public.user_health_consent
  for select using (public.is_admin());
