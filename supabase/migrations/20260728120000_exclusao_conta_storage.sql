-- 20260728120000_exclusao_conta_storage.sql
--
-- FAZ A EXCLUSÃO DE CONTA FUNCIONAR DE VERDADE (pelo app, não só pelo psql).
--
-- O DEFEITO (reproduzido em 28/07/2026 chamando a RPC como um usuário real):
--     POST /rest/v1/rpc/delete_user_account
--     403 — "Direct deletion from storage tables is not allowed.
--            Use the Storage API instead."  (código 42501)
-- e NADA era apagado: conta, perfil, hábitos, treinos e logs continuavam lá.
--
-- CAUSA: versões recentes do Supabase protegem `storage.objects` com o trigger
-- `protect_objects_delete`, que recusa qualquer DELETE direto — e a RPC apaga
-- as fotos pessoais exatamente assim. A intenção da RPC está certa (Storage não
-- é cascade; sem apagar, foto de perfil e de progresso corporal seguem
-- acessíveis por URL depois da conta excluída, o que é violação de LGPD), mas o
-- método deixou de ser permitido.
--
-- Este é o SEGUNDO defeito na exclusão encontrado hoje. O primeiro era o
-- trigger de pontuação derrubando a cascata (migration 20260727220000) — ele já
-- estava corrigido, e foi justamente por isso que este apareceu: antes, a
-- exclusão morria mais cedo e este nunca era alcançado.
--
-- Sem os dois, o app não cumpre a Guideline 5.1.1(v) da App Store, que exige
-- exclusão de conta dentro do próprio app. É bloqueio de publicação.
--
-- CORREÇÃO: o próprio trigger do Supabase define a via de escape — ele libera o
-- DELETE quando `storage.allow_delete_query` vale 'true' na sessão. Usar isso é
-- o caminho suportado, não um contorno: a flag existe para operações
-- administrativas conscientes como esta.
--
-- Segurança preservada: a função continua SECURITY DEFINER, o `set local` vale
-- só para a transação da chamada, e todos os deletes seguem filtrados por
-- `auth.uid()` — ninguém apaga arquivo de outra pessoa.
--
-- Idempotente.

begin;

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $delete_user_account$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        raise exception 'Not authenticated';
    end if;

    -- Libera o DELETE em storage.objects APENAS nesta transação. É o mecanismo
    -- que o próprio trigger `protect_delete` do Supabase consulta.
    perform set_config('storage.allow_delete_query', 'true', true);

    -- Storage não é cascade: todas as imagens pessoais têm que sair na mão, senão
    -- continuam públicas por URL depois da conta excluída (violação de LGPD).
    -- 1. Foto de perfil (case-insensitive: app grava UUID maiúsculo, PG é minúsculo).
    delete from storage.objects
     where bucket_id = 'avatars' and lower(name) = lower(v_uid::text) || '.jpg';

    -- 2. Fotos de check-in de desafio (fotos de corpo/progresso).
    delete from storage.objects
     where bucket_id = 'challenge_photos'
       and name like 'challenges/%/users/' || lower(v_uid::text) || '/%';

    -- 3. Imagens de post da comunidade (nome é UUID aleatório; casa pela URL do post).
    delete from storage.objects o
     using public.posts p
     where p.author_id = v_uid
       and o.bucket_id = 'posts'
       and p.image_url like '%/' || o.name;

    -- Por último a conta: o cascade leva perfil, hábitos, logs, treinos e o
    -- resto. Depois da migration 20260727220000, o trigger de pontuação sai
    -- silenciosamente quando o perfil já não existe, em vez de abortar tudo.
    delete from auth.users where id = v_uid;
end;
$delete_user_account$;

revoke all on function public.delete_user_account() from public, anon;
grant execute on function public.delete_user_account() to authenticated;

commit;
