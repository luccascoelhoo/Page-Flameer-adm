-- Cadastro quebrado: constraints de profiles rejeitavam valores que o app manda.
--
-- Diagnosticado em 25/07/2026 testando /auth/v1/signup direto contra o servidor.
-- O gatilho handle_new_user insere em public.profiles; qualquer CHECK violado
-- estoura 23514 e aborta a criação do usuário INTEIRA — nenhuma conta era criada,
-- e o app só mostrava a mensagem genérica do Postgres.
--
-- Dois problemas encontrados:
--
--   1. training_frequency: o app mandava "3" (o resto do código usa "3-5").
--      Corrigido no app; nada a fazer aqui.
--
--   2. cardio_preference: a opção "Não faço cardio" do onboarding manda "none",
--      que não está na CHECK. Como paliativo o app OMITE o campo (a coluna aceita
--      NULL), mas isso perde a informação: NULL passa a significar tanto "não
--      respondeu" quanto "não faz cardio". Esta migration resolve de verdade,
--      liberando 'none' como valor válido.
--
-- Depois de aplicar isto, vale voltar o app a mandar "none" explicitamente,
-- em vez de omitir — o dado fica correto e o painel consegue segmentar por isso.

-- Recria a CHECK incluindo 'none'. Nome da constraint conforme o erro 23514
-- devolvido pelo servidor (chk_profiles_cardio_preference).
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS chk_profiles_cardio_preference;

ALTER TABLE public.profiles
    ADD CONSTRAINT chk_profiles_cardio_preference
    CHECK (
        cardio_preference IS NULL
        OR cardio_preference IN ('post_15', 'session_30_45', 'separate_days', 'none')
    );

-- ATENÇÃO — DIVERGÊNCIA DE PROJETO:
-- O app aponta para o projeto Supabase `zgdfywlmlwcdfzxsgmjk` (Secrets.xcconfig),
-- mas FlameerTS/supabase/config.toml aponta para `fmcsresbwnjdfwpoklwg`. Rodar
-- `supabase db push` sem `--project-ref` manda esta migration para o projeto
-- ERRADO. Aplicar explicitamente no que o app usa:
--
--   supabase db push --project-ref zgdfywlmlwcdfzxsgmjk
--
-- Vale conferir qual dos dois é o ambiente real antes de qualquer deploy.
