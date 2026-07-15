-- ============================================================================
-- Flameer Health — sensitive-field encryption helpers (pgcrypto + Vault)
--
-- The user_health_sensitive.payload_enc column stores pgp_sym_encrypt
-- ciphertext. The symmetric key lives in Supabase Vault under the name
-- 'health_field_key' — create it once in the dashboard (Project Settings →
-- Vault) or via: select vault.create_secret('<random-32+-char-key>', 'health_field_key');
--
-- v1 tradeoff (explicit): one key encrypts all users' sensitive payloads.
-- A per-user key hierarchy is a v2 hardening step.
--
-- The browser/admin panel NEVER decrypts — only the data owner, only with
-- share_sensitive consent, via this SECURITY DEFINER RPC. Every decrypt
-- attempt is audit-logged.
-- ============================================================================

create extension if not exists pgcrypto;

create or replace function public.encrypt_sensitive_health(
  p_day date,
  p_kind text,
  p_payload text,
  p_source public.health_source default 'apple_health'
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare k text;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;

  select decrypted_secret into k
  from vault.decrypted_secrets where name = 'health_field_key';
  if k is null then raise exception 'health_field_key not configured in Vault'; end if;

  insert into user_health_sensitive (user_id, day, kind, payload_enc, source)
  values (auth.uid(), p_day, p_kind, pgp_sym_encrypt(p_payload, k), p_source)
  on conflict (user_id, day, kind)
  do update set payload_enc = excluded.payload_enc, source = excluded.source;
end;
$$;

create or replace function public.get_sensitive_health(p_day date, p_kind text)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare k text; v_out text;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;

  -- owner-only + explicit sensitive consent, revocation honoured
  if not exists (
    select 1 from user_health_consent c
    where c.user_id = auth.uid() and c.share_sensitive and c.revoked_at is null
  ) then
    raise exception 'not consented';
  end if;

  -- audit every decrypt attempt, including the owner's
  insert into admin_audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'health.sensitive.decrypt', 'user_health_sensitive',
          auth.uid()::text, jsonb_build_object('day', p_day, 'kind', p_kind));

  select decrypted_secret into k
  from vault.decrypted_secrets where name = 'health_field_key';
  if k is null then raise exception 'health_field_key not configured in Vault'; end if;

  select pgp_sym_decrypt(payload_enc, k) into v_out
  from user_health_sensitive
  where user_id = auth.uid() and day = p_day and kind = p_kind;

  return v_out;
end;
$$;

grant execute on function public.encrypt_sensitive_health(date, text, text, public.health_source) to authenticated;
grant execute on function public.get_sensitive_health(date, text) to authenticated;
