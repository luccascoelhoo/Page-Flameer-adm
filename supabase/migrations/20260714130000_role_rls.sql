-- ============================================================================
-- Flameer Admin — DB-level admin/professional split
--
-- Until now is_admin() treated 'admin' and 'professional' identically, so the
-- panel's admin-only surfaces (AI keys, coupons, audit) were only guarded in
-- the UI. This migration adds is_platform_admin() and tightens RLS on the
-- three sensitive surfaces. Content/analytics/health RPCs keep accepting both
-- staff roles via is_admin() — that boundary is intentional.
--
-- Also fixes a real exposure: referral_codes had a SELECT policy USING (true)
-- for ALL authenticated users, letting any app user enumerate every coupon.
-- Signup validation never needed it — validate_referral_code() is
-- SECURITY DEFINER and bypasses RLS.
--
-- Idempotent. Apply with: supabase db push
-- ============================================================================

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- ---- referral_codes: kill open enumeration ----------------------------------
do $$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'referral_codes'
  ) then
    -- Any authenticated user could list every coupon — remove.
    drop policy if exists "Allow authenticated users to read referral codes" on public.referral_codes;
    -- The pre-existing "Allow admin users to manage referral codes" policy is
    -- already role='admin'-only FOR ALL; it remains the only access path.
    -- (validate_referral_code is SECURITY DEFINER — onboarding unaffected.)
  end if;
end $$;

-- ---- ai_settings: API keys are secrets — platform admin only -----------------
do $$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_settings'
  ) then
    alter table public.ai_settings enable row level security;

    -- Drop any permissive policies the ad-hoc setup may have created.
    drop policy if exists "Allow admin full access" on public.ai_settings;
    drop policy if exists "Allow authenticated read" on public.ai_settings;
    drop policy if exists "ai settings admin only" on public.ai_settings;

    create policy "ai settings admin only" on public.ai_settings
      for all using (public.is_platform_admin())
      with check (public.is_platform_admin());
  end if;
end $$;

-- ---- admin_audit_log: only platform admins read the trail --------------------
-- (Professionals' actions are still WRITTEN via admin_log_action — is_admin()
-- gate — they just can't read other staff's trail.)
drop policy if exists "admins read audit" on public.admin_audit_log;
drop policy if exists "platform admins read audit" on public.admin_audit_log;
create policy "platform admins read audit" on public.admin_audit_log
  for select using (public.is_platform_admin());
