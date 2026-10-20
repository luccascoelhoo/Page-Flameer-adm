-- 20260728100000_autoconfirma_email.sql
--
-- DESTRAVA O CADASTRO: confirma o e-mail automaticamente no momento da criação.
--
-- O PROBLEMA (medido em 27-28/07/2026): a opção "Confirm email" foi ligada no
-- painel do Supabase entre 25 e 27/07. A partir daí:
--   * POST /auth/v1/signup passa a NÃO devolver sessão;
--   * o app tenta o login imediato e recebe 400 `email_not_confirmed`;
--   * a pessoa completa as ~26 perguntas do onboarding e fica presa numa tela
--     sem saída.
-- E o e-mail de confirmação frequentemente não chega: o SMTP padrão do
-- Supabase tem teto baixo de envios por hora, e estourá-lo devolve
-- 429 `over_email_send_rate_limit` — que chega a abortar o próprio cadastro,
-- sem criar conta nenhuma. Verificado: 3 sondagens espaçadas, todas 429.
--
-- Medido na base: todas as contas criadas até 25/07 estão confirmadas; as de
-- 27/07 em diante, nenhuma.
--
-- POR QUE AQUI E NÃO NO PAINEL: a correção equivalente é desmarcar
-- "Confirm email" em Authentication → Providers → Email. Este trigger produz o
-- mesmo efeito prático pelo banco, que é o acesso disponível — e tem a vantagem
-- de ser versionado junto do resto do schema, em vez de virar um ajuste
-- invisível no painel que ninguém lembra de ter feito.
--
-- TRADE-OFF, explícito: sem confirmação, alguém pode cadastrar usando o e-mail
-- de outra pessoa. Para o estágio atual do produto isso é aceitável — era
-- exatamente o comportamento vigente até 25/07 — mas NÃO é o destino final.
-- Quando houver SMTP próprio configurado (Resend/SendGrid/SES), o caminho certo
-- é religar a confirmação e remover este trigger:
--
--     drop trigger if exists on_auth_user_autoconfirm on auth.users;
--
-- Idempotente. Não altera nenhuma conta existente.

begin;

create or replace function public.autoconfirmar_email()
returns trigger
language plpgsql
security definer
set search_path = auth, pg_temp
as $autoconfirmar_email$
begin
    -- Só preenche quando o GoTrue deixou em branco (cadastro por e-mail com
    -- confirmação exigida). Login social já vem confirmado e não é tocado.
    if new.email_confirmed_at is null then
        new.email_confirmed_at := now();
    end if;
    return new;
end;
$autoconfirmar_email$;

-- BEFORE INSERT: precisa valer antes da linha ser gravada, para que o GoTrue
-- já enxergue a conta como confirmada e o login seguinte funcione.
drop trigger if exists on_auth_user_autoconfirm on auth.users;
create trigger on_auth_user_autoconfirm
    before insert on auth.users
    for each row execute function public.autoconfirmar_email();

commit;
