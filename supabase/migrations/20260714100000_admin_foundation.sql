-- ============================================================================
-- Flameer Admin — Foundation: role helper + audit log
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)
-- ============================================================================

-- Reusable, SECURITY DEFINER role check so RPCs can gate themselves without
-- re-implementing the profiles lookup each time. STABLE + search_path locked.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'professional')
  );
$$;

-- ----------------------------------------------------------------------------
-- Audit log — every sensitive admin action should be recorded here.
-- ----------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,               -- e.g. 'role.update', 'content.delete'
  entity      text,                         -- table / resource name
  entity_id   text,                         -- affected row id (as text, polymorphic)
  metadata    jsonb default '{}'::jsonb,    -- before/after, reason, counts…
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_actor_idx on public.admin_audit_log (actor_id);
create index if not exists admin_audit_log_action_idx on public.admin_audit_log (action);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admins read audit" on public.admin_audit_log;
create policy "admins read audit" on public.admin_audit_log
  for select using (public.is_admin());

-- Writes go only through the RPC below (SECURITY DEFINER), never direct inserts.
drop policy if exists "no direct audit writes" on public.admin_audit_log;
create policy "no direct audit writes" on public.admin_audit_log
  for insert with check (false);

-- Helper RPC to append an audit entry as the current admin.
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
  insert into public.admin_audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_log_action(text, text, text, jsonb) to authenticated;
