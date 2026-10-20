-- 20260724160000_meta_calorica_real.sql
--
-- Meta calórica calculada com a IDADE REAL do usuário.
--
-- O defeito (achado no teste de usabilidade): o app calcula a taxa metabólica
-- basal por Mifflin-St Jeor, que exige idade — mas a idade estava CRAVADA EM 25
-- ANOS no cliente (`- 5.0 * 25.0` em DietViewModel). A fórmula desconta 5 kcal
-- por ano de idade, então um usuário de 50 anos recebia uma meta ~125 kcal/dia
-- acima da dele, e um de 18 recebia ~35 abaixo. Todo o plano alimentar saía
-- calibrado para a pessoa errada.
--
-- A causa raiz é esta função: ela não devolvia `birth_year`, então o cliente não
-- TINHA como calcular certo. `profiles.birth_year` já existe (schema.sql:22) e é
-- coletado no onboarding ("Quando você nasceu?").
--
-- Idempotente (create or replace). Não altera assinatura de segurança: continua
-- security definer devolvendo APENAS a linha de quem chama.

begin;

-- DROP antes do CREATE: esta função já existe (criada em
-- 20260722100000_challenge_invites_and_weight_goals) devolvendo 5 colunas, e
-- aqui ela passa a devolver 6 (entra `birth_year`). O Postgres recusa
-- `create or replace` quando o tipo de RETORNO muda — falha com "cannot change
-- return type of existing function" e derruba a migration. Verificado no banco
-- real em 27/07/2026.
-- Seguro: nada além do app chama esta RPC, e ela é recriada na linha seguinte,
-- dentro da mesma transação — não há janela em que ela deixe de existir.
drop function if exists public.my_health_profile();

create or replace function public.my_health_profile()
returns table (
    gender        text,
    goal          text,
    height        numeric,
    weight        numeric,
    daily_routine text,
    birth_year    int
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
    select p.gender, p.goal, p.height, p.weight, p.daily_routine, p.birth_year
    from public.profiles p
    where p.id = auth.uid();
$$;

revoke all on function public.my_health_profile() from public, anon;
grant execute on function public.my_health_profile() to authenticated;

commit;
