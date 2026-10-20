-- 20260724180000_corrige_cadastro.sql
--
-- CORRIGE O CADASTRO e fecha a perda de dados do onboarding.
--
-- HISTÓRICO DESTE ARQUIVO (importante para quem for revisar):
-- A primeira versão desta migration continha um DEFEITO GRAVE que só não causou
-- dano porque o `create or replace function` não chegou a ser executado (o SQL
-- Editor abortou no dollar-quote anônimo e só os ALTER TABLE passaram).
-- O defeito: a função inseria `workout_focus` e `supplements` como JSONB em
-- colunas que no banco real são TEXT (guardam "chest, arms"), e `meals_count`
-- como TEXT numa coluna INT. Os três casts falhariam, o INSERT em profiles
-- inteiro cairia no `exception when others`, e o resultado seria PIOR que o bug
-- original: a conta nasceria SEM PERFIL NENHUM, silenciosamente.
-- A versão abaixo foi reescrita a partir dos tipos REAIS observados no banco de
-- produção (resposta do PostgREST para uma conta de teste criada em 27/07/2026),
-- não a partir do schema.sql — que está defasado.
--
-- Tipos confirmados por observação direta em public.profiles:
--   workout_focus      TEXT     (valor observado: "chest, arms")
--   supplements        TEXT     (valor observado: "whey, creatina")
--   meals_count        INT      (valor observado: 4, sem aspas)
--   session_time       TEXT     (valor observado: "60")
--   training_frequency TEXT     (valor observado: "3-5")
--   height/weight/desired_weight  NUMERIC
--
-- O QUE ESTA MIGRATION RESOLVE
--
-- 1. A coluna `referral_code` faltando. Duas migrations do mesmo dia entraram em
--    conflito: 20260708100500_remove_referrals dropou a coluna, e
--    20260708174500_add_referrals a recriou E fez o trigger inserir nela. O banco
--    terminou com o trigger mas sem a coluna, e como handle_new_user roda em
--    AFTER INSERT de auth.users, a falha derrubava a transação inteira —
--    "Database error saving new user" para TODO usuário novo.
--
-- 2. Perda de dados silenciosa: o app envia 4 campos que nenhuma versão do
--    trigger jamais gravou. Confirmado no teste de 27/07: birth_month,
--    birth_day, training_experience e training_level chegam no metadata e ficam
--    NULL em profiles. A pessoa responde no onboarding e a resposta morre.
--
-- 3. Robustez: hoje qualquer coluna problemática derruba o perfil inteiro. Aqui
--    o perfil nasce PRIMEIRO com o mínimo (id, name, email) e os campos ricos
--    entram por UPDATE num bloco protegido. Um defeito num campo passa a custar
--    aquele campo, não a conta.
--
-- PRESERVADO da versão vigente (não regredir):
--   * user_preferences criado no cadastro — sem isso o usuário novo nasce sem
--     preferências de privacidade do feed;
--   * user_health_profile com injuries/allergies;
--   * incremento de redemptions_count em referral_codes.
--
-- Dollar-quote NOMEADO de propósito: a função tem blocos
-- `begin ... exception ... end` ANINHADOS e o SQL Editor do dashboard não casa o
-- delimitador anônimo nesse caso ("unterminated dollar-quoted string"). Manter.
--
-- Idempotente.

begin;

-- ---------------------------------------------------------------------------
-- 1. A coluna que faltava (a causa do erro de cadastro)
-- ---------------------------------------------------------------------------
alter table public.profiles
    add column if not exists referral_code text;

-- ---------------------------------------------------------------------------
-- 2. Colunas do onboarding que o app coleta e o trigger descartava
-- ---------------------------------------------------------------------------
alter table public.profiles
    add column if not exists birth_month         int,
    add column if not exists birth_day           int,
    add column if not exists training_experience text,
    add column if not exists training_level      text;

-- ---------------------------------------------------------------------------
-- 3. handle_new_user reescrito
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $handle_new_user$
declare
    m               jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
    v_injuries      text[];
    v_allergies     text[];
    v_referral_code text;
begin
    -- Listas do onboarding. Só aceita array; qualquer outra coisa vira vazio.
    v_injuries := coalesce((
        select array_agg(elem) from jsonb_array_elements_text(
            case when jsonb_typeof(m->'injuries') = 'array'
                 then m->'injuries' else '[]'::jsonb end) as elem), '{}'::text[]);

    v_allergies := coalesce((
        select array_agg(elem) from jsonb_array_elements_text(
            case when jsonb_typeof(m->'allergies') = 'array'
                 then m->'allergies' else '[]'::jsonb end) as elem), '{}'::text[]);

    v_referral_code := nullif(upper(trim(coalesce(
        m->>'referral_code', m->>'referralCode', m->>'referral'))), '');

    -- -----------------------------------------------------------------------
    -- 3.1 O perfil nasce primeiro, com o mínimo indispensável.
    -- Este insert toca só colunas que existem desde o schema original, então é
    -- o mais próximo de infalível que dá para chegar. Fora do bloco protegido
    -- DE PROPÓSITO: se nem isto funciona, é melhor o cadastro falhar alto do
    -- que criar uma conta órfã que ninguém percebe.
    -- -----------------------------------------------------------------------
    insert into public.profiles (id, name, avatar_url, email)
    values (
        new.id,
        coalesce(nullif(trim(coalesce(m->>'name', '')), ''), 'Atleta'),
        m->>'avatar_url',
        new.email
    )
    on conflict (id) do nothing;

    -- -----------------------------------------------------------------------
    -- 3.2 Campos ricos do onboarding, em bloco protegido.
    -- Os casts numéricos são guardados por regex: metadata é entrada de
    -- cliente e um valor malformado não pode derrubar o cadastro.
    -- workout_focus e supplements viram TEXTO separado por vírgula porque é
    -- esse o tipo real da coluna (ver cabeçalho) e é assim que o app lê hoje.
    -- -----------------------------------------------------------------------
    begin
        update public.profiles set
            birth_year = case when m->>'birth_year' ~ '^[0-9]+$'
                              then (m->>'birth_year')::int end,
            birth_month = case when m->>'birth_month' ~ '^[0-9]+$'
                               then (m->>'birth_month')::int end,
            birth_day = case when m->>'birth_day' ~ '^[0-9]+$'
                             then (m->>'birth_day')::int end,
            cohort_group = coalesce(m->>'cohort_group', 'Não Definido'),
            gender = m->>'gender',
            goal = m->>'goal',
            height = case when m->>'height' ~ '^[0-9]+(\.[0-9]+)?$'
                          then (m->>'height')::numeric end,
            weight = case when m->>'weight' ~ '^[0-9]+(\.[0-9]+)?$'
                          then (m->>'weight')::numeric end,
            desired_weight = case when m->>'desired_weight' ~ '^[0-9]+(\.[0-9]+)?$'
                                  then (m->>'desired_weight')::numeric end,
            workout_place = m->>'workout_place',
            session_time = m->>'session_time',
            cardio_preference = m->>'cardio_preference',
            workout_focus = case
                when jsonb_typeof(m->'workout_focus') = 'array'
                then (select string_agg(elem, ', ')
                      from jsonb_array_elements_text(m->'workout_focus') as elem)
                else m->>'workout_focus' end,
            daily_routine = m->>'daily_routine',
            meals_count = case when m->>'meals_count' ~ '^[0-9]+$'
                               then (m->>'meals_count')::int end,
            supplements = case
                when jsonb_typeof(m->'supplements') = 'array'
                then (select string_agg(elem, ', ')
                      from jsonb_array_elements_text(m->'supplements') as elem)
                else m->>'supplements' end,
            training_frequency  = m->>'training_frequency',
            training_experience = m->>'training_experience',
            training_level      = m->>'training_level',
            biggest_obstacle    = m->>'biggest_obstacle',
            discovery_source    = m->>'discovery_source',
            aspiration          = m->>'aspiration',
            referral_code       = v_referral_code
        where id = new.id;
    exception when others then
        raise warning 'handle_new_user: campos do onboarding não gravados para % (%): %',
            new.id, sqlstate, sqlerrm;
    end;

    -- -----------------------------------------------------------------------
    -- 3.3 Preferências de privacidade do feed.
    -- A versão anterior do trigger criava esta linha; perder isso faria o
    -- usuário novo nascer sem preferências.
    -- -----------------------------------------------------------------------
    begin
        insert into public.user_preferences (user_id)
        values (new.id)
        on conflict (user_id) do nothing;
    exception when others then
        raise warning 'handle_new_user: preferências não criadas para % (%): %',
            new.id, sqlstate, sqlerrm;
    end;

    -- -----------------------------------------------------------------------
    -- 3.4 Lesões e alergias.
    -- Tabela user_health_profile (SINGULAR) — é de lá que o app lê
    -- (WorkoutViewModel.fetchUserHealthProfile).
    -- -----------------------------------------------------------------------
    begin
        insert into public.user_health_profile (user_id, injuries, allergies)
        values (new.id, v_injuries, v_allergies)
        on conflict (user_id) do update
            set injuries  = excluded.injuries,
                allergies = excluded.allergies;
    exception when others then
        raise warning 'handle_new_user: saúde não gravada para % (%): %',
            new.id, sqlstate, sqlerrm;
    end;

    -- -----------------------------------------------------------------------
    -- 3.5 Consumo do código de indicação.
    -- -----------------------------------------------------------------------
    if v_referral_code is not null then
        begin
            update public.referral_codes
               set redemptions_count = redemptions_count + 1
             where upper(code) = v_referral_code
               and (expires_at is null or expires_at > now())
               and redemptions_count < max_redemptions;
        exception when others then
            raise warning 'handle_new_user: indicação não computada para % (%): %',
                new.id, sqlstate, sqlerrm;
        end;
    end if;

    return new;
end;
$handle_new_user$;

commit;
