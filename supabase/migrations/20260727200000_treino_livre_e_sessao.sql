-- 20260727200000_treino_livre_e_sessao.sql
--
-- PERMITE REGISTRAR TREINO LIVRE / TREINO DE IA.
--
-- O DEFEITO: `workout_logs.workout_id` é NOT NULL e referencia `workouts`. Mas
-- o "Treino Livre" (montado pelo usuário na hora) e o "Treino com IA" geram um
-- `UUID()` aleatório no cliente, que não existe em `workouts`. O insert violava
-- a chave estrangeira, `logWorkout` caía no catch e devolvia false — e como o
-- retorno era descartado, a tela de vitória aparecia normalmente.
-- Resultado: 100% dos treinos livres e de IA eram perdidos em silêncio.
-- Nem workout_logs, nem workout_set_logs, nem XP (o trigger nunca disparava).
--
-- CONTRADIÇÃO ESTRUTURAL no mesmo ponto: a FK é ON DELETE SET NULL numa coluna
-- NOT NULL. Ou seja, apagar um treino do catálogo faria o Postgres tentar
-- gravar NULL numa coluna que não aceita NULL, e o DELETE falharia. As duas
-- regras nunca puderam valer juntas.
--
-- CORREÇÃO: tornar `workout_id` opcional. Um treino sem plano é um fato
-- legítimo do produto — a pessoa treinou, e o registro dela vale. O vínculo com
-- um plano do catálogo passa a ser informação adicional, não requisito.
-- Isto também torna o ON DELETE SET NULL coerente pela primeira vez.
--
-- Idempotente.

begin;

alter table public.workout_logs
    alter column workout_id drop not null;

-- Índice para as telas que agrupam por plano (divisão de treinos, anéis de
-- categoria) não degradarem agora que a coluna admite NULL.
create index if not exists workout_logs_workout_idx
    on public.workout_logs (workout_id)
    where workout_id is not null;

-- ---------------------------------------------------------------------------
-- Sessão de treino em andamento
-- ---------------------------------------------------------------------------
-- Hoje o estado do treino vive só na memória do aparelho: se o iOS mata o app
-- em segundo plano (telefone no bolso entre as séries) ou ele crasha, perdem-se
-- as séries já registradas, o tempo e a carga — sem rascunho e sem aviso.
--
-- Esta tabela é o espelho no servidor do rascunho local: permite retomar o
-- treino em outro aparelho e sobreviver à reinstalação. O cliente grava o
-- progresso aqui de forma incremental e apaga a linha ao finalizar.
--
-- Uma sessão aberta por usuário — retomar é sempre "o treino que ficou pela
-- metade", não uma lista de rascunhos.
create table if not exists public.workout_sessions (
    user_id      uuid primary key references public.profiles(id) on delete cascade,
    workout_id   uuid references public.workouts(id) on delete set null,
    -- Rótulo do treino (letra/título) para reconstruir a tela mesmo quando o
    -- plano é livre e não existe em `workouts`.
    label        text,
    started_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    -- Estado das séries. JSONB porque o formato é do cliente e vai evoluir com
    -- a tela; o servidor só precisa guardar e devolver.
    progress     jsonb not null default '{}'::jsonb
);

alter table public.workout_sessions enable row level security;

drop policy if exists "sessao de treino do proprio usuario" on public.workout_sessions;
create policy "sessao de treino do proprio usuario"
    on public.workout_sessions for all
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

commit;
