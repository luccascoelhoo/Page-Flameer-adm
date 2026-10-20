-- 20260722100000_challenge_invites_and_weight_goals.sql
--
-- 1. Remove a inscrição automática em desafio para contas novas e existentes.
-- 2. Convite por código: RPC segura que entra num desafio privado sem expor
--    invite_code em leitura pública.
-- 3. Desafio de meta de peso: meta por participante e ranking por percentual,
--    sem que o peso absoluto de ninguém saia do servidor.
--
-- Idempotente: pode rodar mais de uma vez sem quebrar.
-- Nomes de coluna conferidos contra supabase/schema.sql (daily_habit_logs.done,
-- diet_logs.consumed, workout_logs.date).

begin;

-- ---------------------------------------------------------------------------
-- 0. Estrutura que o app já usa mas nunca foi versionada
-- ---------------------------------------------------------------------------

-- O app insere estas colunas em `challenges` desde sempre (CreateChallengeSheet),
-- mas elas não estão no schema base. Sem elas a RPC de convite não compila a
-- consulta e a criação de desafio privado quebra.
alter table public.challenges
    add column if not exists invite_code      text,
    add column if not exists max_participants int,
    add column if not exists challenge_type   text,
    add column if not exists goal_type        text not null default 'activity';

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'challenges_goal_type_check'
    ) then
        alter table public.challenges
            add constraint challenges_goal_type_check
            check (goal_type in ('activity', 'weight_goal'));
    end if;
end $$;

-- Código de convite precisa ser único e insensível a caixa: o app gera no
-- cliente e a busca usa upper(). Sem unicidade, uma colisão manda o convidado
-- para o desafio errado silenciosamente.
update public.challenges set invite_code = share_code where invite_code is null;

-- `share_code` é único mas SENSÍVEL a caixa: dois códigos que diferem só no
-- caixa colidem sob upper() e abortariam a criação do índice — e, com ela, a
-- migration inteira. Regera os duplicados antes.
with dups as (
    select id, row_number() over (partition by upper(invite_code) order by created_at) as rn
    from public.challenges
    where invite_code is not null
)
update public.challenges c
   set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  from dups
 where dups.id = c.id and dups.rn > 1;

create unique index if not exists challenges_invite_code_unique
    on public.challenges (upper(invite_code)) where invite_code is not null;

create table if not exists public.challenge_participants (
    id           uuid primary key default gen_random_uuid(),
    challenge_id uuid not null references public.challenges(id) on delete cascade,
    user_id      uuid not null references public.profiles(id) on delete cascade,
    current_streak int not null default 0,
    max_streak     int not null default 0,
    total_points   int not null default 0,
    joined_at    timestamptz not null default now()
);

alter table public.challenge_participants
    add column if not exists joined_at      timestamptz not null default now(),
    add column if not exists current_streak int not null default 0,
    add column if not exists max_streak     int not null default 0,
    add column if not exists total_points   int not null default 0;

-- Remove duplicatas antes do índice único, senão a criação falha.
delete from public.challenge_participants a
using public.challenge_participants b
where a.ctid > b.ctid
  and a.challenge_id = b.challenge_id
  and a.user_id = b.user_id;

create unique index if not exists challenge_participants_unique
    on public.challenge_participants (challenge_id, user_id);

create index if not exists challenge_participants_user_idx
    on public.challenge_participants (user_id);

-- O app grava check-in de desafio aqui, mas a tabela nunca foi versionada.
-- ATENÇÃO: no banco real esta tabela JÁ EXISTE e com nomes diferentes dos que
-- esta migration assumia. Como o create é `if not exists`, ele não roda e não
-- corrige nada — o resto do arquivo é que precisava se alinhar ao real:
--   * a coluna de pontos chama `points_earned` (não `points`), default 100;
--   * `status` é o ENUM public.log_status (valid | reported | invalid), não text
--     com check — por isso 'removed' não existe e nunca deve ser usado;
--   * existe também `rule_id`, referenciando challenge_rules.
-- A declaração abaixo foi alinhada ao real para que um banco NOVO nasça igual
-- ao de produção. Verificado com \d em 27/07/2026.
create table if not exists public.challenge_daily_logs (
    id            uuid primary key default gen_random_uuid(),
    challenge_id  uuid not null references public.challenges(id) on delete cascade,
    user_id       uuid not null references public.profiles(id) on delete cascade,
    rule_id       uuid references public.challenge_rules(id) on delete set null,
    photo_url     varchar(512),
    points_earned int not null default 100,
    status        public.log_status not null default 'valid',
    created_at    timestamptz default now()
);

create index if not exists challenge_daily_logs_challenge_idx
    on public.challenge_daily_logs (challenge_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 1. Meta de peso em tabela PRÓPRIA
-- ---------------------------------------------------------------------------
--
-- Peso é o dado mais íntimo do app. Guardar em challenge_participants obrigaria
-- a policy de leitura do ranking a liberar a linha inteira — e aí qualquer
-- membro leria o peso absoluto dos outros direto pelo PostgREST, furando a
-- regra de privacidade. Em tabela separada, a policy é "só a própria linha", e
-- o percentual sai exclusivamente pela RPC.
create table if not exists public.challenge_weight_goals (
    challenge_id   uuid not null references public.challenges(id) on delete cascade,
    user_id        uuid not null references public.profiles(id) on delete cascade,
    start_weight   numeric(5,2),
    target_weight  numeric(5,2),
    current_weight numeric(5,2),
    updated_at     timestamptz not null default now(),
    primary key (challenge_id, user_id)
);

alter table public.challenge_weight_goals enable row level security;

drop policy if exists "weight goals are private" on public.challenge_weight_goals;
create policy "weight goals are private"
    on public.challenge_weight_goals for all
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Fim da inscrição automática
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created_join_challenge on auth.users;
drop trigger if exists auto_join_default_challenge          on auth.users;
drop trigger if exists on_profile_created_join_challenge    on public.profiles;
drop function if exists public.auto_join_default_challenge() cascade;
drop function if exists public.enroll_default_challenge()    cascade;

-- Desfaz APENAS as inscrições com assinatura de auto-join.
--
-- Critério deliberadamente estreito, porque apagar inscrição é irreversível:
--   a) o desafio tem praticamente toda a base inscrita (>= 80% dos perfis) —
--      é a marca de inscrição automática, não de adesão espontânea;
--   b) o usuário não é o criador;
--   c) não há progresso nenhum (zero ponto, zero ofensiva, zero check-in);
--   d) a inscrição é anterior à data desta migration (timestamp literal, não
--      now(): dentro da transação now() é o próprio instante do deploy e a
--      condição não filtraria nada).
--
-- Quem realmente usou o desafio mantém inscrição e histórico.
--
-- Marcador de execução única: a migration é idempotente, mas esta limpeza não
-- deve varrer de novo inscrições legítimas criadas DEPOIS do primeiro deploy.
create table if not exists public.flameer_migration_marks (
    mark       text primary key,
    applied_at timestamptz not null default now()
);

-- Tabelas de controle: RLS ligada e SEM policy nenhuma nega tudo para anon e
-- authenticated (service_role e o owner seguem passando). Sem isto, os default
-- privileges do Supabase deixariam qualquer usuário logado ler a auditoria — e
-- apagar a marca de execução única, rearmando a limpeza num redeploy.
alter table public.flameer_migration_marks enable row level security;
revoke all on public.flameer_migration_marks from anon, authenticated;

-- Auditoria antes de apagar: inscrição removida por engano precisa ter volta.
-- SEM coluna `id`: a chave real de challenge_participants é COMPOSTA
-- (challenge_id, user_id) — a tabela não tem coluna id nenhuma. A versão
-- anterior desta migration declarava `id uuid` aqui e fazia `returning cp.id`
-- lá embaixo, o que aborta com "column cp.id does not exist" e derruba a
-- migration inteira. Verificado contra o banco real em 27/07/2026.
create table if not exists public.challenge_participants_removed (
    challenge_id   uuid,
    user_id        uuid,
    current_streak int,
    max_streak     int,
    total_points   int,
    joined_at      timestamptz,
    removed_at     timestamptz not null default now(),
    removed_by     text not null default 'migration_20260722100000'
);

alter table public.challenge_participants_removed enable row level security;
revoke all on public.challenge_participants_removed from anon, authenticated;

with auto_joined as (
    select cp.challenge_id
    from public.challenge_participants cp
    join public.challenges c on c.id = cp.challenge_id
    group by cp.challenge_id, c.title
    having
        -- Alvo nominal: o desafio que era inscrito por padrão.
        c.title ilike '%abd%men%insano%'
        -- Ou a assinatura estatística de auto-join: quase toda a base dentro.
        -- O piso de 10 perfis evita que, numa base de teste com 5 contas, um
        -- grupo real de 4 amigos seja confundido com inscrição automática.
        or (
            (select count(*) from public.profiles) >= 10
            and count(*) >= (select count(*) * 0.8 from public.profiles)
        )
),
deleted as (
    delete from public.challenge_participants cp
    using public.challenges c
    where cp.challenge_id = c.id
      and cp.challenge_id in (select challenge_id from auto_joined)
      and c.creator_id is distinct from cp.user_id
      and cp.joined_at < timestamptz '2026-07-22 00:00:00+00'
      and coalesce(cp.total_points, 0) = 0
      and coalesce(cp.current_streak, 0) = 0
      and coalesce(cp.max_streak, 0) = 0
      and not exists (
          select 1 from public.challenge_daily_logs l
          where l.challenge_id = cp.challenge_id and l.user_id = cp.user_id
      )
      and not exists (
          select 1 from public.flameer_migration_marks
          where mark = 'auto_join_cleanup_20260722'
      )
    returning cp.challenge_id, cp.user_id,
              cp.current_streak, cp.max_streak, cp.total_points, cp.joined_at
)
insert into public.challenge_participants_removed
    (challenge_id, user_id, current_streak, max_streak, total_points, joined_at)
select challenge_id, user_id, current_streak, max_streak, total_points, joined_at
from deleted;

insert into public.flameer_migration_marks (mark)
values ('auto_join_cleanup_20260722')
on conflict (mark) do nothing;

-- ---------------------------------------------------------------------------
-- 3. RLS de challenge_participants
-- ---------------------------------------------------------------------------

-- Checagem de pertencimento isolada numa função SECURITY DEFINER. Consultar
-- challenge_participants de dentro da policy da própria tabela faz o Postgres
-- reavaliar a policy na subconsulta e abortar com
-- "infinite recursion detected in policy" (42P17), derrubando toda leitura.
-- Aceita p_user_id só para uso interno das policies. Perguntar por terceiros
-- transformaria a função num oráculo de "fulano está no desafio privado X?",
-- então qualquer id diferente do chamador é rejeitado.
create or replace function public.is_challenge_member(p_challenge_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
    select p_user_id is not null
       and p_user_id = auth.uid()
       and exists (
        select 1 from public.challenge_participants
        where challenge_id = p_challenge_id and user_id = p_user_id
    );
$$;

revoke all on function public.is_challenge_member(uuid, uuid) from public, anon;
grant execute on function public.is_challenge_member(uuid, uuid) to authenticated;

alter table public.challenge_participants enable row level security;

drop policy if exists "participants readable by challenge members" on public.challenge_participants;
create policy "participants readable by challenge members"
    on public.challenge_participants for select
    to authenticated
    using (
        user_id = auth.uid()
        or public.is_challenge_member(challenge_id, auth.uid())
        or exists (
            select 1 from public.challenges c
            where c.id = challenge_participants.challenge_id
              and c.visibility = 'public'
        )
    );

-- Só dá para inscrever a si mesmo.
-- Inscrição direta só em desafio PÚBLICO, aberto e com vaga. Exigir apenas
-- `user_id = auth.uid()` deixava qualquer autenticado inserir a si mesmo em
-- QUALQUER challenge_id via PostgREST — inclusive privado, sem código, sem
-- respeitar lotação ou data final. Feito isso, a pessoa virava "membro" e o
-- ranking liberava variação de peso, hábitos, treino e dieta do grupo inteiro.
-- Desafio privado passa a entrar exclusivamente por join_challenge_by_code,
-- que roda como SECURITY DEFINER e valida o convite.
drop policy if exists "users enrol themselves" on public.challenge_participants;
create policy "users enrol themselves"
    on public.challenge_participants for insert
    to authenticated
    with check (
        user_id = auth.uid()
        and exists (
            select 1 from public.challenges c
            where c.id = challenge_id
              and c.visibility = 'public'
              and (c.end_date is null or c.end_date::date >= current_date)
              and (
                  c.max_participants is null
                  or (select count(*) from public.challenge_participants p
                       where p.challenge_id = c.id) < c.max_participants
              )
        )
    );

drop policy if exists "users update their own enrolment" on public.challenge_participants;
create policy "users update their own enrolment"
    on public.challenge_participants for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists "users leave their own challenges" on public.challenge_participants;
create policy "users leave their own challenges"
    on public.challenge_participants for delete
    to authenticated
    using (user_id = auth.uid());

alter table public.challenge_daily_logs enable row level security;

drop policy if exists "check-ins visible to challenge members" on public.challenge_daily_logs;
create policy "check-ins visible to challenge members"
    on public.challenge_daily_logs for select
    to authenticated
    using (
        user_id = auth.uid()
        or public.is_challenge_member(challenge_id, auth.uid())
    );

-- Ser dono da linha não basta: sem a checagem de pertencimento, qualquer
-- autenticado inseria check-in em desafio de que não participa (inclusive
-- privado), poluindo o feed do grupo e inflando a contagem no ranking.
drop policy if exists "users write their own check-ins" on public.challenge_daily_logs;
create policy "users write their own check-ins"
    on public.challenge_daily_logs for insert
    to authenticated
    with check (
        user_id = auth.uid()
        and public.is_challenge_member(challenge_id, auth.uid())
        and status = 'valid'
        -- points_earned: nome real da coluna no banco (era `points` aqui, que
        -- não existe e derrubava a migration com "column points does not exist")
        and coalesce(points_earned, 0) between 0 and 100
    );

-- ---------------------------------------------------------------------------
-- 4. Entrar por código de convite
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER de propósito: um desafio privado é invisível para quem ainda
-- não é membro, então o cliente não consegue procurar o código por conta própria.
-- A função valida o código, confere lotação e período, e grava a inscrição — sem
-- nunca devolver o invite_code nem qualquer outro dado de desafio alheio.
create or replace function public.join_challenge_by_code(p_code text)
returns table (status text, challenge_id uuid, title text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_challenge public.challenges%rowtype;
    v_count int;
    v_user uuid := auth.uid();
    v_code text := upper(trim(coalesce(p_code, '')));
begin
    if v_user is null then
        return query select 'unauthenticated'::text, null::uuid, null::text;
        return;
    end if;

    if v_code = '' then
        return query select 'not_found'::text, null::uuid, null::text;
        return;
    end if;

    -- invite_code primeiro: ele tem índice único case-insensitive. `share_code`
    -- é único só de forma sensível a caixa, então dois códigos que diferem no
    -- caixa poderiam casar juntos e o `limit 1` escolheria um desafio arbitrário.
    select * into v_challenge
    from public.challenges c
    where upper(c.invite_code) = v_code
    limit 1;

    if not found then
        select * into v_challenge
        from public.challenges c
        where upper(c.share_code) = v_code
        order by c.created_at
        limit 1;
    end if;

    if not found then
        return query select 'not_found'::text, null::uuid, null::text;
        return;
    end if;

    if public.is_challenge_member(v_challenge.id, v_user) then
        return query select 'already_joined'::text, v_challenge.id, v_challenge.title;
        return;
    end if;

    if v_challenge.end_date is not null and v_challenge.end_date::date < current_date then
        return query select 'ended'::text, v_challenge.id, v_challenge.title;
        return;
    end if;

    -- Lotação conferida no servidor. A checagem que existia só no cliente usava
    -- contagem carregada na abertura da tela e deixava o grupo estourar o limite.
    if v_challenge.max_participants is not null then
        select count(*) into v_count
        from public.challenge_participants cp
        where cp.challenge_id = v_challenge.id;

        if v_count >= v_challenge.max_participants then
            return query select 'full'::text, v_challenge.id, v_challenge.title;
            return;
        end if;
    end if;

    insert into public.challenge_participants (challenge_id, user_id, current_streak, max_streak, total_points)
    values (v_challenge.id, v_user, 0, 0, 0)
    on conflict (challenge_id, user_id) do nothing;

    return query select 'joined'::text, v_challenge.id, v_challenge.title;
end;
$$;

revoke all on function public.join_challenge_by_code(text) from public, anon;
grant execute on function public.join_challenge_by_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Contagem de participantes sem baixar a tabela
-- ---------------------------------------------------------------------------

-- O app baixava TODAS as linhas de challenge_participants só para contar. Com
-- RLS ativa isso passaria a contar errado, além de crescer com a base inteira.
create or replace function public.challenge_participant_counts()
returns table (challenge_id uuid, participant_count int)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
    -- Só desafios que o chamador já poderia enxergar: público, criado por ele,
    -- ou em que participa. Devolver a contagem de todo desafio privado da base
    -- entregaria a existência e o tamanho de grupos alheios.
    select cp.challenge_id, count(*)::int
    from public.challenge_participants cp
    join public.challenges c on c.id = cp.challenge_id
    where c.visibility = 'public'
       or c.creator_id = auth.uid()
       or public.is_challenge_member(c.id, auth.uid())
    group by cp.challenge_id;
$$;

revoke all on function public.challenge_participant_counts() from public, anon;
grant execute on function public.challenge_participant_counts() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Ranking do desafio
-- ---------------------------------------------------------------------------

-- Devolve o progresso de cada participante. O peso absoluto NUNCA sai daqui:
-- só o percentual do caminho andado e a variação em kg desde o início.
create or replace function public.challenge_leaderboard(p_challenge_id uuid)
returns table (
    user_id             uuid,
    name                text,
    avatar_url          text,
    weight_progress     numeric,
    weight_delta        numeric,
    has_weight_goal     boolean,
    habits_completed    int,
    habits_total        int,
    workouts_completed  int,
    diet_days_completed int,
    current_streak      int,
    check_ins_count     int,
    completed_today     boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_user uuid := auth.uid();
    v_start date;
    v_end   date;
begin
    -- Ranking é dado de dentro do grupo: só membros e o criador veem. Desafio
    -- público na vitrine não dá a estranho o direito de ler hábitos, treinos e
    -- variação de peso de quem participa.
    if v_user is null then
        return;
    end if;

    if not exists (
        select 1 from public.challenges c
        where c.id = p_challenge_id
          and (c.creator_id = v_user or public.is_challenge_member(c.id, v_user))
    ) then
        return;
    end if;

    select coalesce(c.start_date::date, c.created_at::date),
           coalesce(c.end_date::date, current_date)
      into v_start, v_end
      from public.challenges c
     where c.id = p_challenge_id;

    return query
    select
        cp.user_id,
        coalesce(pr.name, 'Atleta')::text,
        pr.avatar_url::text,
        -- Percentual do caminho: 0 quando ainda não andou nada, 1 quando bateu
        -- ou passou da meta. Divisão protegida contra meta igual ao peso inicial.
        case
            when g.start_weight is null or g.target_weight is null then null
            when abs(g.target_weight - g.start_weight) < 0.01 then 1::numeric
            else greatest(0::numeric, least(1::numeric,
                (coalesce(g.current_weight, g.start_weight) - g.start_weight)
                / (g.target_weight - g.start_weight)))
        end,
        case
            when g.start_weight is null then null
            else round(coalesce(g.current_weight, g.start_weight) - g.start_weight, 2)
        end,
        (g.start_weight is not null and g.target_weight is not null),
        coalesce(habits.done_today, 0),
        coalesce(habits.total, 0),
        coalesce(w.cnt, 0),
        coalesce(d.cnt, 0),
        coalesce(cp.current_streak, 0),
        coalesce(cl.cnt, 0),
        -- "Fechou o dia": todos os hábitos do dia concluídos E pelo menos uma
        -- das outras frentes (treino ou dieta). Exigir as três tornava o selo
        -- praticamente inalcançável em desafio de meta de peso, onde nem todo
        -- dia tem treino previsto.
        -- Quem não criou hábito nenhum (comum em desafio de meta de peso, onde
        -- cada um mantém o próprio plano) fecha o dia por treino ou dieta.
        ((coalesce(habits.total, 0) = 0
          or coalesce(habits.done_today, 0) >= coalesce(habits.total, 0))
         and (coalesce(w.today, false) or coalesce(d.today, false)))
    from public.challenge_participants cp
    left join public.profiles pr on pr.id = cp.user_id
    left join public.challenge_weight_goals g
           on g.challenge_id = cp.challenge_id and g.user_id = cp.user_id
    -- `habits` não tem coluna de arquivamento: todo hábito da pessoa é ativo.
    left join lateral (
        select
            count(*)::int as total,
            count(*) filter (
                where exists (
                    select 1 from public.daily_habit_logs l
                    where l.habit_id = h.id
                      and l.user_id = cp.user_id
                      and l.date = current_date
                      and l.done
                )
            )::int as done_today
        from public.habits h
        where h.user_id = cp.user_id
    ) habits on true
    left join lateral (
        select count(*)::int as cnt,
               bool_or(wl.date = current_date) as today
        from public.workout_logs wl
        where wl.user_id = cp.user_id and wl.date between v_start and v_end
    ) w on true
    left join lateral (
        select count(distinct dl.date)::int as cnt,
               bool_or(dl.date = current_date) as today
        from public.diet_logs dl
        where dl.user_id = cp.user_id
          and dl.date between v_start and v_end
          and dl.consumed
    ) d on true
    left join lateral (
        select count(*)::int as cnt
        from public.challenge_daily_logs c2
        where c2.challenge_id = p_challenge_id
          and c2.user_id = cp.user_id
          and c2.status = 'valid'
          and c2.created_at::date between v_start and v_end
    ) cl on true
    where cp.challenge_id = p_challenge_id;
end;
$$;

revoke all on function public.challenge_leaderboard(uuid) from public, anon;
grant execute on function public.challenge_leaderboard(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Gravar a própria meta de peso
-- ---------------------------------------------------------------------------

create or replace function public.set_challenge_weight_goal(
    p_challenge_id uuid,
    p_start_weight numeric,
    p_target_weight numeric
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_user uuid := auth.uid();
begin
    if v_user is null or not public.is_challenge_member(p_challenge_id, v_user) then
        return false;
    end if;
    if p_start_weight is null or p_target_weight is null
       or p_start_weight < 30 or p_start_weight > 350
       or p_target_weight < 30 or p_target_weight > 350 then
        return false;
    end if;

    insert into public.challenge_weight_goals
        (challenge_id, user_id, start_weight, target_weight, current_weight, updated_at)
    values (p_challenge_id, v_user, p_start_weight, p_target_weight, p_start_weight, now())
    on conflict (challenge_id, user_id) do update
        set start_weight = excluded.start_weight,
            target_weight = excluded.target_weight,
            -- Mudar o peso inicial troca o denominador do percentual. Manter o
            -- current_weight antigo faria o progresso saltar para 100% ou zerar
            -- sem ninguém pedir; então o ponto de partida rebaseia junto.
            current_weight = case
                when public.challenge_weight_goals.start_weight is distinct from excluded.start_weight
                    then excluded.start_weight
                else coalesce(public.challenge_weight_goals.current_weight, excluded.current_weight)
            end,
            updated_at = now();
    return true;
end;
$$;

create or replace function public.log_challenge_weight(
    p_challenge_id uuid,
    p_weight numeric
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_user uuid := auth.uid();
begin
    if v_user is null or not public.is_challenge_member(p_challenge_id, v_user) then
        return false;
    end if;
    if p_weight is null or p_weight < 30 or p_weight > 350 then
        return false;
    end if;

    update public.challenge_weight_goals
       set current_weight = p_weight, updated_at = now()
     where challenge_id = p_challenge_id and user_id = v_user;

    return found;
end;
$$;

revoke all on function public.set_challenge_weight_goal(uuid, numeric, numeric) from public, anon;
revoke all on function public.log_challenge_weight(uuid, numeric) from public, anon;
grant execute on function public.set_challenge_weight_goal(uuid, numeric, numeric) to authenticated;
grant execute on function public.log_challenge_weight(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Correção de policies legadas
-- ---------------------------------------------------------------------------

-- A policy do schema base autoriza a leitura de desafio privado via
-- `challenge_enrollments`, tabela paralela que o app não usa: quem entra por
-- convite grava em `challenge_participants` e, por isso, não conseguia nem ler
-- a linha do desafio em que acabou de entrar.
drop policy if exists "Challenges are readable by authenticated users" on public.challenges;
create policy "Challenges are readable by authenticated users"
    on public.challenges for select
    to authenticated
    using (
        visibility = 'public'
        or creator_id = (select auth.uid())
        or public.is_challenge_member(id, (select auth.uid()))
        -- A cláusula que consultava `challenge_enrollments` saiu: essa tabela
        -- não existe neste banco (confirmado em 27/07/2026) e a policy inteira
        -- abortava com "relation does not exist". Remover não fecha acesso de
        -- ninguém — uma tabela inexistente nunca casaria — e o caminho real de
        -- pertencimento (`challenge_participants`) já está coberto acima por
        -- is_challenge_member.
    );

-- `profiles` é legível por qualquer autenticado quando public_profile = true, e
-- carrega weight/desired_weight/height. Sem fechar isso, o peso absoluto que a
-- regra de privacidade tira do ranking continuaria acessível por
-- /rest/v1/profiles?select=id,weight — a proteção do ranking seria decorativa.
--
-- RLS é por linha e não sabe esconder coluna, então a trava certa é privilégio
-- de coluna. A lista de colunas liberadas é montada a partir do catálogo, e não
-- escrita à mão: citar uma coluna inexistente abortaria a transação inteira e
-- nenhuma das mudanças acima entraria.
--
-- Quem continua tendo acesso aos dados de saúde:
--   • o próprio usuário, por my_health_profile();
--   • o painel admin, por admin_profile_detail()/admin_profile_search(), que
--     validam role = 'admin' antes de devolver qualquer coisa.
do $$
declare
    v_cols text;
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'profiles' and column_name = 'weight'
    ) then
        select string_agg(quote_ident(column_name), ', ')
          into v_cols
          from information_schema.columns
         where table_schema = 'public'
           and table_name = 'profiles'
           and column_name not in (
               'email', 'birth_year', 'gender', 'goal', 'height', 'weight',
               'desired_weight', 'workout_place', 'session_time',
               'cardio_preference', 'workout_focus', 'daily_routine',
               'meals_count', 'supplements', 'training_frequency',
               'biggest_obstacle', 'discovery_source', 'aspiration'
           );

        execute 'revoke select on public.profiles from authenticated';
        execute format('grant select (%s) on public.profiles to authenticated', v_cols);
    end if;
end $$;

-- Dados de saúde do próprio usuário, sem abrir a coluna para a base inteira.
-- DROP antes do CREATE para a cadeia ser REAPLICÁVEL: a migration
-- 20260724160000 muda o RETORNO desta função (entra birth_year), e o Postgres
-- recusa `create or replace` quando o tipo de retorno difere do que está no
-- banco. Sem o drop, rodar a cadeia de novo num banco já migrado aborta aqui.
drop function if exists public.my_health_profile();
create or replace function public.my_health_profile()
returns table (
    gender        text,
    goal          text,
    height        numeric,
    weight        numeric,
    daily_routine text
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
    select p.gender, p.goal, p.height, p.weight, p.daily_routine
    from public.profiles p
    where p.id = auth.uid();
$$;

revoke all on function public.my_health_profile() from public, anon;
grant execute on function public.my_health_profile() to authenticated;

-- O painel admin (FlameerTS) autentica com a chave anon, então o admin logado
-- também é o papel `authenticated` e perderia acesso às colunas de saúde junto
-- com todo mundo. Estas funções devolvem o perfil completo APÓS conferir o role.
create or replace function public.admin_profile_detail(p_user_id uuid)
returns setof public.profiles
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
    if not exists (
        select 1 from public.profiles
        where id = auth.uid() and role in ('admin', 'professional')
    ) then
        raise exception 'not authorized' using errcode = '42501';
    end if;

    return query select * from public.profiles where id = p_user_id;
end;
$$;

create or replace function public.admin_profile_search(p_query text, p_limit int default 8)
returns setof public.profiles
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
    if not exists (
        select 1 from public.profiles
        where id = auth.uid() and role in ('admin', 'professional')
    ) then
        raise exception 'not authorized' using errcode = '42501';
    end if;

    return query
    select * from public.profiles
    where name ilike '%' || coalesce(p_query, '') || '%'
    limit least(coalesce(p_limit, 8), 50);
end;
$$;

revoke all on function public.admin_profile_detail(uuid) from public, anon;
revoke all on function public.admin_profile_search(text, int) from public, anon;
grant execute on function public.admin_profile_detail(uuid) to authenticated;
grant execute on function public.admin_profile_search(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Metadado público de desafio
-- ---------------------------------------------------------------------------

-- A policy restritiva da seção 8 reverte, DE PROPÓSITO, a migration
-- 20260717130000_challenges_public_metadata.sql, que abrira o SELECT de
-- `challenges` com `using (true)`. Aquela abertura também entregava o
-- `invite_code` de todo desafio privado — o convite deixava de ser convite.
--
-- O objetivo dela (mostrar no perfil social que a pessoa participa de um
-- desafio) é preservado aqui por uma função que devolve só o metadado de
-- exibição, nunca o código nem o período.
create or replace function public.challenge_public_metadata(p_challenge_ids uuid[])
returns table (
    id                uuid,
    title             text,
    icon_name         text,
    theme_colors      text[],
    cover_image_url   text,
    visibility        text,
    participant_count int
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
    select c.id, c.title, c.icon_name, c.theme_colors, c.cover_image_url, c.visibility,
           (select count(*)::int from public.challenge_participants p where p.challenge_id = c.id)
    from public.challenges c
    where c.id = any(p_challenge_ids)
      and (
          c.visibility = 'public'
          or c.creator_id = auth.uid()
          or public.is_challenge_member(c.id, auth.uid())
      );
$$;

revoke all on function public.challenge_public_metadata(uuid[]) from public, anon;
grant execute on function public.challenge_public_metadata(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Criação de desafio numa transação só
-- ---------------------------------------------------------------------------

-- O app inseria em `challenges` e depois em `challenge_participants` em duas
-- chamadas. Falhando a segunda, sobrava um desafio gravado sem o criador
-- dentro: ele via "falha ao gravar" e, ao tentar de novo, criava um segundo
-- desafio órfão com outro código. Aqui as duas escritas são atômicas.
create or replace function public.create_challenge_with_creator(
    p_title            text,
    p_subtitle         text,
    p_visibility       text,
    p_challenge_type   text,
    p_goal_type        text,
    p_category         text,
    p_duration_days    int,
    p_prize            text,
    p_icon_name        text,
    p_theme_colors     text[],
    p_cover_image_url  text,
    p_max_participants int,
    p_start_date       timestamptz,
    p_end_date         timestamptz
)
returns table (id uuid, invite_code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_user uuid := auth.uid();
    v_id   uuid := gen_random_uuid();
    v_code text;
    v_try  int := 0;
begin
    if v_user is null then
        raise exception 'not authenticated' using errcode = '42501';
    end if;
    if coalesce(trim(p_title), '') = '' then
        raise exception 'title required' using errcode = '22023';
    end if;
    -- SECURITY DEFINER roda com privilégio elevado: o que entra tem que ser
    -- validado aqui, não confiado ao cliente.
    if p_visibility not in ('public', 'private') then
        raise exception 'invalid visibility' using errcode = '22023';
    end if;
    if p_challenge_type not in ('individual', 'group_private', 'group_public') then
        raise exception 'invalid challenge type' using errcode = '22023';
    end if;
    if p_max_participants is not null and p_max_participants not between 1 and 500 then
        raise exception 'invalid participant limit' using errcode = '22023';
    end if;

    -- Código gerado no servidor com retry: gerado no cliente, uma colisão
    -- mandaria convidados para o desafio errado.
    loop
        v_try := v_try + 1;
        v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
        exit when not exists (
            select 1 from public.challenges
            where upper(invite_code) = v_code or upper(share_code) = v_code
        );
        if v_try > 10 then
            raise exception 'could not generate invite code' using errcode = '55000';
        end if;
    end loop;

    insert into public.challenges (
        id, title, subtitle, tier, visibility, challenge_type, goal_type,
        category, duration_days, prize, icon_name, theme_colors,
        cover_image_url, creator_id, share_code, invite_code,
        max_participants, is_featured, start_date, end_date
    ) values (
        v_id, trim(p_title), nullif(trim(coalesce(p_subtitle, '')), ''), 'free_user',
        p_visibility, p_challenge_type, coalesce(p_goal_type, 'activity'),
        p_category, greatest(1, coalesce(p_duration_days, 30)),
        nullif(trim(coalesce(p_prize, '')), ''), coalesce(p_icon_name, 'trophy'),
        coalesce(p_theme_colors, array['#FF6B00', '#FF3B30']),
        p_cover_image_url, v_user, v_code, v_code,
        p_max_participants, false, p_start_date, p_end_date
    );

    insert into public.challenge_participants (challenge_id, user_id, current_streak, max_streak, total_points)
    values (v_id, v_user, 0, 0, 0)
    on conflict (challenge_id, user_id) do nothing;

    return query select v_id, v_code;
end;
$$;

revoke all on function public.create_challenge_with_creator(
    text, text, text, text, text, text, int, text, text, text[], text, int, timestamptz, timestamptz
) from public, anon;
grant execute on function public.create_challenge_with_creator(
    text, text, text, text, text, text, int, text, text, text[], text, int, timestamptz, timestamptz
) to authenticated;

commit;
