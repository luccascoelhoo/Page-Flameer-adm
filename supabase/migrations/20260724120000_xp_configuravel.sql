-- 20260724120000_xp_configuravel.sql
--
-- XP configurável pelo painel.
--
-- Contexto: o XP JÁ funciona. O trigger evaluate_daily_score calcula o XP do dia
-- e atualiza profiles.xp/level, daily_scores e weekly_leaderboard — só que com os
-- valores cravados no SQL (10 por hábito, 30 treino, 20 dieta, +50 dia perfeito,
-- nível a cada 1000). Em paralelo, o app chama uma RPC `grant_xp` que NUNCA
-- existiu: as chamadas falhavam em silêncio. Quatro delas pediam XP por hábito,
-- treino e refeição — ou seja, se a função existisse somando em profiles.xp,
-- cada hábito passaria a valer 20.
--
-- Esta migration:
--   1. Cria xp_rules (valores editáveis pelo painel) e xp_events (livro-razão).
--   2. Faz evaluate_daily_score LER xp_rules em vez das constantes — com os
--      mesmos valores de hoje, para o comportamento no dia 1 ser idêntico.
--   3. Cria grant_xp(p_code, p_source_id) para os eventos EPISÓDICOS, sem
--      parâmetro de valor (o cliente não escolhe quanto vale) e idempotente.
--   4. Marca como já consumidos os marcos de ofensiva que os usuários já
--      passaram — decisão do dono: ofensiva vale daqui pra frente.
--
-- Idempotente. Aplicar com o SQL Editor do Supabase, em staging primeiro.

begin;

-- ---------------------------------------------------------------------------
-- 1. Tabela de regras — é isto que o painel edita
-- ---------------------------------------------------------------------------
create table if not exists public.xp_rules (
    code        text primary key,
    label       text not null,
    -- 'diario'    = estado do dia, recalculado pelo trigger (marcar/desmarcar
    --               devolve o XP). NÃO passa por grant_xp.
    -- 'episodico' = fato que aconteceu uma vez e não se desfaz. Só por grant_xp.
    -- 'config'    = não é evento; é parâmetro (curva de nível, teto).
    motor       text not null check (motor in ('diario', 'episodico', 'config')),
    points      int  not null default 0 check (points between 0 and 100000),
    -- Máximo de concessões por dia para regras episódicas. null = sem teto.
    daily_cap   int check (daily_cap is null or daily_cap > 0),
    enabled     boolean not null default true,
    updated_by  uuid references public.profiles(id) on delete set null,
    updated_at  timestamptz not null default now()
);

comment on table public.xp_rules is
    'Valores de XP por evento, editáveis pelo painel admin. Trocar um valor aqui '
    'não exige release do app nem migration.';

-- Valores de HOJE, para ligar a configuração sem mudar comportamento.
insert into public.xp_rules (code, label, motor, points, daily_cap) values
    ('HABIT_DONE',      'Hábito concluído (cada um)',     'diario',    10, null),
    ('WORKOUT_DONE',    'Treino do dia registrado',       'diario',    30, null),
    ('DIET_COMPLETE',   'Dieta do dia completa',          'diario',    20, null),
    ('PERFECT_DAY',     'Dia perfeito (tudo concluído)',  'diario',    50, null),
    ('DAILY_CHECKIN',   'Check-in diário',                'episodico', 15, 1),
    ('STREAK_7',        'Ofensiva: Bronze (7 dias)',      'episodico', 50, 1),
    ('STREAK_21',       'Ofensiva: Prata (21 dias)',      'episodico', 150, 1),
    ('STREAK_63',       'Ofensiva: Ouro (63 dias)',       'episodico', 500, 1),
    ('STREAK_365',      'Ofensiva: Diamante (365 dias)',  'episodico', 2000, 1),
    ('CHALLENGE_DONE',  'Desafio concluído',              'episodico', 200, null),
    ('REFERRAL_OK',     'Indicação validada',             'episodico', 100, 5),
    ('ONBOARDING_DONE', 'Onboarding concluído',           'episodico', 50, 1),
    -- Parâmetros. LEVEL_STEP: XP por nível (era xp/1000+1 cravado no SQL).
    -- DAILY_XP_CAP: teto do motor diário, que é o ilimitado por natureza —
    -- quem cria 50 hábitos somaria 500 XP/dia só de hábito.
    ('LEVEL_STEP',      'XP necessário por nível',        'config',    1000, null),
    ('DAILY_XP_CAP',    'Teto de XP diário (motor diário)','config',   500, null)
on conflict (code) do nothing;

alter table public.xp_rules enable row level security;

drop policy if exists "xp_rules legíveis por autenticado" on public.xp_rules;
create policy "xp_rules legíveis por autenticado"
    on public.xp_rules for select to authenticated using (true);

-- Escrita só do admin de plataforma. is_platform_admin() exclui 'professional',
-- que não pode mexer na economia do app.
drop policy if exists "xp_rules escritas só por admin" on public.xp_rules;
create policy "xp_rules escritas só por admin"
    on public.xp_rules for all to authenticated
    using (public.is_platform_admin())
    with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 2. Livro-razão — auditoria e, ao mesmo tempo, a trava de idempotência
-- ---------------------------------------------------------------------------
create table if not exists public.xp_events (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references public.profiles(id) on delete cascade,
    code       text not null references public.xp_rules(code),
    -- Valor VIGENTE no momento da concessão: mudar a regra depois não reescreve
    -- o histórico de quem já ganhou.
    points     int  not null,
    -- Identidade do fato: a data do check-in, o id do desafio, os dias da
    -- ofensiva. É o que impede creditar o mesmo fato duas vezes.
    source_id  text,
    day        date not null default current_date,
    created_at timestamptz not null default now()
);

comment on table public.xp_events is
    'Uma linha por concessão de XP episódica. Serve de auditoria (o admin '
    'consegue responder "por que ganhei só 40 XP ontem") e de trava de '
    'idempotência via o índice único abaixo.';

-- A trava. coalesce porque source_id nulo é um fato único por si só.
create unique index if not exists xp_events_idem
    on public.xp_events (user_id, code, coalesce(source_id, ''));

create index if not exists xp_events_user_day_idx
    on public.xp_events (user_id, day desc);

alter table public.xp_events enable row level security;

-- Cada um lê o próprio extrato; o admin lê todos.
drop policy if exists "xp_events próprio ou admin" on public.xp_events;
create policy "xp_events próprio ou admin"
    on public.xp_events for select to authenticated
    using (user_id = auth.uid() or public.is_platform_admin());

-- NINGUÉM escreve direto: só a RPC (security definer). Sem esta ausência de
-- policy de insert, o cliente inseria a própria linha e se daria o XP que
-- quisesse.

-- ---------------------------------------------------------------------------
-- 3. Ofensiva vale daqui pra frente
-- ---------------------------------------------------------------------------
-- Decisão do dono: quem já está com 100 dias de chama não recebe retroativo por
-- Bronze/Prata/Ouro. Em vez de tratar isso no app, marco os marcos já passados
-- como consumidos, com points = 0 — o índice único então bloqueia a concessão
-- futura, e fica auditável POR QUE não foi creditado.
insert into public.xp_events (user_id, code, points, source_id, day)
select p.id,
       r.code,
       0,
       r.dias::text,
       current_date
from public.profiles p
cross join (values (7,'STREAK_7'), (21,'STREAK_21'), (63,'STREAK_63'), (365,'STREAK_365'))
        as r(dias, code)
where p.streak >= r.dias
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 4. grant_xp — só para eventos EPISÓDICOS
-- ---------------------------------------------------------------------------
-- Diferenças para a assinatura que o app chamava:
--   * NÃO recebe `amount`. O cliente mandava o valor, ou seja, um aparelho
--     comprometido pedia 999999. Agora quem decide quanto vale é o servidor.
--   * NÃO recebe user_id. Usa auth.uid(), então ninguém credita XP para outro.
--   * Recusa códigos do motor diário: aqueles são do trigger, e creditar aqui
--     seria contar duas vezes.
-- Retorna quantos pontos foram creditados (0 = repetido, desligado ou no teto).
create or replace function public.grant_xp(p_code text, p_source_id text default null)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid    uuid := auth.uid();
    v_rule   public.xp_rules%rowtype;
    v_hoje   int;
    v_step   int;
begin
    if v_uid is null then
        return 0;
    end if;

    select * into v_rule from public.xp_rules where code = p_code;
    if not found or not v_rule.enabled then
        return 0;
    end if;

    -- O motor diário é território do trigger. Creditar aqui duplicaria.
    if v_rule.motor <> 'episodico' then
        raise exception 'grant_xp: % é do motor % e não pode ser creditado avulso',
            p_code, v_rule.motor;
    end if;

    -- Teto de ocorrências no dia para esta regra.
    if v_rule.daily_cap is not null then
        -- Advisory lock por (usuário, regra): sem ele, duas chamadas
        -- concorrentes com source_ids DIFERENTES liam o mesmo count e ambas
        -- inseriam, furando o teto — o índice único só barra o MESMO fato.
        -- xact_lock: solta sozinho no fim da transação.
        perform pg_advisory_xact_lock(hashtext(v_uid::text || ':' || p_code));
        select count(*) into v_hoje
        from public.xp_events
        where user_id = v_uid and code = p_code and day = current_date;
        if v_hoje >= v_rule.daily_cap then
            return 0;
        end if;
    end if;

    -- A trava real é o índice único: numa corrida entre dois aparelhos, o
    -- segundo insert não entra e o `if not found` devolve 0 sem creditar.
    insert into public.xp_events (user_id, code, points, source_id)
    values (v_uid, p_code, v_rule.points, p_source_id)
    on conflict do nothing;

    if not found then
        return 0;
    end if;

    select points into v_step from public.xp_rules where code = 'LEVEL_STEP';
    v_step := greatest(1, coalesce(v_step, 1000));

    update public.profiles
       set xp    = greatest(0, xp + v_rule.points),
           level = greatest(1, greatest(0, xp + v_rule.points) / v_step + 1)
     where id = v_uid;

    return v_rule.points;
end;
$$;

revoke all on function public.grant_xp(text, text) from public, anon;
grant execute on function public.grant_xp(text, text) to authenticated;

-- A assinatura antiga (com amount e user_id) some: era ela que deixava o
-- cliente escolher o próprio XP. Se existir no banco, cai aqui.
drop function if exists public.grant_xp(uuid, int, text, text);

-- ---------------------------------------------------------------------------
-- 5. evaluate_daily_score passa a ler as regras
-- ---------------------------------------------------------------------------
-- Mesma lógica de antes (recalcula o dia e aplica o DELTA, então desmarcar
-- devolve o XP), só que os números vêm de xp_rules. Com os valores semeados
-- acima, o resultado no dia 1 é idêntico ao de hoje.
create or replace function public.evaluate_daily_score()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
DECLARE
    v_user_id UUID;
    v_date DATE;
    v_total_habits INT;
    v_done_habits INT;
    v_workout_done BOOLEAN;
    v_diet_done BOOLEAN;
    v_daily_xp INT;
    v_old_daily_xp INT;
    v_xp_delta INT;
    -- Regras (lidas uma vez por disparo)
    v_p_habit INT;
    v_p_workout INT;
    v_p_diet INT;
    v_p_perfect INT;
    v_cap INT;
    v_step INT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_user_id := OLD.user_id;
        v_date    := OLD.date;
    ELSE
        v_user_id := NEW.user_id;
        v_date    := NEW.date;
    END IF;

    IF v_user_id IS NULL OR v_date IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(MAX(CASE WHEN code = 'HABIT_DONE'    AND enabled THEN points END), 0),
           COALESCE(MAX(CASE WHEN code = 'WORKOUT_DONE'  AND enabled THEN points END), 0),
           COALESCE(MAX(CASE WHEN code = 'DIET_COMPLETE' AND enabled THEN points END), 0),
           COALESCE(MAX(CASE WHEN code = 'PERFECT_DAY'   AND enabled THEN points END), 0),
           COALESCE(MAX(CASE WHEN code = 'DAILY_XP_CAP'  AND enabled THEN points END), 2147483647),
           GREATEST(1, COALESCE(MAX(CASE WHEN code = 'LEVEL_STEP' THEN points END), 1000))
      INTO v_p_habit, v_p_workout, v_p_diet, v_p_perfect, v_cap, v_step
      FROM public.xp_rules;

    -- Comparação DATE com DATE. O `= v_date::TEXT` que estava aqui abortava a
    -- transação inteira ('operator does not exist: date = text').
    SELECT COUNT(*), COUNT(*) FILTER (WHERE done = true)
      INTO v_total_habits, v_done_habits
      FROM public.daily_habit_logs
     WHERE user_id = v_user_id AND date = v_date;

    SELECT EXISTS(
        SELECT 1 FROM public.workout_logs
         WHERE user_id = v_user_id AND date = v_date
    ) INTO v_workout_done;

    SELECT NOT EXISTS (
        SELECT 1 FROM public.diet_logs
         WHERE user_id = v_user_id AND date = v_date AND consumed = false
    ) AND EXISTS (
        SELECT 1 FROM public.diet_logs
         WHERE user_id = v_user_id AND date = v_date
    ) INTO v_diet_done;

    v_daily_xp := (v_done_habits * v_p_habit)
                + (CASE WHEN v_workout_done THEN v_p_workout ELSE 0 END)
                + (CASE WHEN v_diet_done    THEN v_p_diet    ELSE 0 END);

    IF v_total_habits > 0 AND v_done_habits = v_total_habits AND v_workout_done AND v_diet_done THEN
        v_daily_xp := v_daily_xp + v_p_perfect;
    END IF;

    -- Teto: sem ele, criar 50 hábitos vira 500 XP/dia só de hábito.
    v_daily_xp := LEAST(v_daily_xp, v_cap);

    SELECT COALESCE(xp_gained, 0) INTO v_old_daily_xp
      FROM public.daily_scores
     WHERE user_id = v_user_id AND date = v_date;

    v_xp_delta := v_daily_xp - COALESCE(v_old_daily_xp, 0);

    IF v_xp_delta <> 0 THEN
        UPDATE public.profiles
           SET xp    = GREATEST(0, xp + v_xp_delta),
               level = GREATEST(1, GREATEST(0, xp + v_xp_delta) / v_step + 1)
         WHERE id = v_user_id;
    END IF;

    INSERT INTO public.daily_scores (user_id, date, xp_gained)
    VALUES (v_user_id, v_date, v_daily_xp)
    ON CONFLICT (user_id, date)
    DO UPDATE SET xp_gained = EXCLUDED.xp_gained;

    INSERT INTO public.weekly_leaderboard (year, week_number, user_id, xp_gained)
    VALUES (
        EXTRACT(isoyear FROM v_date)::INT,
        EXTRACT(week    FROM v_date)::INT,
        v_user_id,
        v_daily_xp
    )
    ON CONFLICT (year, week_number, user_id)
    DO UPDATE SET
        xp_gained       = GREATEST(0, public.weekly_leaderboard.xp_gained + v_xp_delta),
        last_updated_at = now();

    RETURN NULL;
END;
$$;

commit;
