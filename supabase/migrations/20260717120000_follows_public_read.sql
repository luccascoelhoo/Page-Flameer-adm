-- Follows reais no app — leitura pública do grafo de follow
--
-- A tabela public.follows já existe. A policy atual é FOR ALL
-- USING (auth.uid() = follower_id), ou seja: um usuário só consegue LER as
-- linhas onde ELE é o follower. Isso impede contar os seguidores/seguidos de
-- OUTRO atleta (following_id = X), que é o que o perfil precisa exibir.
--
-- Esta migration adiciona uma policy de SELECT permissiva (grafo de follow é
-- público, como na maioria das redes sociais). As policies são OR'd por comando:
--   • SELECT: (auth.uid() = follower_id)  OR  true   -> liberado para todos
--   • INSERT/UPDATE/DELETE: continuam só via a policy FOR ALL (follower_id = você)
-- Ou seja, a ESCRITA permanece restrita ao dono; só a leitura abre.

drop policy if exists "Follows are viewable by everyone" on public.follows;
create policy "Follows are viewable by everyone"
    on public.follows for select
    to authenticated
    using (true);
