# Flameer — Plano-Mestre de Alterações v1 (para aprovação)

*Objetivo: transformar o diagnóstico das Partes 1/1.5 em um plano executável,
com segurança como platô primário, seguindo o padrão existente do app, e com
verificação obrigatória antes de qualquer "pronto". Nada aqui será
implementado sem aprovação explícita.*

**Princípios que regem este plano** (gravados em memória):
1. Segurança acima de tudo — dados, comunicação, rotas, políticas.
2. Nunca sair da visão: app = chão; desafios = micro-comunidades; sensação
   Duolingo; loop de segmentação como fosso competitivo.
3. Compilar ≠ funcionar: todo item tem critério de verificação próprio.
4. Mesmo padrão do código existente (`@MainActor @Observable`, DTOs
   snake_case, RPCs `security definer` + `is_admin()`, tryRpc+fallback).

---

## FASE 0 — Fundação (pré-requisito de tudo)

> Sem a Fase 0, qualquer outra fase repete o erro da sessão anterior:
> código que compila mas nunca rodou contra um banco real.

### 0.1 Banco de staging + aplicar as 9 migrações
- **Hoje:** 9 migrações em `FlameerTS/supabase/migrations/` nunca rodaram num
  Postgres. Uma RPC já foi encontrada 100% quebrada (42803) apenas por
  leitura de código. O painel inteiro é teórico.
- **Alteração:** criar projeto Supabase de staging (ou branch DB), rodar
  `supabase db push`, executar TODAS as RPCs uma vez com dados sintéticos
  (script de smoke test que eu escrevo: chama cada `admin_*` e valida shape
  do JSON).
- **Depois:** cada função do painel comprovadamente executável; erros achados
  viram correções na própria Fase 0.
- **Segurança:** staging usa chaves próprias; nunca apontar app de produção
  para staging.
- **Verificação:** smoke test passa em 100% das RPCs; painel navegado com
  dados de seed.
- **Dono:** você cria o projeto/linka o CLI (`supabase login`); eu escrevo e
  rodo o smoke test.

### 0.2 Regenerar `types.ts` e eliminar os 60 `as any`
- **Hoje:** 60 casts `as any` em 25 arquivos = compilador cego. Foi assim que
  `challenge_enrollments` vs `challenge_participants` passou despercebido.
- **Alteração:** `supabase gen types` no projeto linkado → substituir
  `types.ts` → remover casts em passe único → corrigir cada mismatch que o
  compilador revelar.
- **Verificação:** `tsc --noEmit` limpo com ZERO `as any` novos; contagem
  final ≤ 5 (casos legitimamente dinâmicos, documentados um a um).

### 0.3 Commitar o WIP do iOS em blocos lógicos
- **Hoje:** 190 arquivos não commitados (17 deleções, 90 novos). Estado real
  do app sem backup, não revisável, e me impede de editar telas com
  segurança (ex.: matar mocks, posts 4:5).
- **Alteração:** sessão dedicada de commits em blocos (Início / Shape /
  Desafios / Comunidade / Perfil / Widgets / Design system). Eu preparo os
  agrupamentos e as mensagens; você aprova bloco a bloco.
- **Verificação:** `git status` limpo; build verde após cada bloco.

### 0.4 Auditoria de segurança do que JÁ existe (bloqueia lançamento)
Itens concretos encontrados no código, a auditar/corrigir no staging:

| # | Risco | Onde | Correção proposta |
|---|---|---|---|
| S1 | **XP declarado pelo cliente**: `grant_xp` recebe quantidade do app — qualquer cliente adulterado infla XP e corrompe leaderboard/prêmios | `AuthViewModel.swift:253` + RPC | RPC passa a aceitar só EVENTOS tipados (`habit_done`, `workout_logged`…) e o servidor decide o XP; caps diários no servidor |
| S2 | **Pontos de check-in declarados pelo cliente**: insert com `points_earned:100, status:"valid"` vindo do app | `ChallengeCheckInCameraView.swift:151-172` | `points_earned`/`status` viram DEFAULT/trigger no banco; cliente não envia; RLS bloqueia update dessas colunas |
| S3 | **RLS desconhecida** em `posts`, `post_likes`, `post_comments`, `challenge_daily_logs`, `challenge_participants` | schema do app | Auditar no staging (`pg_policies`); garantir: escrita só do dono, leitura conforme visibilidade; sem `USING(true)` de escrita |
| S4 | **Bucket `posts`/`avatars`**: verificar se são públicos e se escrita exige dono | storage.policies | Escrita autenticada só no próprio caminho (`user_id/` prefix); `challenge_photos` já usa signed URLs (manter) |
| S5 | **Chaves de IA em texto puro** na tabela `ai_settings` (painel) | Settings.tsx | Mover chamadas de IA para Edge Function (chave só no servidor); tabela guarda só configuração não-sensível |
| S6 | **Trigger de streak desconhecido**: streak é server-owned mas nunca inspecionamos o trigger | banco remoto | Extrair definição no staging; documentar; base para o escudo de ofensiva (item 3.2) |
| S7 | **Fix definitivo das refeições-fantasma**: chave da UI ≠ chave do servidor (por nome) + cache aditivo | `DietViewModel.swift:288-338` | Mapear servidor→UI por nome no fetch; servidor vira fonte única; cache só offline. Só depois do 0.3 (arquivo é WIP) e com teste manual no simulador |

- **Verificação:** relatório de auditoria com cada política citada; testes
  manuais de abuso (tentar dar XP via curl com anon key; tentar update de
  `points_earned` de outro usuário).

---

## FASE 1 — Núcleo de retenção ("Fechar o Dia") + honestidade

### 1.1 "Fechar o Dia" — o loop único estilo Duolingo
- **Hoje:** ações difusas (hábito, treino, dieta, check-in, post) sem um
  estado único de "cumpri hoje". Já existem os primitivos: bônus "dia
  completo" de 25 XP (`HabitsViewModel.swift:96`, deduplicado por dia) e o
  `InicioView` agregando os três domínios.
- **Alteração:**
  - **Definição de produto (sua aprovação):** dia fechado = todos os hábitos
    ativos do dia concluídos **+ 1 ação núcleo** (treino logado OU todas as
    refeições resolvidas OU check-in do desafio). Dias de descanso contam
    com hábitos + dieta.
  - **Banco:** migração `daily_closures(user_id, date, closed_at, components
    jsonb, primary key(user_id,date))`, RLS dono-escreve/lê +
    `is_admin()` leitura (alimenta a North Star no painel).
  - **App:** anel único "Hoje" no topo do `InicioView` (usa o
    `ActivityRingsView` novo com `size:` menor ou um anel dedicado);
    ao fechar → celebração (padrão já existe: confetti/flame motor) + upsert
    em `daily_closures`. XP do fechamento migra para o modelo de eventos S1.
- **Depois:** o usuário abre o app e responde em 1 segundo: "fechei o dia?"
  — a pergunta que forma hábito.
- **Segurança:** RLS owner-only; sem dados sensíveis; o painel lê agregado.
- **Verificação:** teste manual roteirizado no simulador (fechar dia com
  cada combinação de componentes; fuso horário virando meia-noite);
  linha aparece em `daily_closures` no staging.

### 1.2 Notificação de pré-perda de ofensiva
- **Hoje:** `NotificationManager` já agenda lembretes cientes de streak,
  mas não existe o gatilho "vai perder a ofensiva hoje".
- **Alteração:** serviço agenda notificação local diária condicional: se às
  20h o dia não está fechado E `streak >= 3` → "Sua ofensiva de N dias
  termina em 4h 🔥". Cancelada automaticamente ao fechar o dia. Tom:
  urgência leve, nunca culpa (coerente com "diversão, não obrigação").
- **Segurança:** 100% local (UNUserNotificationCenter); zero dados novos.
- **Verificação:** simulador com relógio alterado; fechar o dia cancela a
  notificação pendente.

### 1.3 Matar os mocks (honestidade + App Review)
- **Hoje / Alteração / Depois:**
  - `RankingView.swift:216-273`: fallback com competidores falsos e timer
    aleatório → **remover**; estado vazio honesto "Seja o 1º do ranking
    desta semana" com CTA de treino.
  - `Chat/ChatView.swift:223-234` (IA falsa): **remover a entrada** do v1
    (ou feature-flag "em breve"). Se quisermos mentor real: Edge Function
    com chave no servidor (S5) — fase futura.
  - `RadarSocialView.swift` (estático): **ocultar** do v1.
  - `ChallengeDetailView.swift:159` "compra fake" + catálogo mock
    (`ChallengeService.swift:13-41`): **ocultar seção de infoprodutos** até
    StoreKit real (fase futura; receita exige backend de validação).
  - Follow/contadores simulados (`CommunityViewModel.swift:145-154,227-228`):
    **remover contadores falsos** do perfil de terceiros no v1 (mostrar só
    dados reais: posts, badges); grafo de follow real é fase futura com
    tabela `user_follows` + RLS.
- **Por quê agora:** dado falso descoberto = confiança destruída; engajamento
  simulado é risco real de rejeição na App Review (guideline de conteúdo
  enganoso).
- **Verificação:** grep de `random(`/mock nas telas sociais = zero em
  caminhos de produção; navegação completa sem nenhum dado inventado.
- **Dependência:** 0.3 (arquivos estão no WIP).

### 1.4 Personalização honesta no onboarding
- **Hoje:** animação "gerando protocolo" é teatro (`OnboardingView.swift:874-945`),
  grava `"{}"` (`:679-682`); TDEE real existe mas com idade fixa 25
  (`DietViewModel.swift:160`); nascimento é coletado.
- **Alteração:**
  1. Corrigir idade: usar `birth_year` do perfil no cálculo Mifflin-St Jeor
     (paridade com o painel, que já faz certo).
  2. Trocar a animação fake por uma **tela de resultado real**: "Seu plano:
     X kcal/dia · Y treinos/semana · sem [lesões/alergias declaradas]" —
     os números saem do TDEE real + template selecionado.
  3. A seleção de plano por proximidade calórica já existe
     (`DietViewModel.swift:135-221`) — passa a ser explicada, não escondida.
- **Depois:** personalização real, visível e defensável, sem IA encenada.
- **Segurança:** nenhum dado novo; dados já coletados no onboarding.
- **Verificação:** matriz de teste com 6 perfis sintéticos (sexo × objetivo)
  conferindo kcal exibida vs cálculo manual; screenshot review.

---

## FASE 2 — O fosso: loop de segmentação fechado + integridade

### 2.1 Trilho "Recomendado para você" (coorte → desafio)
- **Hoje:** `cohort_group` coletado no onboarding
  (`OnboardingView.swift:702-716`) e **nunca consumido**; painel já clusteriza;
  app não filtra desafios por perfil. O único diferencial defensável não roda.
- **Alteração:**
  - **Banco:** migração `challenges.target_cohorts text[]` (nullable = para
    todos) + índice GIN.
  - **Painel:** no ChallengeForm, seletor múltiplo de coortes-alvo
    (Hipertrofia/Bem-Estar/Emagrecimento) — segue padrão do form atual.
  - **App:** `ChallengesViewModel` (já carrega tudo) ganha
    `recommendedChallenges`: filtra/ordena por `target_cohorts ∋ cohort_group`
    do perfil + `category` ↔ `goal`. `ChallengeView` ganha o trilho
    "Para você" acima do catálogo. Regra determinística — sem IA, sem
    latência, sem custo.
  - **Loop completo:** painel identifica grupo (clustering já entregue) →
    admin cria desafio com coorte-alvo → app entrega ao grupo certo.
- **Segurança:** `cohort_group` é dado de perfil já existente; exposição
  apenas do próprio usuário para filtro local; nada novo trafega.
- **Verificação:** 3 usuários de teste com coortes distintas veem trilhos
  diferentes; desafio sem alvo aparece para todos.
- **Dependência:** 0.1 (migração), 0.3 (ChallengeView/VM estão no WIP).

### 2.2 Integridade de gamificação (S1 + S2 executados)
- Executa as correções de XP-por-evento e pontos server-side da Fase 0.4.
- **Por quê aqui:** com desafios segmentados e prêmios, trapaça vira ataque
  ao produto (leaderboard falso = comunidade desmoralizada).
- **Verificação:** tentativa de abuso via API com anon key falha; XP total
  de um dia não excede o cap; testes de regressão dos fluxos de XP no app.

---

## FASE 3 — Diferencial visível + polimento de retenção

### 3.1 Prontidão "lite" desde o dia 1
- **Hoje:** ReadinessEngine exige wearable + 14 dias de baseline (correto,
  mas invisível nas 2 semanas críticas). `DailyCheckInSheet` já coleta
  sono/energia/estresse em `daily_checkins` — e o engine ignora.
- **Alteração:** estender o engine (Swift + TS, paridade mantida) com modo
  subjetivo: sem dados objetivos suficientes → score "estimado" a partir de
  sono/energia/estresse do check-in, SEMPRE rotulado como estimativa
  ("baseado no seu check-in"); com wearable, o objetivo domina e o subjetivo
  vira um dos componentes (peso divulgado, como os demais).
- **Segurança:** `daily_checkins` já existe; conferir RLS owner-only (S3).
- **Verificação:** testes de paridade Swift↔TS estendidos (mesmos casos nas
  duas implementações, como já fizemos); score lite aparece no dia 1 num
  usuário novo de simulador.

### 3.2 Escudo de ofensiva (streak freeze)
- **Hoje:** perder streak = perda seca; `BountyViewModel` (recompensas) é
  local-only; trigger de streak no servidor não inspecionado (S6).
- **Alteração (condicionada ao S6):** tabela `user_streak_shields` +
  ajuste do trigger para consumir escudo antes de zerar; escudo é
  GANHO (7 dias fechados = 1 escudo, máx. 2) — nunca comprado no v1.
- **Verificação:** cenário no staging: usuário com escudo pula um dia →
  streak preservado, escudo consumido, evento auditável.

### 3.3 North Star instrumentada
- **Hoje:** nenhuma métrica-norte; painel tem coortes de retenção mas o app
  não emite o evento certo.
- **Alteração:** North Star = **taxa de "dia fechado" D1/D7** (nasce do
  1.1, sem infra extra: `daily_closures` É o evento). Ativação = primeiro
  check-in de desafio (`challenge_daily_logs` já registra). Painel ganha um
  card na Central de Inteligência lendo essas duas fontes.
- **Verificação:** número do painel bate com contagem SQL manual no staging.

---

## Fora do v1 (explícito, para não haver ambiguidade)
Chat/mentor IA real · loja Bounty sincronizada · infoprodutos/StoreKit ·
RadarSocial · grafo de follow persistido · feed global como destaque
(permanece acessível, mas a comunidade do desafio lidera a navegação).
Cada um tem caminho definido, mas entra só depois do v1 medido.

---

## Sequência e gates de aprovação

```
FASE 0 (fundação/segurança)  ← gate: seu ok + staging criado
   ├─ 0.1 staging + migrações + smoke  ─┐
   ├─ 0.2 types.ts + fim dos as any     ├─ bloqueiam TUDO
   ├─ 0.3 commit do WIP em blocos       │
   └─ 0.4 auditoria S1–S7              ─┘
FASE 1 (retenção/honestidade) ← gate: aprovação da definição "dia fechado"
FASE 2 (fosso/integridade)    ← gate: aprovação do modelo target_cohorts
FASE 3 (diferencial/polish)   ← gate: S6 inspecionado (para 3.2)
```

Regra de verificação (vale para todo item): nada é declarado pronto por
compilar — cada entrega lista o que foi EXERCIDO (simulador/staging/teste) e
o que ficou apenas compilado.

---

## Revisão de coerência (autocrítica do próprio plano)

1. **Tensão: "cortar mocks" vs esforço já investido.** Resolvida por
   feature-flag/ocultar em vez de deletar — o código fica, o usuário não vê
   teatro. Coerente com a visão (nada genérico/encenado).
2. **Tensão: notificação de pré-perda vs "diversão sem peso".** Risco real de
   virar cobrança. Mitigação: tom lúdico, no máx. 1/dia, desativável, e só
   com streak ≥ 3 (quem não tem stake não é cobrado). Duolingo vive disso;
   manteremos o lado leve.
3. **Tensão: segurança primeiro vs velocidade.** O plano coloca S1/S2
   (integridade de XP/pontos) ANTES do trilho por coorte ganhar tração —
   ordem correta: não amplificar um sistema trapaceável.
4. **Risco não resolvido:** vários itens dependem de arquivos do seu WIP
   (0.3). Se o WIP não for commitado, Fase 1.3/2.1 ficam bloqueadas — o
   plano não tem alternativa segura a isso, de propósito.
5. **Verificação de visão:** cada fase mapeia à visão — 1.1/1.2 = Duolingo;
   2.1 = fosso da segmentação; 1.3/1.4 = anti-genérico; 3.1 = personal de
   bolso inteligente. Nenhum item foge da ideia principal.
6. **O que eu decidi NÃO propor:** reescrever o feed global, IA generativa
   no onboarding, e monetização agora — todos ampliariam largura antes de
   consertar profundidade, contradizendo o diagnóstico.
```
