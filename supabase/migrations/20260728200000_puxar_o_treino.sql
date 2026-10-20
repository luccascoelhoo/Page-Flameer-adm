-- 20260728200000_puxar_o_treino.sql
--
-- PUXAR O TREINO: montar um treino, compartilhar por código e o grupo inteiro
-- treinar da MESMA sessão, com o resumo de todos no fim.
--
-- Desenho escolhido entre três propostas, julgadas por viabilidade técnica,
-- experiência real na academia e estratégia de produto.
--
-- DECISÕES QUE SUSTENTAM ESTE SCHEMA (não desfazer sem entender):
--
--  * A SESSÃO NUNCA EXPIRA; o CÓDIGO expira. São coisas diferentes e por isso
--    têm colunas separadas. Apagar a sessão em 12h jogaria fora o único ativo
--    que a noite produz — o registro de que aquelas pessoas treinaram juntas.
--
--  * `code_retired_at` existe porque índice parcial no Postgres exige predicado
--    IMMUTABLE. `where code_expires_at > now()` NÃO COMPILA (now() é STABLE).
--    Predicado sobre coluna nula compila e faz o mesmo trabalho.
--
--  * PK COMPOSTA em members é a resposta inteira para "e se cinco amigos
--    entrarem ao mesmo tempo?". São cinco linhas distintas: não há contador
--    para incrementar nem linha para travar. A concorrência some por
--    construção.
--
--  * `is_shared_workout_member` é SECURITY DEFINER para evitar RECURSÃO de RLS:
--    uma policy em members que consulta members recursiona infinito e derruba
--    toda leitura da tabela. `is_challenge_member` existe por este mesmo
--    motivo. O `p_user = auth.uid()` impede sondar pertinência de terceiros.
--
--  * `shared_workout_summary` é SECURITY DEFINER por necessidade, não por
--    preferência: a policy de leitura de profiles é
--    `public_profile = true OR auth.uid() = id`, então um join comum faria o
--    amigo de perfil privado DESAPARECER da lista em silêncio.
--
--  * Os números do resumo saem de `shared_workout_members`, NÃO de
--    `workout_logs`. `workout_logs` tem UNIQUE (user_id, date) e é o agregado
--    do DIA — quem treinou de manhã apareceria com o volume somado no resumo
--    da noite, e a tela mentiria.
--
--  * Não há policy de INSERT em members nem de SELECT por código: a entrada
--    passa obrigatoriamente pela RPC, o que impede enumerar códigos alheios.
--
-- Idempotente.

;

begin;

-- ----------------------------------------------------------------------------
-- Gerador de código FALADO. Alfabeto de 24 caracteres sem par ambíguo:
-- fora 0/O, 1/I/L, 2/Z, 5/S, 8/B, 9. Alguém vai gritar esse código do outro
-- lado do banco supino, com música alta. 24^6 = 191 milhões de combinações.
-- ----------------------------------------------------------------------------
create or replace function public.gen_share_code(p_len int default 6)
returns text language plpgsql volatile
set search_path = public, pg_temp as $$
declare
    v_alpha text := '3467ACDEFGHJKMNPQRTUVWXY';
    v_out   text := '';
    i int;
begin
    for i in 1..p_len loop
        v_out := v_out || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    end loop;
    return v_out;
end; $$;

-- ----------------------------------------------------------------------------
-- A SESSÃO. A linha NUNCA é apagada nem expira — o único ativo que a noite
-- produz é o fato de que essas pessoas treinaram juntas, e apagar isso em 12h
-- é jogar fora a matéria-prima de "treinar de novo com os mesmos".
-- O que expira é o CÓDIGO, que é coisa diferente e tem duas colunas próprias.
-- ----------------------------------------------------------------------------
create table if not exists public.shared_workouts (
    id              uuid primary key default gen_random_uuid(),
    code            text not null,
    leader_id       uuid not null references public.profiles(id) on delete cascade,
    name            text not null,

    -- WorkoutGroup serializado pelo cliente. WorkoutGroup, WorkoutExercise e
    -- WorkoutSet JÁ são Codable (WorkoutView.swift:6-23): zero DTO novo, e o
    -- convidado recebe exatamente o que o líder montou, sem tradutor no meio.
    payload         jsonb not null,

    -- O payload vem do cliente e vai evoluir. Sem versão, um amigo com build
    -- antiga falha o decode e o app não sabe dizer por quê — que é o modo de
    -- falha silenciosa que a migration 20260727200000 acabou de consertar.
    payload_version int not null default 1,

    -- FASE 2: preenchido pela materialização. Nulo na Fase 1, e isso é ok.
    workout_id      uuid references public.workouts(id) on delete set null,

    -- FASE 3: árvore do loop. De qual sessão esta nasceu. Nulo = raiz.
    parent_shared_workout_id uuid references public.shared_workouts(id) on delete set null,

    created_at      timestamptz not null default now(),

    -- Janela de uso do código: 12h cobre "montei 18h, o atrasado chegou 21h".
    code_expires_at timestamptz not null default (now() + interval '12 hours'),

    -- Aposentadoria do código, que LIBERA a string para reuso. Separado de
    -- code_expires_at de propósito: índice parcial do Postgres exige predicado
    -- IMMUTABLE, e `where code_expires_at > now()` NÃO COMPILA (now() é STABLE).
    -- Predicado sobre coluna nula compila e faz o mesmo trabalho.
    code_retired_at timestamptz
);

-- Único CASE-INSENSITIVE e PARCIAL. Case-insensitive corrige o defeito que
-- challenges.share_code documenta ter (ver comentário em join_challenge_by_code,
-- schema.sql:2138). Parcial é o que permite código de 6 caracteres sem esgotar
-- o espaço com o tempo — só precisa ser único entre os códigos VIVOS.
create unique index if not exists shared_workouts_code_live
    on public.shared_workouts (upper(code))
    where code_retired_at is null;

create index if not exists shared_workouts_leader_idx
    on public.shared_workouts (leader_id, created_at desc);

-- ----------------------------------------------------------------------------
-- QUEM ENTROU.
-- PK COMPOSTA: é a resposta INTEIRA para "e se cinco amigos entrarem ao mesmo
-- tempo?". São cinco linhas distintas. Não há contador para incrementar nem
-- linha para travar. A concorrência some por construção, não por cuidado.
-- O mesmo amigo tocando duas vezes é idempotente.
-- ----------------------------------------------------------------------------
create table if not exists public.shared_workout_members (
    shared_workout_id uuid not null references public.shared_workouts(id) on delete cascade,
    user_id           uuid not null references public.profiles(id) on delete cascade,
    joined_at         timestamptz not null default now(),
    finished_at       timestamptz,

    -- Números DA SESSÃO, gravados pelo cliente ao encerrar. É isto que faz o
    -- resumo ser honesto: workout_logs é agregado do DIA (UNIQUE user_id+date)
    -- e mostraria o treino da manhã somado no resumo da noite.
    total_volume_kg   numeric,
    elapsed_seconds   int,
    sets_done         int,
    sets_total        int,

    -- FASE 2: vínculo com o registro real, quando a materialização existir.
    workout_log_id    uuid references public.workout_logs(id) on delete set null,

    -- FASE 3: separa amigo que já tinha o app de alcance novo.
    entry_via         text check (entry_via in ('code','link','in_app')),

    primary key (shared_workout_id, user_id)
);

-- ----------------------------------------------------------------------------
-- Helper SECURITY DEFINER contra RECURSÃO de RLS: uma policy em
-- shared_workout_members que consulta shared_workout_members recursiona
-- infinito no Postgres e derruba TODA leitura da tabela. A base já pagou esse
-- pedágio — is_challenge_member (schema.sql:2081) existe exatamente por isso,
-- e o `p_user_id = auth.uid()` dela é copiado aqui de propósito: impede usar o
-- helper para sondar a pertinência de terceiros.
-- NÃO "simplificar" para um exists inline durante a implementação.
-- ----------------------------------------------------------------------------
create or replace function public.is_shared_workout_member(p_sw uuid, p_user uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
    select p_user is not null
       and p_user = auth.uid()
       and exists (
           select 1 from public.shared_workout_members
           where shared_workout_id = p_sw and user_id = p_user
       );
$$;

alter table public.shared_workouts        enable row level security;
alter table public.shared_workout_members enable row level security;

drop policy if exists "lider gerencia a propria sessao" on public.shared_workouts;
create policy "lider gerencia a propria sessao"
    on public.shared_workouts for all to authenticated
    using ((select auth.uid()) = leader_id)
    with check ((select auth.uid()) = leader_id);

-- Sem esta policy o convidado recebe o payload UMA vez pela RPC e nunca mais:
-- fechar o app perderia o treino no meio da série.
drop policy if exists "membro le a sessao" on public.shared_workouts;
create policy "membro le a sessao"
    on public.shared_workouts for select to authenticated
    using (public.is_shared_workout_member(id, (select auth.uid())));

drop policy if exists "membro le a lista do grupo" on public.shared_workout_members;
create policy "membro le a lista do grupo"
    on public.shared_workout_members for select to authenticated
    using (public.is_shared_workout_member(shared_workout_id, (select auth.uid())));

drop policy if exists "membro atualiza a propria linha" on public.shared_workout_members;
create policy "membro atualiza a propria linha"
    on public.shared_workout_members for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

-- NÃO existe policy de SELECT por código e NÃO existe policy de INSERT em
-- members. É deliberado: obriga a entrada a passar pela RPC SECURITY DEFINER e
-- impede enumerar códigos alheios. Mesma lógica de join_challenge_by_code.

-- ----------------------------------------------------------------------------
-- RPC 1 — CRIAR
-- ----------------------------------------------------------------------------
create or replace function public.create_shared_workout(
    p_name text,
    p_payload jsonb,
    p_parent uuid default null
)
returns table (id uuid, code text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
    v_user uuid := auth.uid();
    v_code text; v_id uuid; v_try int := 0;
begin
    if v_user is null then
        raise exception 'unauthenticated' using errcode = '28000';
    end if;
    if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
        raise exception 'invalid payload' using errcode = '22023';
    end if;
    -- Teto: payload vem do cliente e vira linha permanente. Treino real dá
    -- 2-6 KB; 64 KB é folga larga e ainda barra abuso.
    if pg_column_size(p_payload) > 65536 then
        raise exception 'payload too large' using errcode = '22023';
    end if;

    -- Aposentadoria PREGUIÇOSA: libera o espaço de códigos vencidos sem cron
    -- e sem Edge Function. Barato porque o índice parcial já cobre a condição.
    update public.shared_workouts
       set code_retired_at = now()
     where code_retired_at is null
       and code_expires_at <= now();

    loop
        v_try := v_try + 1;
        v_code := public.gen_share_code(6);
        begin
            insert into public.shared_workouts
                (code, leader_id, name, payload, parent_shared_workout_id)
            values (v_code, v_user,
                    left(coalesce(nullif(trim(p_name), ''), 'Treino'), 60),
                    p_payload, p_parent)
            returning shared_workouts.id into v_id;
            exit;
        exception when unique_violation then
            if v_try >= 8 then
                raise exception 'could not generate code' using errcode = '55000';
            end if;
        end;
    end loop;

    -- Líder é membro da própria sessão: o resumo conta ele junto.
    insert into public.shared_workout_members
        (shared_workout_id, user_id, entry_via)
    values (v_id, v_user, 'in_app')
    on conflict do nothing;

    return query select v_id, v_code;
end; $$;

-- ----------------------------------------------------------------------------
-- RPC 2 — ENTRAR
-- Mesmo vocabulário de status de join_challenge_by_code (schema.sql:2113), para
-- o tratamento de erro no cliente ser cópia do que já existe.
-- ----------------------------------------------------------------------------
create or replace function public.join_shared_workout(
    p_code text,
    p_entry_via text default 'code'
)
returns table (status text, shared_workout_id uuid, workout_name text,
               leader_name text, payload jsonb, payload_version int,
               workout_id uuid)
language plpgsql security definer set search_path = public, pg_temp as $$
-- `returns table (... shared_workout_id uuid ...)` cria um parâmetro de SAÍDA
-- com o mesmo nome da coluna de shared_workout_members. No `on conflict
-- (shared_workout_id, user_id)` o Postgres não sabe a qual dos dois a gente se
-- refere e aborta com 42702 ("column reference is ambiguous") — a RPC inteira
-- falhava e ninguém conseguia entrar na sessão.
-- Esta diretiva resolve o empate em favor da COLUNA, que é o que o insert quer.
-- O `return query` abaixo entrega os valores por posição, então não é afetado.
#variable_conflict use_column
declare
    v_user uuid := auth.uid();
    v_sw   public.shared_workouts%rowtype;
    v_code text := upper(trim(coalesce(p_code, '')));
begin
    if v_user is null then
        return query select 'unauthenticated'::text, null::uuid, null::text,
                            null::text, null::jsonb, null::int, null::uuid;
        return;
    end if;

    if v_code = '' then
        return query select 'not_found'::text, null::uuid, null::text,
                            null::text, null::jsonb, null::int, null::uuid;
        return;
    end if;

    -- Só código VIVO. Um código aposentado pode ter sido reciclado por outra
    -- sessão; casar pelo aposentado levaria o convidado ao treino errado.
    select * into v_sw from public.shared_workouts sw
     where upper(sw.code) = v_code
       and sw.code_retired_at is null
     limit 1;

    if not found then
        return query select 'not_found'::text, null::uuid, null::text,
                            null::text, null::jsonb, null::int, null::uuid;
        return;
    end if;

    -- Já é membro: devolve o payload de novo em vez de erro. É o caminho de
    -- retomada — reabrir o app no meio da série tem que trazer o treino.
    if v_sw.code_expires_at <= now()
       and not public.is_shared_workout_member(v_sw.id, v_user) then
        return query select 'expired'::text, null::uuid, v_sw.name,
                            null::text, null::jsonb, null::int, null::uuid;
        return;
    end if;

    insert into public.shared_workout_members
        (shared_workout_id, user_id, entry_via)
    values (v_sw.id, v_user,
            case when p_entry_via in ('code','link','in_app')
                 then p_entry_via else 'code' end)
    on conflict (shared_workout_id, user_id) do nothing;

    return query select 'ok'::text, v_sw.id, v_sw.name,
                        (select p.name from public.profiles p where p.id = v_sw.leader_id),
                        v_sw.payload, v_sw.payload_version, v_sw.workout_id;
end; $$;

-- ----------------------------------------------------------------------------
-- RPC 3 — RESUMO (sala de espera E "Treinaram com você")
--
-- Precisa ser SECURITY DEFINER, e isto NÃO é preferência: a policy de leitura
-- de profiles é `public_profile = true OR auth.uid() = id` (schema.sql:5371).
-- Um select comum com join em profiles faria o amigo de perfil privado
-- DESAPARECER da lista em silêncio — interface que finge funcionar.
-- ----------------------------------------------------------------------------
create or replace function public.shared_workout_summary(p_shared_workout_id uuid)
returns table (user_id uuid, name text, avatar_url text, is_leader boolean,
               joined_at timestamptz, finished_at timestamptz,
               total_volume_kg numeric, elapsed_seconds int,
               sets_done int, sets_total int)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
    v_user uuid := auth.uid();
begin
    -- Só membro lê o grupo. Sem esta guarda, o SECURITY DEFINER viraria um
    -- vazamento: qualquer autenticado leria qualquer sessão pelo uuid.
    if not public.is_shared_workout_member(p_shared_workout_id, v_user) then
        return;
    end if;

    return query
    select m.user_id, p.name, p.avatar_url,
           (p.id = sw.leader_id) as is_leader,
           m.joined_at, m.finished_at,
           m.total_volume_kg, m.elapsed_seconds, m.sets_done, m.sets_total
      from public.shared_workout_members m
      join public.profiles p          on p.id = m.user_id
      join public.shared_workouts sw  on sw.id = m.shared_workout_id
     where m.shared_workout_id = p_shared_workout_id
     order by m.joined_at;
end; $$;

revoke all on function public.create_shared_workout(text, jsonb, uuid) from public, anon;
revoke all on function public.join_shared_workout(text, text)          from public, anon;
revoke all on function public.shared_workout_summary(uuid)             from public, anon;
revoke all on function public.gen_share_code(int)                      from public, anon;

grant execute on function public.create_shared_workout(text, jsonb, uuid) to authenticated;
grant execute on function public.join_shared_workout(text, text)          to authenticated;
grant execute on function public.shared_workout_summary(uuid)             to authenticated;

commit;
