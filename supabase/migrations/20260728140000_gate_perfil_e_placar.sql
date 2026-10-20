-- 20260728140000_gate_perfil_e_placar.sql
--
-- DUAS COISAS, ligadas pelo mesmo princípio: o cliente não decide o que é
-- verdade sobre o usuário — o servidor decide.
--
-- ===========================================================================
-- 1. PLACAR FALSIFICÁVEL (crítico de segurança, achado em 28/07/2026)
-- ===========================================================================
-- `authenticated` tinha UPDATE em TODAS as colunas de profiles, inclusive xp,
-- streak e level. Reproduzido com um usuário real:
--     PATCH /rest/v1/profiles?id=eq.<meu>  {"xp":999999,"streak":365,"level":99}
--     HTTP 204  →  xp foi de 10 para 999999
-- Ou seja: qualquer pessoa com o app instalado podia se colocar em primeiro no
-- ranking com uma linha de curl. Todo o sistema de gamificação — que é metade
-- da proposta do produto — era decorativo do ponto de vista de integridade.
--
-- A partir daqui o usuário só edita direto o que é dele por natureza: nome,
-- foto e visibilidade do perfil. Placar (xp/streak/level) é escrito
-- EXCLUSIVAMENTE pelos triggers, que rodam como definer. Dados corporais
-- passam pela RPC abaixo, que sanitiza.
--
-- ===========================================================================
-- 2. RPC PARA COMPLETAR O PERFIL (sustenta o gate de entrada do app)
-- ===========================================================================
-- Hoje quem entra por Apple/Google cai no app com o perfil VAZIO, e o cálculo
-- de dieta desaba no genérico de 2000 kcal. Medido: 13 dos 27 perfis (48%)
-- estão sem sexo, peso, altura ou objetivo.
--
-- A correção no app é trocar a porteira: em vez de um booleano no Keychain
-- (`isOnboarded`), quem decide é o DADO — se o perfil não tem o mínimo para o
-- produto funcionar, a pessoa vai para o questionário em vez do app. Esta RPC
-- é como o questionário grava o resultado quando a conta JÁ EXISTE (o caminho
-- de cadastro continua pelo trigger handle_new_user).
--
-- Mesma sanitização campo a campo do handle_new_user: valor fora do domínio
-- vira NULL naquela coluna em vez de derrubar a gravação inteira.
--
-- Idempotente.

begin;

-- ---------------------------------------------------------------------------
-- 1. Fecha a escrita direta no perfil
-- ---------------------------------------------------------------------------
revoke update on public.profiles from anon, authenticated;

-- O que o usuário legitimamente edita sozinho, e nada além disso.
grant update (name, avatar_url, public_profile) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Completar o próprio perfil
-- ---------------------------------------------------------------------------
create or replace function public.completar_meu_perfil(p_dados jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $completar_meu_perfil$
declare
    v_uid uuid := auth.uid();
    m jsonb := coalesce(p_dados, '{}'::jsonb);
    v_freq text;
begin
    if v_uid is null then
        raise exception 'Not authenticated' using errcode = '42501';
    end if;

    -- Clientes antigos mandam "3"/"4"/"5" cru; normaliza em vez de descartar.
    v_freq := case m->>'training_frequency'
                  when '0' then '0-2' when '1' then '0-2' when '2' then '0-2'
                  when '3' then '3-5' when '4' then '3-5' when '5' then '3-5'
                  when '6' then '6+'
                  else public.sane_enum(m->>'training_frequency', array['0-2','3-5','6+'])
              end;

    -- COALESCE em cada campo: completar o perfil nunca APAGA o que já existe.
    -- Se a pessoa só respondeu parte, o resto permanece como estava.
    update public.profiles set
        name                = coalesce(nullif(trim(coalesce(m->>'name','')), ''), name),
        birth_year          = coalesce(public.sane_int(m->>'birth_year', 1900, 2100), birth_year),
        birth_month         = coalesce(public.sane_int(m->>'birth_month', 1, 12), birth_month),
        birth_day           = coalesce(public.sane_int(m->>'birth_day', 1, 31), birth_day),
        cohort_group        = coalesce(m->>'cohort_group', cohort_group),
        gender              = coalesce(public.sane_enum(m->>'gender', array['male','female']), gender),
        goal                = coalesce(public.sane_enum(m->>'goal', array['lose','gain','maintain']), goal),
        height              = coalesce(public.sane_num(m->>'height', 120, 220), height),
        weight              = coalesce(public.sane_num(m->>'weight', 35, 200), weight),
        desired_weight      = coalesce(public.sane_num(m->>'desired_weight', 35, 200), desired_weight),
        workout_place       = coalesce(public.sane_enum(m->>'workout_place',
                                  array['full_gym','basic_gym','home']), workout_place),
        session_time        = coalesce(public.sane_enum(m->>'session_time',
                                  array['30_45','60','90_plus']), session_time),
        cardio_preference   = coalesce(public.sane_enum(m->>'cardio_preference',
                                  array['none','post_15','session_30_45','separate_days']), cardio_preference),
        workout_focus       = coalesce(case
                                  when jsonb_typeof(m->'workout_focus') = 'array'
                                  then (select string_agg(elem, ', ')
                                          from jsonb_array_elements_text(m->'workout_focus') as elem)
                                  else m->>'workout_focus' end, workout_focus),
        daily_routine       = coalesce(public.sane_enum(m->>'daily_routine',
                                  array['sedentary','active','heavy']), daily_routine),
        meals_count         = coalesce(public.sane_int(m->>'meals_count', 3, 6), meals_count),
        supplements         = coalesce(case
                                  when jsonb_typeof(m->'supplements') = 'array'
                                  then (select string_agg(elem, ', ')
                                          from jsonb_array_elements_text(m->'supplements') as elem)
                                  else m->>'supplements' end, supplements),
        training_frequency  = coalesce(v_freq, training_frequency),
        training_experience = coalesce(public.sane_enum(m->>'training_experience',
                                  array['none','lt6m','6m2y','gt2y']), training_experience),
        training_level      = coalesce(public.sane_enum(m->>'training_level',
                                  array['beginner','intermediate','advanced']), training_level),
        biggest_obstacle    = coalesce(public.sane_enum(m->>'biggest_obstacle',
                                  array['consistency','habits','time','motivation']), biggest_obstacle),
        discovery_source    = coalesce(public.sane_enum(m->>'discovery_source',
                                  array['instagram','tiktok','google','indicacao',
                                        'youtube','appstore','outro']), discovery_source),
        aspiration          = coalesce(public.sane_enum(m->>'aspiration',
                                  array['healthy','energy','motivation','body']), aspiration)
    where id = v_uid;

    -- Lesões e alergias vivem em user_health_profile (SINGULAR).
    begin
        if jsonb_typeof(m->'injuries') = 'array' or jsonb_typeof(m->'allergies') = 'array' then
            insert into public.user_health_profile (user_id, injuries, allergies)
            values (
                v_uid,
                coalesce((select array_agg(e) from jsonb_array_elements_text(
                    case when jsonb_typeof(m->'injuries') = 'array' then m->'injuries'
                         else '[]'::jsonb end) as e), '{}'::text[]),
                coalesce((select array_agg(e) from jsonb_array_elements_text(
                    case when jsonb_typeof(m->'allergies') = 'array' then m->'allergies'
                         else '[]'::jsonb end) as e), '{}'::text[])
            )
            on conflict (user_id) do update
                set injuries = excluded.injuries, allergies = excluded.allergies;
        end if;
    exception when others then
        raise warning 'completar_meu_perfil: saúde não gravada para % (%): %', v_uid, sqlstate, sqlerrm;
    end;

    return true;
end;
$completar_meu_perfil$;

revoke all on function public.completar_meu_perfil(jsonb) from public, anon;
grant execute on function public.completar_meu_perfil(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. O perfil tem o mínimo para o produto funcionar?
-- ---------------------------------------------------------------------------
-- É esta função que a porteira do app consulta. O critério é o conjunto EXATO
-- que o cálculo de dieta exige (Mifflin-St Jeor + objetivo): sem qualquer um
-- deles, a meta calórica desaba no genérico de 2000 kcal e o produto entrega
-- o mesmo plano para todo mundo.
create or replace function public.meu_perfil_completo()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1 from public.profiles
         where id = auth.uid()
           and gender     is not null
           and weight     is not null
           and height     is not null
           and birth_year is not null
           and goal       is not null
    );
$$;

revoke all on function public.meu_perfil_completo() from public, anon;
grant execute on function public.meu_perfil_completo() to authenticated;

commit;
