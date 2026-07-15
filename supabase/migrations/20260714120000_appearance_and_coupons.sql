-- ============================================================================
-- Flameer Admin — challenge cover storage + coupon↔challenge linkage
-- Idempotent. Apply with: supabase db push
-- ============================================================================

-- ---- public bucket for challenge cover images -------------------------------
-- The iOS app renders challenges.cover_image_url as a plain URL, so the bucket
-- is public-read; writes are restricted to admin/professional staff.
insert into storage.buckets (id, name, public)
values ('challenge-covers', 'challenge-covers', true)
on conflict (id) do update set public = true;

drop policy if exists "covers public read" on storage.objects;
create policy "covers public read" on storage.objects
  for select using (bucket_id = 'challenge-covers');

drop policy if exists "covers admin write" on storage.objects;
create policy "covers admin write" on storage.objects
  for insert with check (bucket_id = 'challenge-covers' and public.is_admin());

drop policy if exists "covers admin update" on storage.objects;
create policy "covers admin update" on storage.objects
  for update using (bucket_id = 'challenge-covers' and public.is_admin());

drop policy if exists "covers admin delete" on storage.objects;
create policy "covers admin delete" on storage.objects
  for delete using (bucket_id = 'challenge-covers' and public.is_admin());

-- ---- coupon (referral code) linked to a challenge ---------------------------
-- referral_codes was created by an earlier app migration; guard defensively.
do $$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'referral_codes'
  ) then
    alter table public.referral_codes
      add column if not exists challenge_id uuid references public.challenges(id) on delete set null;
    create index if not exists referral_codes_challenge_idx
      on public.referral_codes (challenge_id);
  end if;
end $$;
