-- 20260727140000_daily_scores_e_series.sql
--
-- DESTRAVA AS TRÊS AÇÕES CENTRAIS DO APP.
--
-- O DEFEITO (reproduzido no banco de produção em 27/07/2026):
-- finalizar treino, marcar refeição e marcar hábito falhavam TODAS com
--     ERROR: relation "public.daily_scores" does not exist
-- ou seja, o app era inutilizável para o uso diário. Não é caso de borda: são
-- as três ações que o produto inteiro existe para registrar.
--
-- CAUSA: os três triggers abaixo chamam `evaluate_daily_score()`...
--     daily_habit_logs → on_habit_log_updated
--     diet_logs        → on_diet_log_updated
--     workout_logs     → on_workout_log_updated
-- ...e essa função lê e escreve em `public.daily_scores`, que está declarada no
-- schema base mas NUNCA foi criada neste banco. Mais um sintoma do mesmo drift
-- que já tinha derrubado o cadastro.
--
-- `daily_scores` não é acessório: é o registro que torna a pontuação
-- IDEMPOTENTE. A função lê o XP já creditado no dia, calcula o delta e aplica
-- só a diferença. Sem ela, marcar e desmarcar um hábito inflaria o XP a cada
-- toque. Por isso a correção é criar a tabela — e não remover o uso dela.
--
-- Aproveita para fechar dois buracos de integridade em workout_set_logs, que
-- não tinha NENHUMA constraint além das chaves estrangeiras.
--
-- Idempotente.

begin;

-- ---------------------------------------------------------------------------
-- 1. A tabela que faltava
-- ---------------------------------------------------------------------------
-- Definição idêntica à do schema base (o antigo supabase/schema.sql, linhas
-- 362-367), para a função encontrar exatamente o que espera: PK composta
-- (user_id, date), que é o alvo do ON CONFLICT dela.
create table if not exists public.daily_scores (
    user_id   uuid not null references public.profiles(id) on delete cascade,
    date      date not null,
    xp_gained int  not null default 0,
    primary key (user_id, date)
);

create index if not exists daily_scores_date_idx on public.daily_scores (date);

-- ---------------------------------------------------------------------------
-- 2. RLS: histórico diário é do dono, e ninguém escreve à mão
-- ---------------------------------------------------------------------------
-- A tabela é preenchida EXCLUSIVAMENTE pelo trigger, que roda como security
-- definer. Nenhum cliente precisa de INSERT/UPDATE/DELETE aqui — e liberar
-- escrita permitiria forjar XP direto pelo PostgREST.
alter table public.daily_scores enable row level security;

drop policy if exists "Users read their own daily scores" on public.daily_scores;
create policy "Users read their own daily scores"
    on public.daily_scores for select
    to authenticated
    using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.daily_scores from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Integridade das séries de treino
-- ---------------------------------------------------------------------------
-- workout_set_logs não tinha constraint nenhuma. Verificado: o banco aceitava
-- reps = -50, weight = -200, e também 99999/99999. O volume total do treino é
-- somado como reps × weight, então um valor negativo ou absurdo contamina o
-- histórico de evolução, o recorde pessoal e o ranking — sem nenhum sinal.
--
-- Faixas: até 1000 repetições e 1000 kg cobrem qualquer treino real com folga
-- (o recorde mundial de levantamento terra está abaixo de 505 kg) e ainda assim
-- barram digitação errada e adulteração via API.
do $$
begin
    if not exists (select 1 from pg_constraint
                    where conrelid = 'public.workout_set_logs'::regclass
                      and conname = 'chk_set_logs_reps') then
        -- NOT VALID: não reprocessa as linhas já existentes (que podem ter sido
        -- gravadas antes desta regra), mas vale para toda escrita nova.
        alter table public.workout_set_logs
            add constraint chk_set_logs_reps check (reps >= 0 and reps <= 1000) not valid;
    end if;
    if not exists (select 1 from pg_constraint
                    where conrelid = 'public.workout_set_logs'::regclass
                      and conname = 'chk_set_logs_weight') then
        alter table public.workout_set_logs
            add constraint chk_set_logs_weight check (weight >= 0 and weight <= 1000) not valid;
    end if;
    if not exists (select 1 from pg_constraint
                    where conrelid = 'public.workout_set_logs'::regclass
                      and conname = 'chk_set_logs_index') then
        alter table public.workout_set_logs
            add constraint chk_set_logs_index check (set_index >= 0 and set_index <= 100) not valid;
    end if;
end $$;

-- Uma série é única por (treino, exercício, número da série). Sem isto, um
-- toque duplo no botão de salvar gravava a MESMA série duas vezes e dobrava o
-- volume do dia. Verificado: o banco aceitava set_index 1 repetido três vezes
-- no mesmo exercício.
--
-- Índice PARCIAL sobre as linhas já existentes seria arriscado (pode haver
-- duplicata histórica), então limpa antes: mantém a linha mais recente de cada
-- combinação e descarta as repetidas.
delete from public.workout_set_logs a
 using public.workout_set_logs b
 where a.workout_log_id = b.workout_log_id
   and a.exercise_id    = b.exercise_id
   and a.set_index      = b.set_index
   and a.ctid < b.ctid;

create unique index if not exists workout_set_logs_uma_por_serie
    on public.workout_set_logs (workout_log_id, exercise_id, set_index);

commit;
