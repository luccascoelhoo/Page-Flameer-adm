-- 20260727120000_integridade_cadastro.sql
--
-- CORRIGE A PERDA UNIVERSAL DOS DADOS DE SAÚDE NO CADASTRO.
--
-- O DEFEITO (provado no banco de produção em 27/07/2026, não deduzido):
-- 100% dos usuários que completavam o onboarding tinham o perfil gravado APENAS
-- com o nome. Sexo, peso, altura, objetivo, data de nascimento, rotina — tudo
-- NULL. Medido na base real: 13 dos 21 perfis (62%) estão totalmente vazios.
--
-- CADEIA CAUSAL, verificada ponta a ponta:
--   1. O app monta o metadata em prepareSignupMetadata() com
--      `"training_frequency": .string(frequency ?? "3")`. Não existe passo
--      `.frequency` no fluxo do onboarding, então `frequency` é SEMPRE nil e o
--      valor enviado é SEMPRE a string "3".
--   2. A constraint chk_profiles_training_frequency só aceita '0-2','3-5','6+'.
--      "3" viola.
--   3. handle_new_user grava os campos ricos num ÚNICO update. Um campo
--      inválido aborta o statement inteiro, e o `exception when others` do
--      bloco engole o erro em silêncio.
--   4. Resultado: a conta nasce, o app diz "sucesso", e o perfil de saúde some.
--      O DietViewModel então calcula a dieta sobre NULL e cai no fallback de
--      2000 kcal — o mesmo plano para todo mundo.
--
-- Reproduzido com o payload exato do app:
--   WARNING: handle_new_user: campos do onboarding não gravados (23514):
--            violates check constraint "chk_profiles_training_frequency"
--
-- Esta migration ataca as duas causas independentes:
--   A) o CONTRATO: três campos da UI oferecem valores que as constraints
--      recusam (verificado extraindo os literais do OnboardingView e cruzando
--      com pg_get_constraintdef);
--   B) a FRAGILIDADE: um campo ruim nunca mais pode derrubar os outros 20.
--
-- Idempotente.

begin;

-- ---------------------------------------------------------------------------
-- A. Alinhar as constraints aos valores que a interface realmente oferece
-- ---------------------------------------------------------------------------
-- Estes valores não são invenção: foram extraídos dos literais de
-- PremiumOptionsList em OnboardingView.swift. Recusá-los no banco não protege
-- nada — só descarta a resposta verdadeira de quem escolheu a opção.

-- "Não faço cardio" é uma resposta legítima e a UI a oferece (OnboardingView
-- ~:749). O CHECK não a previa, então quem escolhia perdia o perfil inteiro.
alter table public.profiles drop constraint if exists chk_profiles_cardio_preference;
alter table public.profiles add constraint chk_profiles_cardio_preference
    check (cardio_preference is null or cardio_preference = any (array[
        'none', 'post_15', 'session_30_45', 'separate_days'
    ]));

-- A UI oferece 7 origens (OnboardingView ~:818); o CHECK só previa 4.
-- 'appstore', 'youtube' e 'outro' derrubavam o cadastro.
alter table public.profiles drop constraint if exists chk_profiles_discovery_source;
alter table public.profiles add constraint chk_profiles_discovery_source
    check (discovery_source is null or discovery_source = any (array[
        'instagram', 'tiktok', 'google', 'indicacao', 'youtube', 'appstore', 'outro'
    ]));

-- O app envia "3" hoje (bug do fallback, corrigido no cliente em paralelo).
-- Aceitar também as formas cruas de 1 dígito torna o banco tolerante a
-- clientes antigos já instalados, que continuarão mandando "3" por meses.
alter table public.profiles drop constraint if exists chk_profiles_training_frequency;
alter table public.profiles add constraint chk_profiles_training_frequency
    check (training_frequency is null or training_frequency = any (array[
        '0-2', '3-5', '6+', '0', '1', '2', '3', '4', '5', '6'
    ]));

-- As demais constraints ficam como estão: os valores da UI já batem com elas
-- (conferido campo a campo para gender, goal, workout_place, session_time,
-- daily_routine, aspiration, biggest_obstacle) e as faixas numéricas de peso
-- (35–200), altura (120–220) e meals_count (3–6) são exatamente os limites dos
-- RulerPicker — clampados no cliente, então nunca chegam fora.

-- ---------------------------------------------------------------------------
-- B. Trigger à prova de divergência: campo ruim custa o campo, não o perfil
-- ---------------------------------------------------------------------------
-- Helpers de sanitização. A ideia: em vez de mandar o valor cru e torcer para
-- a constraint aceitar, o trigger só grava o que JÁ SABE ser válido. Um valor
-- fora do domínio vira NULL naquela coluna e as outras 20 seguem gravando.
-- Assim, uma opção nova na UI que ninguém lembrou de refletir no banco custa
-- um campo — nunca mais o perfil de saúde inteiro.

create or replace function public.sane_enum(p_val text, p_allowed text[])
returns text language sql immutable
set search_path = pg_catalog, pg_temp
as $$ select case when p_val = any (p_allowed) then p_val end $$;

create or replace function public.sane_num(p_val text, p_min numeric, p_max numeric)
returns numeric language sql immutable
set search_path = pg_catalog, pg_temp
as $$
    select case
        when p_val ~ '^[0-9]+(\.[0-9]+)?$'
         and p_val::numeric between p_min and p_max
        then p_val::numeric
    end
$$;

create or replace function public.sane_int(p_val text, p_min int, p_max int)
returns int language sql immutable
set search_path = pg_catalog, pg_temp
as $$
    select case
        when p_val ~ '^[0-9]+$'
         and p_val::int between p_min and p_max
        then p_val::int
    end
$$;

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
    v_freq          text;
begin
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

    -- Clientes antigos mandam "3"/"4"/"5" cru; normaliza para a faixa que o
    -- resto do produto entende, em vez de descartar a resposta.
    v_freq := case m->>'training_frequency'
                  when '0' then '0-2' when '1' then '0-2' when '2' then '0-2'
                  when '3' then '3-5' when '4' then '3-5' when '5' then '3-5'
                  when '6' then '6+'
                  else public.sane_enum(m->>'training_frequency',
                                        array['0-2','3-5','6+'])
              end;

    -- 1. O perfil nasce primeiro, com o mínimo indispensável. Fora de bloco
    -- protegido de propósito: se nem isto funciona, é melhor o cadastro falhar
    -- alto do que criar uma conta órfã que ninguém percebe.
    insert into public.profiles (id, name, avatar_url, email)
    values (
        new.id,
        coalesce(nullif(trim(coalesce(m->>'name', '')), ''), 'Atleta'),
        m->>'avatar_url',
        new.email
    )
    on conflict (id) do nothing;

    -- 2. Campos ricos, TODOS sanitizados contra o domínio real da coluna.
    -- Nenhum valor cru de metadata chega ao update: o que não for válido vira
    -- NULL sozinho, sem abortar o statement.
    begin
        update public.profiles set
            birth_year          = public.sane_int(m->>'birth_year', 1900, 2100),
            birth_month         = public.sane_int(m->>'birth_month', 1, 12),
            birth_day           = public.sane_int(m->>'birth_day', 1, 31),
            cohort_group        = coalesce(m->>'cohort_group', 'Não Definido'),
            gender              = public.sane_enum(m->>'gender', array['male','female']),
            goal                = public.sane_enum(m->>'goal', array['lose','gain','maintain']),
            height              = public.sane_num(m->>'height', 120, 220),
            weight              = public.sane_num(m->>'weight', 35, 200),
            desired_weight      = public.sane_num(m->>'desired_weight', 35, 200),
            workout_place       = public.sane_enum(m->>'workout_place',
                                      array['full_gym','basic_gym','home']),
            session_time        = public.sane_enum(m->>'session_time',
                                      array['30_45','60','90_plus']),
            cardio_preference   = public.sane_enum(m->>'cardio_preference',
                                      array['none','post_15','session_30_45','separate_days']),
            workout_focus       = case
                when jsonb_typeof(m->'workout_focus') = 'array'
                then (select string_agg(elem, ', ')
                        from jsonb_array_elements_text(m->'workout_focus') as elem)
                else m->>'workout_focus' end,
            daily_routine       = public.sane_enum(m->>'daily_routine',
                                      array['sedentary','active','heavy']),
            meals_count         = public.sane_int(m->>'meals_count', 3, 6),
            supplements         = case
                when jsonb_typeof(m->'supplements') = 'array'
                then (select string_agg(elem, ', ')
                        from jsonb_array_elements_text(m->'supplements') as elem)
                else m->>'supplements' end,
            training_frequency  = v_freq,
            training_experience = public.sane_enum(m->>'training_experience',
                                      array['none','lt6m','6m2y','gt2y']),
            training_level      = public.sane_enum(m->>'training_level',
                                      array['beginner','intermediate','advanced']),
            biggest_obstacle    = public.sane_enum(m->>'biggest_obstacle',
                                      array['consistency','habits','time','motivation']),
            discovery_source    = public.sane_enum(m->>'discovery_source',
                                      array['instagram','tiktok','google','indicacao',
                                            'youtube','appstore','outro']),
            aspiration          = public.sane_enum(m->>'aspiration',
                                      array['healthy','energy','motivation','body']),
            referral_code       = v_referral_code
        where id = new.id;
    exception when others then
        raise warning 'handle_new_user: campos do onboarding não gravados para % (%): %',
            new.id, sqlstate, sqlerrm;
    end;

    -- 3. Preferências de privacidade do feed.
    begin
        insert into public.user_preferences (user_id)
        values (new.id)
        on conflict (user_id) do nothing;
    exception when others then
        raise warning 'handle_new_user: preferências não criadas para % (%): %',
            new.id, sqlstate, sqlerrm;
    end;

    -- 4. Lesões e alergias (tabela user_health_profile, SINGULAR).
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

    -- 5. Consumo do código de indicação.
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
