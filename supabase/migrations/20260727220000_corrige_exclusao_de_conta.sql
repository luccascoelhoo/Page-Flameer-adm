-- 20260727220000_corrige_exclusao_de_conta.sql
--
-- DESTRAVA A EXCLUSÃO DE CONTA.
--
-- O DEFEITO (reproduzido em 27/07/2026): apagar um usuário falha com
--     ERROR: insert or update on table "daily_scores" violates foreign key
--            constraint "daily_scores_user_id_fkey"
--     CONTEXT: PL/pgSQL function evaluate_daily_score() line 85
--
-- CADEIA: o DELETE em auth.users cascateia para `profiles`, e daí para
-- `daily_habit_logs`, `diet_logs` e `workout_logs`. O DELETE dessas três
-- dispara `evaluate_daily_score()`, que recalcula o dia e tenta gravar em
-- `daily_scores` — mas a linha de `profiles` já foi removida na mesma cascata,
-- então a chave estrangeira recusa. A transação inteira aborta.
--
-- Ou seja: NENHUMA conta podia ser excluída, nem pela RPC `delete_user_account`
-- que o app expõe. Isso é bloqueio de App Review — a Guideline 5.1.1(v) exige
-- que todo app com criação de conta ofereça exclusão dentro do próprio app.
--
-- Só apareceu agora porque `daily_scores` passou a existir hoje (migration
-- 20260727140000). Antes, o trigger falhava por outro motivo e o app inteiro
-- estava travado; com ele funcionando, o defeito de exclusão ficou visível.
--
-- CORREÇÃO: o trigger passa a sair silenciosamente quando o perfil não existe
-- mais. Não há score diário a recalcular para uma conta que está sendo apagada,
-- e insistir só derruba a exclusão.
--
-- Idempotente.

begin;

create or replace function public.evaluate_daily_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $evaluate_daily_score$
declare
    v_user_id uuid;
    v_date date;
    v_total_habits int;
    v_done_habits int;
    v_workout_done boolean;
    v_diet_done boolean;
    v_daily_xp int := 0;
    v_old_daily_xp int := 0;
    v_xp_delta int := 0;
    v_habit_pts int; v_workout_pts int; v_diet_pts int; v_perfect_pts int;
    v_cap int; v_step int;
begin
    if tg_op = 'DELETE' then
        v_user_id := old.user_id;
        v_date := old.date::date;
    else
        v_user_id := new.user_id;
        v_date := new.date::date;
    end if;

    -- GUARDA DE EXCLUSÃO DE CONTA.
    -- Quando o usuário é apagado, a cascata remove `profiles` e só depois os
    -- logs — e o DELETE dos logs chega aqui com o perfil já inexistente. Sem
    -- esta saída, o insert em daily_scores viola a FK e a exclusão inteira é
    -- abortada. Não há nada a pontuar para quem está deixando o produto.
    if not exists (select 1 from public.profiles where id = v_user_id) then
        return null;
    end if;

    -- Valores das regras configuráveis (painel), com defaults de segurança.
    select coalesce(max(case when code = 'HABIT_DONE'    and enabled then points end), 0),
           coalesce(max(case when code = 'WORKOUT_DONE'  and enabled then points end), 0),
           coalesce(max(case when code = 'DIET_COMPLETE' and enabled then points end), 0),
           coalesce(max(case when code = 'PERFECT_DAY'   and enabled then points end), 0),
           coalesce(max(case when code = 'DAILY_XP_CAP'  and enabled then points end), 2147483647),
           greatest(1, coalesce(max(case when code = 'LEVEL_STEP' then points end), 1000))
      into v_habit_pts, v_workout_pts, v_diet_pts, v_perfect_pts, v_cap, v_step
      from public.xp_rules;

    select count(*) into v_total_habits
      from public.habits where user_id = v_user_id;

    select count(*) into v_done_habits
      from public.daily_habit_logs
     where user_id = v_user_id and date::date = v_date and done = true;

    select exists (select 1 from public.workout_logs
                    where user_id = v_user_id and date::date = v_date)
      into v_workout_done;

    select exists (select 1 from public.diet_logs
                    where user_id = v_user_id and date::date = v_date and consumed = true)
      into v_diet_done;

    v_daily_xp := v_done_habits * v_habit_pts;
    if v_workout_done then v_daily_xp := v_daily_xp + v_workout_pts; end if;
    if v_diet_done    then v_daily_xp := v_daily_xp + v_diet_pts;    end if;
    if v_total_habits > 0 and v_done_habits = v_total_habits
       and v_workout_done and v_diet_done then
        v_daily_xp := v_daily_xp + v_perfect_pts;
    end if;

    -- Teto: sem ele, criar 50 hábitos vira XP livre.
    v_daily_xp := least(v_daily_xp, v_cap);

    select coalesce(xp_gained, 0) into v_old_daily_xp
      from public.daily_scores
     where user_id = v_user_id and date = v_date;

    v_xp_delta := v_daily_xp - coalesce(v_old_daily_xp, 0);

    if v_xp_delta <> 0 then
        update public.profiles
           set xp    = greatest(0, xp + v_xp_delta),
               level = greatest(1, greatest(0, xp + v_xp_delta) / v_step + 1)
         where id = v_user_id;
    end if;

    insert into public.daily_scores (user_id, date, xp_gained)
    values (v_user_id, v_date, v_daily_xp)
    on conflict (user_id, date)
    do update set xp_gained = excluded.xp_gained;

    insert into public.weekly_leaderboard (year, week_number, user_id, xp_gained)
    values (extract(isoyear from v_date)::int,
            extract(week    from v_date)::int,
            v_user_id, v_daily_xp)
    on conflict (year, week_number, user_id)
    do update set xp_gained = public.weekly_leaderboard.xp_gained + v_xp_delta,
                  last_updated_at = now();

    return null;
end;
$evaluate_daily_score$;

commit;
