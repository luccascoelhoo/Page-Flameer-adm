-- 20260727180000_desafios_integridade.sql
--
-- FECHA TRÊS FUROS NOS DESAFIOS: pontuação em dobro, check-in falsificável e
-- inscrição em desafio privado sem convite.
--
-- Contexto medido em 27/07/2026: a base ainda não tem check-ins, então NÃO há
-- dado inflado para recuperar. Esta migration é preventiva — e é justamente por
-- isso que precisa entrar antes de o produto ter uso real.
--
-- ===========================================================================
-- FURO 1 — Pontos e ofensiva contados EM DOBRO
-- ===========================================================================
-- Dois motores somavam o mesmo check-in. A RPC submit_challenge_checkin fazia
-- INSERT em challenge_daily_logs e, logo depois, um UPDATE somando +10 pontos e
-- +1 de ofensiva. Só que o INSERT dispara o trigger AFTER INSERT
-- `on_challenge_daily_log_inserted`, que JÁ soma NEW.points_earned e já
-- incrementa a ofensiva. Resultado: 20 pontos e 2 dias de ofensiva por
-- check-in. Depois de N dias, o participante mostrava 20N pontos e ofensiva 2N.
--
-- É o mesmo padrão "trigger + RPC" que já tinha queimado o XP global e foi
-- fechado lá; aqui ele sobreviveu porque a migration que criou a RPC nunca
-- dropou o trigger legado.
--
-- ESCOLHA: fica o TRIGGER, sai o UPDATE da RPC. O trigger cobre QUALQUER
-- caminho de inserção (RPC, painel admin, importação), enquanto o UPDATE da RPC
-- só cobria o caminho dela. Um motor só, no ponto mais baixo.
--
-- ===========================================================================
-- FURO 2 — Check-in falsificável por POST direto
-- ===========================================================================
-- A policy `"Users can insert their own logs"` permitia INSERT direto em
-- challenge_daily_logs pelo PostgREST. Combinada com duas fragilidades:
--   * o índice único de 1-por-dia é PARCIAL (`where checkin_date is not null`),
--     então um POST sem `checkin_date` escapa dele e pode repetir no mesmo dia;
--   * `points_earned` tem DEFAULT 100 e nada valida o valor enviado.
-- Ou seja: dava para forjar quantos check-ins quisesse, com a pontuação que
-- quisesse, e cada um ainda gerava um post no feed da comunidade.
--
-- ===========================================================================
-- FURO 3 — Entrar em desafio privado, lotado ou encerrado
-- ===========================================================================
-- A policy legada `"Users can manage own enrollments"` é FOR ALL com
-- USING (user_id = auth.uid()). Policies permissivas se combinam por OR, então
-- ela anulava por completo a policy correta `"users enrol themselves"` — que
-- valida visibilidade, prazo e lotação. Bastava um POST em
-- challenge_participants para entrar em qualquer desafio, inclusive privado.
-- Uma vez dentro, `is_challenge_member` liberava o feed de fotos e o ranking
-- com a variação de peso de todos os participantes.
--
-- Mesmo problema de OR nas duas policies de leitura `USING (true)`, que
-- expunham o mapa completo de quem está em qual desafio.
--
-- Idempotente.

begin;

-- ---------------------------------------------------------------------------
-- 1. RPC sem a soma duplicada
-- ---------------------------------------------------------------------------
create or replace function public.submit_challenge_checkin(
    p_challenge_id uuid,
    p_photo_url text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid uuid := auth.uid();
    v_today date := (now() at time zone 'America/Sao_Paulo')::date;
    v_inserted int;
begin
    if v_uid is null or not public.is_challenge_member(p_challenge_id, v_uid) then
        return false;
    end if;

    -- O ON CONFLICT repete o predicado do índice PARCIAL; sem ele o Postgres
    -- não casa o arbiter e lança 42P10.
    insert into public.challenge_daily_logs
        (challenge_id, user_id, photo_url, status, points_earned, checkin_date)
    values (p_challenge_id, v_uid, p_photo_url, 'valid', 10, v_today)
    on conflict (challenge_id, user_id, checkin_date)
        where checkin_date is not null do nothing;

    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
        return false; -- já tinha check-in hoje
    end if;

    -- SEM update de total_points/current_streak aqui: quem pontua é o trigger
    -- on_challenge_daily_log_inserted, disparado pelo insert acima. Somar nos
    -- dois lugares era exatamente a dupla contagem.
    return true;
end;
$$;

revoke all on function public.submit_challenge_checkin(uuid, text) from public, anon;
grant execute on function public.submit_challenge_checkin(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Fechar a escrita direta em challenge_daily_logs
-- ---------------------------------------------------------------------------
-- Todo check-in passa a ser obrigatoriamente pela RPC, que valida
-- pertencimento, carimba a data civil e fixa a pontuação.
drop policy if exists "Users can insert their own logs" on public.challenge_daily_logs;
drop policy if exists "users write their own check-ins" on public.challenge_daily_logs;
revoke insert on public.challenge_daily_logs from anon, authenticated;

-- Leitura: só quem é do desafio. A policy `USING (true)` expunha o check-in de
-- toda a plataforma — a policy correta já existe e passa a valer sozinha.
drop policy if exists "Participants can view logs" on public.challenge_daily_logs;

-- O dono podia reverter a própria moderação (PATCH status='valid' na linha que
-- tinha sido denunciada), o que tornava a denúncia decorativa. Moderação é da
-- RPC report_challenge_checkin, que roda como definer.
drop policy if exists "owner updates own check-in" on public.challenge_daily_logs;
revoke update on public.challenge_daily_logs from anon, authenticated;

-- Defesa em profundidade: mesmo que algum caminho volte a inserir direto, a
-- pontuação de um check-in fica limitada. Sem isto, o DEFAULT 100 da coluna era
-- pontuação livre.
do $$
begin
    if not exists (select 1 from pg_constraint
                    where conrelid = 'public.challenge_daily_logs'::regclass
                      and conname = 'chk_challenge_log_pontos') then
        alter table public.challenge_daily_logs
            add constraint chk_challenge_log_pontos
            check (points_earned >= 0 and points_earned <= 100) not valid;
    end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Fechar a inscrição irrestrita
-- ---------------------------------------------------------------------------
-- As policies corretas (`users enrol themselves`, `users leave their own
-- challenges`, `users update their own enrolment`, `participants readable by
-- challenge members`) já existem e cobrem cada verbo. As legadas abaixo só
-- serviam para anulá-las por OR.
drop policy if exists "Users can manage own enrollments" on public.challenge_participants;
drop policy if exists "Participants can view junction" on public.challenge_participants;

-- total_points, current_streak e max_streak são placar: quem escreve é o
-- trigger. Sem este revoke, a policy de UPDATE do próprio dono permitiria um
-- PATCH direto colocando qualquer pontuação no ranking.
revoke update on public.challenge_participants from anon, authenticated;

commit;
