-- Metadado de desafio legível por todos (para exibir no perfil do atleta)
--
-- Hoje a policy de SELECT de public.challenges libera a linha só se:
--   visibility = 'public'  OR  creator_id = auth.uid()  OR  o usuário está inscrito.
-- Logo, um desafio PRIVADO de OUTRO atleta não é legível por quem não participa
-- — nem o título. Mas o produto quer mostrar no perfil que a pessoa está num
-- "Desafio X" (nome + nº de participantes), SEM dar acesso a ranking/comunidade.
--
-- Esta migration abre o SELECT do METADADO do desafio para qualquer autenticado
-- (como uma conta privada no Instagram: o perfil/nome aparece, o conteúdo não).
-- O que continua protegido:
--   • Busca de desafios: filtrada no app por visibility='public' (privado não aparece).
--   • Vitrine (featured): idem, privado excluído no app.
--   • Ranking/comunidade do desafio: gate no app (card privado no perfil não abre
--     o detalhe). Refinar depois com RLS por participante nas tabelas de ranking.
-- A ESCRITA continua restrita (policies FOR INSERT/ALL inalteradas).

drop policy if exists "Challenges are readable by authenticated users" on public.challenges;
create policy "Challenges are readable by authenticated users"
    on public.challenges for select
    to authenticated
    using (true);
