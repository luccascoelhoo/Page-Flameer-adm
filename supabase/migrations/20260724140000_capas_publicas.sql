-- 20260724140000_capas_publicas.sql
--
-- Capa de desafio em bucket PÚBLICO próprio.
--
-- O defeito (auditoria, Bloco B): a capa subia para o bucket privado
-- challenge_photos e era exibida via getPublicURL — que só funciona em bucket
-- público. Resultado: a imagem nunca carregava para ninguém.
--
-- A decisão: capa é vitrine (aparece no catálogo para todo mundo), então é
-- pública por definição — ao contrário das fotos de check-in, que continuam no
-- bucket privado com RLS por membro. Separar os dois também elimina o risco de
-- uma policy de capa afrouxar sem querer o acesso às fotos sensíveis.
--
-- Idempotente. Aplicar depois das migrations dos blocos A/B/C.

begin;

-- Bucket público. on conflict: reexecutar não muda nada.
insert into storage.buckets (id, name, public)
values ('challenge-covers', 'challenge-covers', true)
on conflict (id) do update set public = true;

-- Leitura pública (o CDN do Supabase já serve bucket público sem policy para
-- URLs /object/public/, mas a policy cobre também o acesso via API).
drop policy if exists "capas legíveis por todos" on storage.objects;
create policy "capas legíveis por todos"
    on storage.objects for select
    using (bucket_id = 'challenge-covers');

-- Escrita: autenticado, e só dentro da própria pasta <uid>/... — o mesmo
-- padrão do bucket de check-ins. Sem isso qualquer um sobrescrevia a capa
-- de qualquer desafio.
drop policy if exists "capa sobe na própria pasta" on storage.objects;
create policy "capa sobe na própria pasta"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'challenge-covers'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- Dono apaga/substitui a própria capa.
drop policy if exists "capa apagada pelo dono" on storage.objects;
create policy "capa apagada pelo dono"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'challenge-covers'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

commit;
