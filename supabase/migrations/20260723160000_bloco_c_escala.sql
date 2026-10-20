-- 20260723160000_bloco_c_escala.sql
--
-- Bloco C da auditoria — escala e desempenho.
-- Índices que faltam para as consultas quentes, e RPCs que substituem
-- "baixar a tabela inteira para calcular no cliente".
--
-- Idempotente. Aplicar com: supabase db push.

begin;

-- Nota de operação: os CREATE INDEX abaixo tomam SHARE (bloqueia escrita) nas
-- tabelas afetadas até o commit, e o ALTER TABLE challenges toma ACCESS
-- EXCLUSIVE. Na base atual (fase de teste) a janela é irrelevante. Se esta
-- migration for aplicada quando posts/profiles já forem grandes, crie os
-- índices ANTES, fora de transação, com `create index concurrently if not
-- exists <mesma definição>` — os `if not exists` daqui então viram no-op.
set local search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- 1. ALTO — Feed ordenado por data sem índice
-- ---------------------------------------------------------------------------
-- O feed faz order by created_at desc; só existia índice em author_id, então o
-- Postgres ordenava a tabela inteira a cada abertura da aba Comunidade.
-- (created_at desc, id desc): casa exatamente com a ordenação e o cursor
-- composto da paginação do feed. Só created_at deixaria o desempate por id
-- fora do índice.
create index if not exists posts_created_at_idx
    on public.posts (created_at desc, id desc);

-- Feed por desafio (a aba filtra por attached_challenge_id). Mesmo desempate
-- por id do índice global: o keyset da aba de desafio usa o mesmo cursor.
create index if not exists posts_challenge_created_idx
    on public.posts (attached_challenge_id, created_at desc, id desc)
    where attached_challenge_id is not null;

-- Comentários são lidos por post, em ordem. idx_post_comments_post (só post_id,
-- schema.sql:398) vira subconjunto redundante deste e é removido — manter os
-- dois só encareceria INSERT/DELETE de comentário.
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);
drop index if exists public.idx_post_comments_post;

-- Curtidas por post JÁ têm índice: idx_post_likes_post (schema.sql:397). Criar
-- post_likes_post_idx duplicaria a definição — o `if not exists` compara nome,
-- não definição, e os dois conviveriam dobrando o custo de escrita.

-- Check-ins: a consulta quente é "este usuário já fez check-in hoje neste
-- desafio", filtrada por (challenge_id, user_id).
create index if not exists challenge_daily_logs_challenge_user_idx
    on public.challenge_daily_logs (challenge_id, user_id, created_at desc);
-- E o histórico do próprio usuário, por data.
create index if not exists challenge_daily_logs_user_idx
    on public.challenge_daily_logs (user_id, created_at desc);

-- Ranking do desafio: challenge_my_rank ordena por total_points. Sem este
-- índice a RPC de posição faz sort de todos os participantes a cada chamada.
create index if not exists challenge_participants_rank_idx
    on public.challenge_participants (challenge_id, total_points desc);

-- ---------------------------------------------------------------------------
-- 2. MÉDIO — Busca de pessoas: ilike '%termo%' sem índice compatível
-- ---------------------------------------------------------------------------
-- Um LIKE com curinga à esquerda não usa índice B-tree; a busca varria todos os
-- perfis. Trigrama resolve.
-- `with schema extensions` é a convenção do Supabase. E a operator class é
-- qualificada: se pg_trgm já existir em `extensions`, o `if not exists` vira
-- no-op e um `gin_trgm_ops` sem qualificação falharia quando `extensions` não
-- estiver no search_path da sessão que aplica a migration.
create extension if not exists pg_trgm with schema extensions;
create index if not exists profiles_name_trgm_idx
    on public.profiles using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 3. ALTO — Posição no ranking calculada baixando o ranking inteiro
-- ---------------------------------------------------------------------------
-- O app baixava weekly_leaderboard e challenge_participants completos só para
-- achar o índice do próprio usuário. Com base grande isso é O(n) de rede por
-- abertura de tela. As RPCs devolvem um inteiro.
create or replace function public.my_weekly_rank(p_year int, p_week int)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select r.pos from (
        select user_id, rank() over (order by xp_gained desc) as pos
        from public.weekly_leaderboard
        where year = p_year and week_number = p_week
    ) r
    where r.user_id = auth.uid();
$$;

revoke all on function public.my_weekly_rank(int, int) from public, anon;
grant execute on function public.my_weekly_rank(int, int) to authenticated;

create or replace function public.challenge_my_rank(p_challenge_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select r.pos from (
        select user_id, rank() over (order by total_points desc) as pos
        from public.challenge_participants
        where challenge_id = p_challenge_id
    ) r
    where r.user_id = auth.uid();
$$;

revoke all on function public.challenge_my_rank(uuid) from public, anon;
grant execute on function public.challenge_my_rank(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. MÉDIO — Contagem de participantes agregava a tabela inteira a cada carga
-- ---------------------------------------------------------------------------
-- Substitui a agregação por um contador materializado em challenges, mantido por
-- trigger. A RPC challenge_participant_counts (Bloco A) passa a ler o contador.
alter table public.challenges
    add column if not exists participant_count int not null default 0;

update public.challenges c
   set participant_count = coalesce((
       select count(*) from public.challenge_participants p where p.challenge_id = c.id
   ), 0);

create or replace function public.sync_challenge_participant_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if tg_op = 'INSERT' then
        update public.challenges set participant_count = participant_count + 1
         where id = new.challenge_id;
    elsif tg_op = 'DELETE' then
        update public.challenges set participant_count = greatest(0, participant_count - 1)
         where id = old.challenge_id;
    -- Mover um participante de desafio (UPDATE de challenge_id) deixava os DOIS
    -- contadores errados: o de origem inflado e o de destino defasado.
    elsif tg_op = 'UPDATE' and new.challenge_id is distinct from old.challenge_id then
        update public.challenges set participant_count = greatest(0, participant_count - 1)
         where id = old.challenge_id;
        update public.challenges set participant_count = participant_count + 1
         where id = new.challenge_id;
    end if;
    return null;
end;
$$;

drop trigger if exists challenge_participant_count_sync on public.challenge_participants;
create trigger challenge_participant_count_sync
    after insert or delete or update of challenge_id on public.challenge_participants
    for each row execute function public.sync_challenge_participant_count();

-- Agora lê o contador em vez de agregar. Mesma assinatura e mesmo gate de
-- visibilidade do Bloco A; o conjunto de linhas muda de propósito: a versão
-- antiga partia de challenge_participants com group by e omitia os desafios sem
-- ninguém, esta parte de challenges e devolve também os de contagem 0 (o app
-- mapeia por challenge_id, e "0" é exatamente o que a vitrine deve mostrar).
create or replace function public.challenge_participant_counts()
returns table (challenge_id uuid, participant_count int)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
    select c.id, c.participant_count
    from public.challenges c
    where c.visibility = 'public'
       or c.creator_id = auth.uid()
       or public.is_challenge_member(c.id, auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- 5. MÉDIO — Copiar plano de treino era um N+1 de inserts sequenciais
-- ---------------------------------------------------------------------------
-- O app fazia um insert por treino, por exercício e por série, em laço. Uma RPC
-- duplica tudo em insert…select, numa transação só.
--
-- p_from é o ID do USUÁRIO fonte: a função existe para "copiar o plano inteiro
-- deste membro para o meu perfil" (MemberProfileDetailView), então copia em
-- lote por desenho. O que ela NÃO pode copiar:
--   * treinos de desafio (challenge_id not null) — can_read_workout os libera
--     para qualquer autenticado, e sem este filtro qualquer um extraía o
--     conteúdo de desafios pagos dos quais nem participa;
--   * rascunhos e arquivados — o clone nasce 'published', então copiar um
--     draft/archived republicaria conteúdo que o dono tirou do ar.
create or replace function public.copy_workout_plan(p_from uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid uuid := auth.uid();
    v_count int := 0;
    r record;
    v_new_workout uuid;
    v_new_exercise uuid;
    e record;
begin
    if v_uid is null then
        return 0;
    end if;

    -- Colunas conferidas contra o schema: workouts tem title/duration_minutes/
    -- focus (não "name"), e os dias vivem em workout_days, não numa coluna.
    for r in
        select * from public.workouts w
        where w.creator_id = p_from
          and public.can_read_workout(w.id)   -- respeita a visibilidade do dono
          and w.challenge_id is null           -- nunca extrai conteúdo de desafio
          and coalesce(w.status, 'published') = 'published'
          -- Guarda de idempotência: sem ela, tocar duas vezes no botão (ou um
          -- retry de rede) duplicava a biblioteca inteira a cada chamada.
          and not exists (
              select 1 from public.workouts meu
              where meu.creator_id = v_uid
                and meu.title = w.title
                and meu.focus = w.focus
          )
        -- Teto por chamada: sem limite, um cliente em retry (ou um chamador
        -- malicioso em laço) amplifica inserts sem freio — o oposto do objetivo
        -- deste bloco. 50 treinos é muito acima de qualquer plano real.
        limit 50
    loop
        insert into public.workouts (title, duration_minutes, focus, creator_id, is_template, status)
        values (r.title, r.duration_minutes, r.focus, v_uid, false, 'published')
        returning id into v_new_workout;

        -- Dias da semana do plano, com a ordem preservada: sem order_index todos
        -- os dias do clone caíam em 0 e a semana perdia a sequência.
        insert into public.workout_days (workout_id, day_of_week, order_index)
        select v_new_workout, d.day_of_week, d.order_index
        from public.workout_days d where d.workout_id = r.id;

        for e in select * from public.exercises where workout_id = r.id order by order_index
        loop
            insert into public.exercises (workout_id, name, muscle, rest_seconds, order_index)
            values (v_new_workout, e.name, e.muscle, e.rest_seconds, e.order_index)
            returning id into v_new_exercise;

            insert into public.exercise_sets (exercise_id, reps, weight, order_index)
            select v_new_exercise, s.reps, s.weight, s.order_index
            from public.exercise_sets s where s.exercise_id = e.id;
        end loop;

        v_count := v_count + 1;
    end loop;

    return v_count;
end;
$$;

revoke all on function public.copy_workout_plan(uuid) from public, anon;
grant execute on function public.copy_workout_plan(uuid) to authenticated;

commit;
