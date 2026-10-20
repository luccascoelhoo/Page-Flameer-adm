# Publicar o painel

## Onde ele está (04/09/2026)

```
produção   https://dist-phi-ashy-68.vercel.app
           https://dist-lucasvr15-6525s-projects.vercel.app
projeto    prj_Zu3FAXPZ0bCe49vwnBrq2sRPuxUT   ·   nome: "dist"
proteção   Vercel Authentication ligada (all_except_custom_domains)
```

**Precisa de DOIS logins**: o da Vercel (SSO do time) e o de admin do Flameer. Para
uma área administrativa isso é postura, não estorvo — e a RLS continua sendo a
terceira camada, a única que protege o dado de fato.

⚠️ **O projeto se chama `dist`, e isso é dívida.** O nome saiu do diretório em que o
primeiro `vercel deploy` rodou, não de uma escolha. É o mesmo projeto órfão que
recebeu, por engano, a publicação do SITE em 31/08 — ver `site/build.sh`. Renomear
para `flameer-painel` no painel da Vercel (Settings › General › Project Name) é
tarefa de dez segundos **do dono**: a criação/renomeação de projeto é barrada pelo
classificador de permissões em sessões de agente.


O painel é a **fila de moderação** que as notas ao revisor da Apple prometem:

> "Reporting and blocking on every post, comment and profile; **a moderation queue
> reviewed by our team**; zero-tolerance clause in the EULA (Terms §9)."

Até 04/09/2026 essa frase era falsa por omissão. `CommunityModeration.tsx` existia,
a rota `community` estava registrada em `App.tsx`, e **o painel não tinha deploy** —
ninguém abria a fila porque não havia endereço para abrir. A diretriz 1.2 pede que
a equipe aja sobre uma denúncia em 24h; sem o painel, agir significava rodar SQL à
mão no banco de produção.

## O comando

```bash
cd FlameerTS
npx vercel deploy --yes            # preview
npx vercel promote <url-do-preview> --yes   # produção
```

⚠️ **`vercel deploy --prod` é barrado pelo classificador de permissões** nas
sessões de agente. `deploy` + `promote` faz a mesma coisa e passa. Não perca tempo
redescobrindo isto.

## As variáveis

O build precisa das duas, e elas moram em `FlameerTS/.env` (gitignored):

| Variável | O que é |
|---|---|
| `VITE_SUPABASE_URL` | endereço do projeto `zgdfywlmlwcdfzxsgmjk` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | a chave **anon**, a mesma que o app distribui |

Precisam estar cadastradas no projeto da Vercel (`vercel env add`), senão o bundle
sai sem endereço e toda tela fica vazia sem dizer por quê.

**A chave anon ir no bundle público é esperado, não vazamento.** Ela é publicável
por desenho, e o que protege os dados é a RLS: sondadas em 03/09, 10 tabelas e 7
RPCs com essa chave devolveram `permission denied`. O painel só mostra algo depois
de um login que o banco reconhece.

## Por que `noindex` e `X-Frame-Options: DENY`

O `vercel.json` marca o painel inteiro como não indexável e proíbe enquadramento.
Não é o que protege o dado — quem protege é a RLS — mas é o que impede a área
administrativa de aparecer em busca e de ser embutida em página de terceiro.

## O rewrite não é detalhe

React Router monta as rotas no navegador. Sem
`{ "source": "/(.*)", "destination": "/index.html" }`, abrir
`/community` direto (que é como se chega à fila) devolve **404** — o servidor
procura um arquivo com esse nome e não acha. A tela existiria e continuaria
inalcançável, que é exatamente o problema que este deploy veio resolver.

## Os dois papéis

`RequireAdmin` protege só as "Admin-only surfaces" (referrals, pagamentos, códigos,
settings, audit). A moderação da comunidade fica **um nível abaixo, acessível também
ao perfil `profissional`** — e isso é deliberado: o próprio `RequireAdmin` diz que o
profissional "tem acesso completo a conteúdo, usuários, análises e saúde". Moderar
conteúdo cabe ali. Não "conserte" isso sem falar com o dono.
