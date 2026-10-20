-- 20260723120000_bloco_a_seguranca.sql
--
-- Bloco A da auditoria — correções de segurança no banco.
-- Cobre: escalação de privilégio, moderação de conteúdo, vazamento de planos e
-- de dados de saúde, criação de desafio forjada, e score diário exposto.
--
-- Idempotente. Aplicar com: supabase db push  (ou colar no SQL editor do painel).

begin;

-- ---------------------------------------------------------------------------
-- 1. CRÍTICO — Escalação de privilégio: proteger profiles.role
-- ---------------------------------------------------------------------------
-- A policy "Users can update their own profile" tem WITH CHECK (auth.uid()=id)
-- sem restrição de coluna, e nada impedia o usuário de setar o próprio
-- role='admin' via PATCH direto no PostgREST — virando admin de plataforma e
-- lendo chaves de IA e dados de saúde de toda a base. A migration de role
-- endureceu is_platform_admin() mas nunca protegeu a coluna em si.
--
-- Um trigger é mais robusto que grant de coluna (que quebraria updates legítimos
-- de nome/avatar). Ele deixa a mudança de papel passar apenas quem já é admin
-- de plataforma — inclusive o admin_set_role() abaixo, que roda como o admin.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if tg_op = 'INSERT' then
        -- INSERT também precisa de guarda: sem ela, se houver policy de self-insert
        -- em profiles, o usuário criaria a própria linha já com role='admin'. Quem
        -- não é admin de plataforma nasce sempre como 'user'. O signup normal
        -- (handle_new_user) insere role='user' de qualquer forma.
        if new.role is distinct from 'user' and not public.is_platform_admin() then
            new.role := 'user';
        end if;
        return new;
    end if;

    -- UPDATE: só admin de plataforma muda papel.
    if new.role is distinct from old.role then
        if not public.is_platform_admin() then
            raise exception 'not authorized to change role'
                using errcode = '42501';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists guard_role_change on public.profiles;
create trigger guard_role_change
    before insert or update on public.profiles
    for each row execute function public.prevent_role_self_escalation();

-- RPC oficial para o painel promover/rebaixar, com checagem de papel, em vez de
-- UPDATE direto (que a RLS bloqueia silenciosamente e o painel reporta sucesso).
create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.is_platform_admin() then
        raise exception 'not authorized' using errcode = '42501';
    end if;
    if p_role not in ('user', 'professional', 'admin') then
        raise exception 'invalid role' using errcode = '22023';
    end if;
    update public.profiles set role = p_role where id = p_user_id;
    return found;
end;
$$;

revoke all on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. CRÍTICO — Moderação: admin precisa apagar post e comentário denunciados
-- ---------------------------------------------------------------------------
-- As únicas policies de DELETE em posts/post_comments eram "o dono apaga o
-- próprio". O painel roda como `authenticated` (chave anon), então o DELETE de
-- moderação casava zero linhas e o PostgREST devolvia sucesso: o painel
-- comemorava e o conteúdo continuava no ar.
drop policy if exists "Admins can manage all posts" on public.posts;
create policy "Admins can manage all posts"
    on public.posts for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists "Admins can manage all comments" on public.post_comments;
create policy "Admins can manage all comments"
    on public.post_comments for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. ALTO — Vazamento de planos: workouts/diets liberados com using(true)
-- ---------------------------------------------------------------------------
-- A migration de compartilhamento abriu o SELECT de workouts/diets para
-- QUALQUER autenticado, expondo o plano pessoal de todo mundo pela API. Troca
-- por: dono, ou template, ou plano de desafio, ou dono de perfil público sem
-- bloqueio recíproco — o mesmo espírito da policy de posts.
-- Helpers de visibilidade — a MESMA regra vale para a tabela-pai e para as
-- sub-tabelas. Trancar só workouts/diets deixava o CONTEÚDO (exercícios, séries,
-- refeições, itens) legível por qualquer autenticado via API, porque essas
-- sub-tabelas tinham SELECT USING(true). Centralizar numa função evita a regra
-- divergir entre pai e filho.
create or replace function public.can_read_workout(p_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1 from public.workouts w
        where w.id = p_workout_id
          and (
              w.creator_id = auth.uid()
              or w.is_template = true
              or w.challenge_id is not null
              or (
                  exists (select 1 from public.profiles p
                          where p.id = w.creator_id and p.public_profile = true)
                  and not exists (select 1 from public.user_blocks b
                          where (b.blocker_id = auth.uid() and b.blocked_id = w.creator_id)
                             or (b.blocker_id = w.creator_id and b.blocked_id = auth.uid()))
              )
          )
    );
$$;

create or replace function public.can_read_diet(p_diet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1 from public.diets d
        where d.id = p_diet_id
          and (
              d.creator_id = auth.uid()
              or d.is_template = true
              or d.challenge_id is not null
              or (
                  exists (select 1 from public.profiles p
                          where p.id = d.creator_id and p.public_profile = true)
                  and not exists (select 1 from public.user_blocks b
                          where (b.blocker_id = auth.uid() and b.blocked_id = d.creator_id)
                             or (b.blocker_id = d.creator_id and b.blocked_id = auth.uid()))
              )
          )
    );
$$;

grant execute on function public.can_read_workout(uuid) to authenticated;
grant execute on function public.can_read_diet(uuid) to authenticated;

drop policy if exists "Athletes can view other athletes workouts" on public.workouts;
create policy "Athletes can view other athletes workouts"
    on public.workouts for select to authenticated
    using (public.can_read_workout(id));

drop policy if exists "Athletes can view other athletes diets" on public.diets;
create policy "Athletes can view other athletes diets"
    on public.diets for select to authenticated
    using (public.can_read_diet(id));

-- Sub-tabelas: o CONTEÚDO do plano (exercícios, séries, dias, refeições, itens)
-- tinha SELECT USING(true) e ficava legível por qualquer autenticado direto pela
-- API. Trancar por nome de policy é frágil: se o nome no banco divergir do repo
-- (ex.: default do Supabase), o DROP falha e, como policies de SELECT se combinam
-- por OR, o using(true) sobrevive. Então dropamos TODA policy de SELECT dessas
-- tabelas por varredura no catálogo, e só então criamos a restritiva. As policies
-- FOR ALL do dono (escrita) não são de comando SELECT e permanecem intactas.
do $$
declare
    r record;
begin
    for r in
        select policyname, tablename
        from pg_policies
        where schemaname = 'public'
          and tablename in ('exercises','exercise_sets','workout_days','meals','meal_items')
          and cmd = 'SELECT'
    loop
        execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    end loop;
end $$;

drop policy if exists "exercises readable if parent workout readable" on public.exercises;
create policy "exercises readable if parent workout readable"
    on public.exercises for select to authenticated
    using (public.can_read_workout(workout_id));

drop policy if exists "exercise_sets readable if parent readable" on public.exercise_sets;
create policy "exercise_sets readable if parent readable"
    on public.exercise_sets for select to authenticated
    using (exists (select 1 from public.exercises e
                   where e.id = exercise_sets.exercise_id
                     and public.can_read_workout(e.workout_id)));

drop policy if exists "workout_days readable if parent readable" on public.workout_days;
create policy "workout_days readable if parent readable"
    on public.workout_days for select to authenticated
    using (public.can_read_workout(workout_id));

drop policy if exists "meals readable if parent diet readable" on public.meals;
create policy "meals readable if parent diet readable"
    on public.meals for select to authenticated
    using (public.can_read_diet(diet_id));

drop policy if exists "meal_items readable if parent readable" on public.meal_items;
create policy "meal_items readable if parent readable"
    on public.meal_items for select to authenticated
    using (exists (select 1 from public.meals m
                   where m.id = meal_items.meal_id
                     and public.can_read_diet(m.diet_id)));

-- ---------------------------------------------------------------------------
-- 4. ALTO — Dados de saúde: qualquer 'professional' lia lesões/alergias de todos
-- ---------------------------------------------------------------------------
-- A policy liberava leitura de TODA a tabela user_health_profile para qualquer
-- profissional, sem consentimento nem vínculo. Dado de saúde é o mais sensível
-- do app. Restringe a admin de plataforma; o painel de saúde deve ler via RPC
-- auditada, não pela tabela crua. (O próprio usuário segue lendo o seu, e o app
-- lê o do usuário logado por my_health_profile().)
drop policy if exists "Professionals/Admins can read all health profiles" on public.user_health_profile;
-- Também o próprio nome novo: sem este drop a migration só roda UMA vez
-- ("policy already exists" na reaplicação) — todas as outras policies deste
-- arquivo seguem o padrão drop-antes-de-create; esta era a única fora dele.
drop policy if exists "Platform admins can read all health profiles" on public.user_health_profile;
create policy "Platform admins can read all health profiles"
    on public.user_health_profile for select
    to authenticated
    using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 5. MÉDIO — Criação de desafio forjada com tier 'admin' / is_featured
-- ---------------------------------------------------------------------------
-- A policy de INSERT só exigia creator_id = auth.uid(). Um cliente adulterado
-- criava desafio com tier='admin' (selo oficial) e is_featured=true, entrando
-- na vitrine. Amarra tier e destaque no INSERT direto; o app usa a RPC
-- create_challenge_with_creator, que já força tier='free_user'.
drop policy if exists "Users can create public/private challenges" on public.challenges;
create policy "Users can create public/private challenges"
    on public.challenges for insert
    to authenticated
    with check (
        (select auth.uid()) = creator_id
        and tier = 'free_user'
        and is_featured = false
    );

-- ---------------------------------------------------------------------------
-- 6. MÉDIO — Denúncia de foto de check-in não tinha policy de UPDATE
-- ---------------------------------------------------------------------------
-- challenge_daily_logs só tinha INSERT; marcar status='reported' não afetava
-- nada. Permite o dono editar a própria linha e qualquer membro do desafio
-- mudar só para 'reported'.
do $$
begin
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = 'challenge_daily_logs') then
        drop policy if exists "owner updates own check-in" on public.challenge_daily_logs;
        create policy "owner updates own check-in"
            on public.challenge_daily_logs for update
            to authenticated
            using (user_id = (select auth.uid()))
            with check (user_id = (select auth.uid()));

        -- Denúncia NÃO vira policy de UPDATE aberta a membros: o WITH CHECK só
        -- valida a coluna status, e a RLS não torna as demais imutáveis, então um
        -- membro poderia sobrescrever a foto/pontos do check-in de outro desde que
        -- deixasse status='reported'. Removida em favor da RPC report_challenge_checkin.
        drop policy if exists "members can report check-ins" on public.challenge_daily_logs;
    end if;
end $$;

-- Denúncia de check-in via RPC: seta APENAS status='reported', em linha que não
-- é do próprio denunciante, exigindo que ambos sejam do mesmo desafio. Nenhuma
-- outra coluna é tocada — fecha o vandalismo que uma policy de UPDATE abriria.
create or replace function public.report_challenge_checkin(p_log_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_challenge uuid;
    v_owner uuid;
begin
    select challenge_id, user_id into v_challenge, v_owner
    from public.challenge_daily_logs where id = p_log_id;
    if v_challenge is null then
        return false;
    end if;
    if v_owner = auth.uid() then
        return false; -- não faz sentido denunciar o próprio
    end if;
    if not public.is_challenge_member(v_challenge, auth.uid()) then
        return false;
    end if;
    update public.challenge_daily_logs
       set status = 'reported'
     where id = p_log_id;
    return true;
end;
$$;

revoke all on function public.report_challenge_checkin(uuid) from public, anon;
grant execute on function public.report_challenge_checkin(uuid) to authenticated;

-- RPC para o painel ler alergias/lesões de um usuário. A tabela crua ficou
-- restrita a is_platform_admin(); esta função devolve o dado para QUALQUER staff
-- (admin ou professional, via is_admin()), preservando o card de saúde do painel
-- sem reabrir a tabela para a base inteira.
create or replace function public.admin_health_profile(p_user_id uuid)
returns table (injuries text[], allergies text[])
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    -- is_platform_admin (só role='admin'), NÃO is_admin (que inclui 'professional').
    -- Dado de saúde não pode ser lido por qualquer profissional sem consentimento —
    -- esse era exatamente o achado original. Profissional lê saúde só pelos fluxos
    -- de consentimento (user_health_daily etc.), não a alergia/lesão arbitrária.
    if not public.is_platform_admin() then
        raise exception 'not authorized' using errcode = '42501';
    end if;
    return query
    select h.injuries, h.allergies
    from public.user_health_profile h
    where h.user_id = p_user_id;
end;
$$;

revoke all on function public.admin_health_profile(uuid) from public, anon;
grant execute on function public.admin_health_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. BAIXO — daily_scores exposto: histórico diário de todos legível
-- ---------------------------------------------------------------------------
-- SELECT USING(true) deixava qualquer autenticado ler o histórico de atividade
-- diária de qualquer usuário. Restringe ao dono; comparação social, se
-- precisar, vai por RPC agregada (padrão já usado no ranking de desafio).
-- CONDICIONAL: `daily_scores` não existe neste banco (confirmado em 27/07/2026;
-- a tabela de check-in diário aqui é `daily_checkins`, que guarda sono/energia/
-- estresse e já restringe ao dono). Sem a guarda, o "relation does not exist"
-- aborta a migration inteira e leva junto as outras 7 correções deste arquivo.
-- Com a guarda, a correção continua valendo para qualquer ambiente que TENHA a
-- tabela, sem travar os que não têm.
do $daily_scores$
begin
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = 'daily_scores') then
        execute 'drop policy if exists "Daily scores are select-only for authenticated" on public.daily_scores';
        execute 'drop policy if exists "Users read their own daily scores" on public.daily_scores';
        execute 'create policy "Users read their own daily scores"
                     on public.daily_scores for select
                     to authenticated
                     using ((select auth.uid()) = user_id)';
    else
        raise notice 'daily_scores não existe neste banco — item 7 do bloco A não se aplica';
    end if;
end
$daily_scores$;

-- ---------------------------------------------------------------------------
-- 8. ALTO — Exclusão de conta não removia a foto de perfil do Storage
-- ---------------------------------------------------------------------------
-- delete_user_account() apagava auth.users (cascade limpa profiles etc.), mas o
-- avatar em Storage (bucket 'avatars', arquivo '<uid>.jpg') não é cascade e
-- continuava público por URL depois da conta excluída. Recria a função apagando
-- o objeto do Storage antes de remover o usuário.
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        raise exception 'Not authenticated';
    end if;
    -- Storage não é cascade: todas as imagens pessoais têm que sair na mão, senão
    -- continuam públicas por URL depois da conta excluída (violação de LGPD).
    -- 1. Foto de perfil (case-insensitive: app grava UUID maiúsculo, PG é minúsculo).
    delete from storage.objects
     where bucket_id = 'avatars' and lower(name) = lower(v_uid::text) || '.jpg';
    -- 2. Fotos de check-in de desafio (fotos de corpo/progresso).
    delete from storage.objects
     where bucket_id = 'challenge_photos'
       and name like 'challenges/%/users/' || lower(v_uid::text) || '/%';
    -- 3. Imagens de post da comunidade (nome é UUID aleatório; casa pela URL do post).
    delete from storage.objects o
     using public.posts p
     where p.author_id = v_uid
       and o.bucket_id = 'posts'
       and p.image_url like '%/' || o.name;

    delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_user_account() from public, anon;
grant execute on function public.delete_user_account() to authenticated;

commit;
