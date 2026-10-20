-- 20260723140000_bloco_b_arquitetura.sql
--
-- Bloco B da auditoria — contratos entre app e banco, e integridade de dados.
-- Corrige RLS que quebrava feed/curtidas/comentários/fotos, colunas que o app
-- grava e não existem, e escrita direta que deveria passar por função.
--
-- Idempotente. Aplicar com: supabase db push (ou colar no SQL editor).

begin;

-- Helper: o leitor pode ver este post? Espelha o gate da policy de posts
-- (perfil público E sem bloqueio recíproco). Usado para não deixar curtida e
-- comentário vazarem de post que o leitor nem poderia ver.
create or replace function public.can_read_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1 from public.posts po
        join public.profiles pr on pr.id = po.author_id
        where po.id = p_post_id
          -- O dono sempre vê o próprio post (mesmo com perfil privado), senão as
          -- curtidas/comentários do próprio conteúdo sumiriam pra ele.
          and (po.author_id = auth.uid() or pr.public_profile = true)
          and not exists (
              select 1 from public.user_blocks b
              where (b.blocker_id = auth.uid() and b.blocked_id = po.author_id)
                 or (b.blocker_id = po.author_id and b.blocked_id = auth.uid())
          )
    );
$$;
grant execute on function public.can_read_post(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. ALTO — Curtidas travadas em 0/1: RLS de post_likes esconde curtida alheia
-- ---------------------------------------------------------------------------
-- A policy era FOR ALL USING (auth.uid()=user_id), então o SELECT de contagem só
-- enxergava a PRÓPRIA curtida — o feed mostrava 0 ou 1. Contagem de curtida é
-- pública; escrita continua restrita ao dono.
drop policy if exists "Post likes policy" on public.post_likes;
drop policy if exists "post_likes readable if post readable" on public.post_likes;
create policy "post_likes readable if post readable"
    on public.post_likes for select to authenticated
    using (public.can_read_post(post_id));
drop policy if exists "post_likes insert own" on public.post_likes;
create policy "post_likes insert own"
    on public.post_likes for insert to authenticated
    with check ((select auth.uid()) = user_id);
drop policy if exists "post_likes delete own" on public.post_likes;
create policy "post_likes delete own"
    on public.post_likes for delete to authenticated
    using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 2. ALTO — Comentários de terceiros invisíveis; e dono do post podia forjar
-- ---------------------------------------------------------------------------
-- A policy FOR ALL restringia o SELECT a autor-do-comentário OU dono-do-post,
-- então comentário de terceiro em post alheio nunca aparecia. E o mesmo USING de
-- FOR ALL deixava o dono do post dar UPDATE em comentário de outro (forjar).
-- Separa: leitura pública, escrita só do autor, exclusão do autor ou do dono do
-- post (moderação do próprio feed).
drop policy if exists "Post comments policy" on public.post_comments;
drop policy if exists "post_comments readable if post readable" on public.post_comments;
create policy "post_comments readable if post readable"
    on public.post_comments for select to authenticated
    using (public.can_read_post(post_id));
drop policy if exists "post_comments insert own" on public.post_comments;
create policy "post_comments insert own"
    on public.post_comments for insert to authenticated
    with check ((select auth.uid()) = author_id);
drop policy if exists "post_comments update own" on public.post_comments;
create policy "post_comments update own"
    on public.post_comments for update to authenticated
    using ((select auth.uid()) = author_id)
    with check ((select auth.uid()) = author_id);
drop policy if exists "post_comments delete own or post owner" on public.post_comments;
create policy "post_comments delete own or post owner"
    on public.post_comments for delete to authenticated
    using (
        (select auth.uid()) = author_id
        or exists (select 1 from public.posts p
                   where p.id = post_comments.post_id and p.author_id = (select auth.uid()))
    );

-- ---------------------------------------------------------------------------
-- 3. MÉDIO — Selo auto-concedido: user_badges gravável pelo próprio usuário
-- ---------------------------------------------------------------------------
-- FOR ALL USING (auth.uid()=user_id) deixava o usuário inserir o próprio selo
-- direto. Fecha a escrita direta; a concessão passa a ser só pela RPC abaixo,
-- que exige que o usuário tenha estado inscrito no desafio do selo.
-- Bloqueia só ESCRITA direta (insert/update/delete). Não mexe em SELECT — a
-- policy "readable by everyone" continua; usar FOR ALL using(false) arriscaria
-- confundir a leitura. Admin ainda pode gravar selo (global) direto pelo painel.
drop policy if exists "User badges editable by owner" on public.user_badges;
drop policy if exists "user_badges no direct write" on public.user_badges;
drop policy if exists "user_badges insert only admin" on public.user_badges;
create policy "user_badges insert only admin"
    on public.user_badges for insert to authenticated
    with check (public.is_admin());
drop policy if exists "user_badges update only admin" on public.user_badges;
create policy "user_badges update only admin"
    on public.user_badges for update to authenticated
    using (public.is_admin()) with check (public.is_admin());
drop policy if exists "user_badges delete only admin" on public.user_badges;
create policy "user_badges delete only admin"
    on public.user_badges for delete to authenticated
    using (public.is_admin());

create or replace function public.award_challenge_badge(p_badge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid uuid := auth.uid();
    v_challenge uuid;
begin
    if v_uid is null then
        return false;
    end if;
    select challenge_id into v_challenge from public.badges where id = p_badge_id;
    -- Selo global (challenge_id NULL) não pode ser auto-concedido por ninguém —
    -- só admin, por escrita direta. Selo de desafio exige pertencimento.
    if v_challenge is null then
        return false;
    end if;
    if not public.is_challenge_member(v_challenge, v_uid) then
        return false;
    end if;
    insert into public.user_badges (user_id, badge_id)
    values (v_uid, p_badge_id)
    on conflict do nothing;
    return true;
end;
$$;

revoke all on function public.award_challenge_badge(uuid) from public, anon;
grant execute on function public.award_challenge_badge(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. ALTO — Fotos de check-in e capas de desafio não carregam (Storage RLS)
-- ---------------------------------------------------------------------------
-- A policy de leitura do bucket challenge_photos checava challenge_enrollments,
-- mas o app inscreve em challenge_participants — logo a foto nunca era legível.
-- E a de escrita exigia o path .../users/<uid>/..., rejeitando a capa (covers/…).
drop policy if exists "Enrolled users can view photos" on storage.objects;
drop policy if exists "challenge photos readable by members or public covers" on storage.objects;
create policy "challenge photos readable by members or public covers"
    on storage.objects for select to authenticated
    using (
        bucket_id = 'challenge_photos'
        and (
            -- capas ficam em covers/… e são públicas para todos os autenticados
            name like 'covers/%'
            or (
                -- fotos de check-in: só membros do desafio (path challenges/<cid>/users/<uid>/…)
                (regexp_split_to_array(name, '/'))[1] = 'challenges'
                and public.is_challenge_member(
                    (regexp_split_to_array(name, '/'))[2]::uuid, auth.uid())
            )
        )
    );

-- Escrita: cada usuário só grava DENTRO da própria pasta, tanto na capa quanto
-- no check-in. Antes 'covers/%' era liberado a qualquer autenticado (o bucket
-- virava hosting público arbitrário) e o check-in não exigia path 'challenges/…'.
-- Capa passa a ser covers/<uid>/<arquivo> (o app foi ajustado).
drop policy if exists "Users can upload their own photos" on storage.objects;
drop policy if exists "users upload own check-in or cover" on storage.objects;
create policy "users upload own check-in or cover"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'challenge_photos'
        and (
            (   -- capa: covers/<uid>/…
                (regexp_split_to_array(name, '/'))[1] = 'covers'
                and auth.uid()::text = lower((regexp_split_to_array(name, '/'))[2])
            )
            or
            (   -- check-in: challenges/<cid>/users/<uid>/…, e tem que ser membro
                (regexp_split_to_array(name, '/'))[1] = 'challenges'
                and auth.uid()::text = lower((regexp_split_to_array(name, '/'))[4])
                and public.is_challenge_member(
                    (regexp_split_to_array(name, '/'))[2]::uuid, auth.uid())
            )
        )
    );

-- ---------------------------------------------------------------------------
-- 5. ALTO — Check-in: coluna gravada (points_earned) e pontos nunca somados
-- ---------------------------------------------------------------------------
-- challenge_daily_logs tem a coluna `points` (Bloco A); o app gravava
-- `points_earned` (inexistente) e nunca atualizava total_points/current_streak
-- do participante — o ranking do desafio ficava sempre em zero.
-- RPC única: grava o check-in e incrementa pontos/ofensiva na mesma transação.
-- Coluna de data-civil explícita + índice único: garante 1 check-in por dia de
-- forma ATÔMICA. Sem isso, duas chamadas concorrentes liam "ainda não fez" e
-- ambas inseriam (corrida dobrando pontos); e um log virando 'reported' abria
-- replay no mesmo dia. O índice cobre QUALQUER status, fechando os dois furos.
alter table public.challenge_daily_logs
    add column if not exists checkin_date date;
create unique index if not exists challenge_daily_logs_one_per_day
    on public.challenge_daily_logs (challenge_id, user_id, checkin_date)
    where checkin_date is not null;

create or replace function public.submit_challenge_checkin(
    p_challenge_id uuid,
    p_photo_url text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid uuid := auth.uid();
    v_today date := (now() at time zone 'America/Sao_Paulo')::date;
    v_inserted int;
begin
    if v_uid is null or not public.is_challenge_member(p_challenge_id, v_uid) then
        return false;
    end if;

    -- Insere confiando no índice único: se já houver check-in do dia (qualquer
    -- status), o ON CONFLICT não insere e a soma de pontos não roda. Atômico,
    -- sem corrida.
    -- O ON CONFLICT repete o predicado do índice PARCIAL (where checkin_date is
    -- not null) — sem ele o Postgres não casa o arbiter e lança 42P10, quebrando
    -- todo check-in em runtime.
    -- points_earned é o nome real da coluna (não `points`); o valor 10 é
    -- deliberado e casa com o +10 em total_points logo abaixo — o default 100
    -- da tabela vale para outros fluxos, não para o check-in diário.
    insert into public.challenge_daily_logs
        (challenge_id, user_id, photo_url, status, points_earned, checkin_date)
    values (p_challenge_id, v_uid, p_photo_url, 'valid', 10, v_today)
    on conflict (challenge_id, user_id, checkin_date)
        where checkin_date is not null do nothing;

    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
        return false; -- já tinha check-in hoje
    end if;

    update public.challenge_participants
       set total_points = total_points + 10,
           current_streak = current_streak + 1,
           max_streak = greatest(max_streak, current_streak + 1)
     where challenge_id = p_challenge_id and user_id = v_uid;

    return true;
end;
$$;

revoke all on function public.submit_challenge_checkin(uuid, text) from public, anon;
grant execute on function public.submit_challenge_checkin(uuid, text) to authenticated;

-- Fecha o INSERT direto em challenge_daily_logs: com o índice único PARCIAL,
-- um insert direto via PostgREST com checkin_date NULL furava o "1 por dia".
-- Todo check-in agora passa pela RPC (que sempre preenche checkin_date).
drop policy if exists "users write their own check-ins" on public.challenge_daily_logs;

-- ---------------------------------------------------------------------------
-- 6. MÉDIO — Participante inflava o próprio ranking com PATCH direto
-- ---------------------------------------------------------------------------
-- A policy de UPDATE em challenge_participants deixava o dono alterar qualquer
-- coluna da própria linha, inclusive total_points/current_streak. Como toda
-- escrita legítima agora passa por RPC (join, weight goal, check-in), revoga o
-- UPDATE direto de authenticated na tabela.
revoke update on public.challenge_participants from authenticated;

-- ---------------------------------------------------------------------------
-- 7. MÉDIO/BAIXO — Colunas e tabela que o app grava e não existem no schema
-- ---------------------------------------------------------------------------
-- Sem elas, os inserts caíam no catch silencioso e o recurso "gravava" nada.
-- system_log_content é jsonb: o app grava/lê um OBJETO estruturado
-- (SystemLogContent). Como text, o insert do objeto falharia e o decode quebraria.
alter table public.posts
    add column if not exists post_type text not null default 'photo',
    add column if not exists system_log_content jsonb;

-- posts.image_url é NOT NULL, mas post de sistema (conclusão de desafio) não tem
-- imagem. Torna opcional para o post de sistema poder existir.
alter table public.posts alter column image_url drop not null;

alter table public.diet_logs
    add column if not exists photo_url text,
    add column if not exists skip_reason text;

-- Colunas conferidas contra DBDailyCheckInInput (sleep_hours/energy_level/
-- stress_level) — antes eu tinha criado mood/note, que o app não grava, e o
-- insert falharia igual.
create table if not exists public.daily_checkins (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references public.profiles(id) on delete cascade,
    date         date not null default (now() at time zone 'America/Sao_Paulo')::date,
    sleep_hours  numeric,
    energy_level int,
    stress_level int,
    created_at   timestamptz not null default now(),
    unique (user_id, date)
);
alter table public.daily_checkins
    add column if not exists sleep_hours  numeric,
    add column if not exists energy_level int,
    add column if not exists stress_level int;
alter table public.daily_checkins enable row level security;
drop policy if exists "own daily checkins" on public.daily_checkins;
create policy "own daily checkins"
    on public.daily_checkins for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

commit;
