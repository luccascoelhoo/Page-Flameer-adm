-- Acesso ao desafio vendido fora do app, por código de resgate.
--
-- PROBLEMA: não havia controle de acesso nenhum. A "compra" era um botão no app
-- chamando addToWallet() com um UUID aleatório como transação, gravado só em
-- UserDefaults. Qualquer pessoa desbloqueava de graça, não sincronizava entre
-- aparelhos e o acesso sumia ao reinstalar.
--
-- SOLUÇÃO: o site gera códigos após a venda; a pessoa resgata no app; o servidor
-- valida, marca como usado e vincula à conta. A verdade fica aqui, não no
-- aparelho — então reinstalar ou trocar de celular preserva o acesso.

-- 1. Códigos gerados pelo site de vendas
create table if not exists public.challenge_codes (
    code         text primary key,
    product_id   text not null,
    created_at   timestamptz not null default now(),
    expires_at   timestamptz,
    redeemed_by  uuid references auth.users(id) on delete set null,
    redeemed_at  timestamptz,
    -- Rastreia de qual venda veio, pra suporte e reembolso.
    order_ref    text
);

create index if not exists idx_challenge_codes_product on public.challenge_codes(product_id);

-- 2. Direitos de acesso já resgatados (o que o app consulta)
create table if not exists public.challenge_entitlements (
    user_id     uuid not null references auth.users(id) on delete cascade,
    product_id  text not null,
    granted_at  timestamptz not null default now(),
    source_code text,
    primary key (user_id, product_id)
);

alter table public.challenge_codes enable row level security;
alter table public.challenge_entitlements enable row level security;

-- 3. NENHUMA policy de SELECT em challenge_codes.
--    Com RLS ligado e sem policy, ninguém lê a tabela pelo PostgREST. É
--    deliberado: se o app pudesse ler, bastaria a chave anônima pra listar todos
--    os códigos válidos e distribuir o produto de graça. O acesso acontece só
--    pela função abaixo, que roda com SECURITY DEFINER.

-- 4. O usuário lê apenas os PRÓPRIOS direitos.
drop policy if exists "Users read own entitlements" on public.challenge_entitlements;
create policy "Users read own entitlements"
    on public.challenge_entitlements for select
    to authenticated
    using (auth.uid() = user_id);

-- Escrita só pela função (SECURITY DEFINER) — sem policy de INSERT/UPDATE,
-- ninguém se autoconcede um direito pelo cliente.

-- 5. Resgate: valida, marca o código como usado e concede o direito.
create or replace function public.redeem_challenge_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_code   text := upper(trim(p_code));
    v_row    public.challenge_codes%rowtype;
    v_user   uuid := auth.uid();
begin
    if v_user is null then
        return jsonb_build_object('valid', false, 'reason', 'not_authenticated');
    end if;

    -- FOR UPDATE trava a linha: sem isso, dois resgates simultâneos do mesmo
    -- código passariam os dois na verificação antes de qualquer um gravar.
    select * into v_row
    from public.challenge_codes
    where code = v_code
    for update;

    if not found then
        return jsonb_build_object('valid', false, 'reason', 'not_found');
    end if;

    if v_row.expires_at is not null and v_row.expires_at < now() then
        return jsonb_build_object('valid', false, 'reason', 'expired');
    end if;

    -- Já resgatado por OUTRA pessoa: recusa. Pelo mesmo usuário: devolve sucesso,
    -- pra reinstalar e digitar o código de novo não virar erro.
    if v_row.redeemed_by is not null and v_row.redeemed_by <> v_user then
        return jsonb_build_object('valid', false, 'reason', 'already_used');
    end if;

    update public.challenge_codes
       set redeemed_by = v_user,
           redeemed_at = coalesce(redeemed_at, now())
     where code = v_code;

    insert into public.challenge_entitlements (user_id, product_id, source_code)
    values (v_user, v_row.product_id, v_code)
    on conflict (user_id, product_id) do nothing;

    return jsonb_build_object('valid', true, 'product_id', v_row.product_id);
end;
$$;

revoke all on function public.redeem_challenge_code(text) from public;
grant execute on function public.redeem_challenge_code(text) to authenticated;

-- 6. Geração de códigos: feita pelo site com a service_role key, inserindo
--    direto em challenge_codes. Exemplo:
--
--    insert into public.challenge_codes (code, product_id, order_ref)
--    values ('ABD-7K2M-9QX4', 'abdomen-insano', 'pedido_12345');
--
-- ATENÇÃO — DIVERGÊNCIA DE PROJETO: o app aponta para `zgdfywlmlwcdfzxsgmjk`
-- (Secrets.xcconfig) e o config.toml para `fmcsresbwnjdfwpoklwg`. Aplicar no que
-- o app realmente usa:
--   supabase db push --project-ref zgdfywlmlwcdfzxsgmjk
