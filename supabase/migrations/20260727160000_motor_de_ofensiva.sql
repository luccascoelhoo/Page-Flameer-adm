-- 20260727160000_motor_de_ofensiva.sql
--
-- LIGA A OFENSIVA (streak). Ela nunca funcionou.
--
-- O DEFEITO (medido no banco em 27/07/2026): `profiles.streak` está em 0 para
-- os 21 perfis da base, e NENHUMA função, trigger ou RPC escreve nessa coluna.
-- Confirmado varrendo pg_proc por `update public.profiles ... streak =`:
-- zero resultados. O app apenas LÊ o valor — que é sempre 0.
--
-- POR QUE ISSO É GRANDE: a ofensiva é o alicerce da gamificação, e seis coisas
-- dependem dela. Todas estavam mortas ao mesmo tempo:
--   * o número "DIAS" no topo da tela inicial;
--   * o nível do perfil (travado em "Recruta" para sempre);
--   * o XP dos marcos Bronze/Prata/Ouro/Diamante — nunca creditado;
--   * as recompensas de 7/14/21 dias — nunca desbloqueadas;
--   * a notificação de "ofensiva em risco" — nunca disparada;
--   * o card e o PNG de compartilhamento, que saíam com "0 DIAS ATIVOS".
--
-- DEFINIÇÃO ADOTADA (explícita, porque não havia nenhuma no projeto):
--   * dia ativo   = existe linha em daily_scores com xp_gained > 0, ou seja, a
--                   pessoa marcou hábito, treinou ou fechou a dieta naquele dia;
--   * a ofensiva  = quantidade de dias ATIVOS CONSECUTIVOS terminando em hoje
--                   ou em ontem;
--   * o "ou ontem" é deliberado: às 8h da manhã a pessoa ainda não teve chance
--     de registrar nada hoje, e zerar o contador nesse momento puniria alguém
--     que não fez nada de errado. Ela perde a ofensiva ao fim do dia seguinte;
--   * o dia é o de America/Sao_Paulo, igual ao resto do produto
--     (workout_logs.date, diet_logs.date e daily_habit_logs.date já usam esse
--     fuso por default).
--
-- Idempotente.

begin;

-- ---------------------------------------------------------------------------
-- 1. Cálculo da ofensiva de um usuário
-- ---------------------------------------------------------------------------
create or replace function public.calcular_streak(p_user_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with hoje as (
        select (current_timestamp at time zone 'America/Sao_Paulo')::date as d
    ),
    -- Dias ativos, do mais recente para o mais antigo.
    ativos as (
        select ds.date
          from public.daily_scores ds, hoje
         where ds.user_id = p_user_id
           and ds.xp_gained > 0
           and ds.date <= hoje.d
         order by ds.date desc
    ),
    -- Numera a sequência. Numa corrida ininterrupta, (data + posição) é
    -- constante — é isso que identifica o bloco consecutivo mais recente sem
    -- precisar de recursão.
    marcado as (
        select date, row_number() over (order by date desc) as pos
          from ativos
    ),
    corrida as (
        -- (pos - 1) é bigint; sem o cast o Postgres não acha `date + bigint`.
        select count(*) as dias
          from marcado
         where date + (pos - 1)::int = (select max(date) from marcado)
    )
    select coalesce((
        select c.dias::int
          from corrida c, hoje h
         where (select max(date) from marcado) >= h.d - 1   -- corrida ainda viva
    ), 0);
$$;

revoke all on function public.calcular_streak(uuid) from public, anon;
grant execute on function public.calcular_streak(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Manter profiles.streak em dia
-- ---------------------------------------------------------------------------
-- Roda depois de cada escrita em daily_scores — que é exatamente onde
-- evaluate_daily_score registra o resultado do dia. Assim a ofensiva acompanha
-- hábito, treino e dieta sem precisar de gatilho em cada uma das três tabelas.
create or replace function public.sincronizar_streak()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid  uuid := coalesce(new.user_id, old.user_id);
    v_novo int;
begin
    v_novo := public.calcular_streak(v_uid);
    update public.profiles
       set streak = v_novo
     where id = v_uid
       and streak is distinct from v_novo;   -- evita escrita à toa
    return null;
end;
$$;

drop trigger if exists on_daily_score_streak on public.daily_scores;
create trigger on_daily_score_streak
    after insert or update or delete on public.daily_scores
    for each row execute function public.sincronizar_streak();

-- ---------------------------------------------------------------------------
-- 3. RPC para o app reconciliar ao abrir
-- ---------------------------------------------------------------------------
-- O trigger cobre a escrita, mas a ofensiva também EXPIRA com a passagem do
-- tempo — e o tempo não dispara trigger. Sem isto, quem parou de treinar
-- continuaria vendo o número congelado do último dia ativo. O app chama esta
-- função ao abrir; ela recalcula e devolve o valor corrente.
create or replace function public.meu_streak()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid  uuid := auth.uid();
    v_novo int;
begin
    if v_uid is null then
        return 0;
    end if;
    v_novo := public.calcular_streak(v_uid);
    update public.profiles
       set streak = v_novo
     where id = v_uid
       and streak is distinct from v_novo;
    return v_novo;
end;
$$;

revoke all on function public.meu_streak() from public, anon;
grant execute on function public.meu_streak() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Recalcular o histórico existente
-- ---------------------------------------------------------------------------
-- A base já tem daily_scores de quem usou o app; sem este backfill, quem já
-- vinha treinando continuaria com 0 até a próxima atividade.
update public.profiles p
   set streak = public.calcular_streak(p.id)
 where public.calcular_streak(p.id) is distinct from p.streak;

-- ---------------------------------------------------------------------------
-- 5. Corrige o fuso do check-in diário
-- ---------------------------------------------------------------------------
-- daily_checkins.date usava CURRENT_DATE, e o servidor roda em UTC — enquanto
-- workout_logs, diet_logs e daily_habit_logs usam America/Sao_Paulo. Entre 21h
-- e a meia-noite de Brasília, o check-in caía no DIA SEGUINTE e o treino da
-- mesma noite no dia correto: o histórico do usuário ficava com um buraco e um
-- registro adiantado. Verificado: às 21h30 de SP, CURRENT_DATE já é D+1.
-- ⚠️ EDITADO EM 09/08/2026, DEPOIS DE APLICADA — e a exceção se justifica.
--
-- A regra da casa é não reescrever migration já aplicada. Esta ganhou guarda
-- porque, sem ela, o REPLAY do repositório deixa de reproduzir o banco: a tabela
-- `daily_checkins` está órfã (0 linhas, 0 FK de entrada, 0 funções, 0 triggers,
-- 0 referências no app) e é candidata a `drop`. No dia em que alguém a dropar,
-- este `alter table` sem guarda aborta — e como o arquivo é transacional
-- (`commit` logo abaixo), leva junto o motor de ofensiva INTEIRO:
-- `calcular_streak`, `meu_streak` e `sincronizar_streak`.
--
-- Ou seja: a edição não muda nada em quem já aplicou, e é o que impede um drop
-- futuro de quebrar a reconstrução. É o mesmo molde que
-- `20260723120000_bloco_a_seguranca.sql:361` já usa para `daily_scores`.
do $daily_checkins$
begin
    if to_regclass('public.daily_checkins') is not null then
        alter table public.daily_checkins
            alter column date set default ((current_timestamp at time zone 'America/Sao_Paulo')::date);
    else
        raise notice 'daily_checkins não existe neste banco — default de fuso pulado.';
    end if;
end
$daily_checkins$;

commit;
