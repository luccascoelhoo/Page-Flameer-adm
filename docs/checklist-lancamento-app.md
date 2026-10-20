# Checklist de lançamento — Flameer iOS (App Store)

> Gerado em 23/07/2026 a partir de auditoria verificada por código (grep + build).
> Cada item diz ONDE está o problema no código e O QUE é considerado "pronto".
> Ordem = prioridade. Os itens 1–4 são bloqueadores: sem eles a Apple rejeita ou o produto engana o usuário.

---

## 1. StoreKit de verdade (monetização é um stub hoje) — BLOQUEADOR

**Onde:** `Flameer/Core/Servicos/StoreKitManager.swift`

**Estado atual (verificado):**
- `isPremium` lê `flameer_is_premium_override` do **UserDefaults** (linha ~18). Qualquer pessoa vira premium sem pagar — e ninguém vira premium pagando.
- `setPremiumOverride(_:)` liga/desliga premium direto.
- `updateCustomerProductStatus()` tem a verificação real de transação **comentada** (linha ~71).
- Não existe nenhum product ID definido no projeto, nem arquivo `.storekit` de teste.
- O botão "Gerenciar assinatura — R$ 9,90 no 1º mês" (SettingsSheetView) é vitrine sem produto atrás.

**Pronto quando:**
- [ ] Produto de assinatura auto-renovável criado no App Store Connect (definir ID, ex.: `com.flameer.app.elite.monthly`) com oferta introdutória de R$ 9,90.
- [ ] `Product.products(for:)` carregando o produto real; `isPremium` derivado de `Transaction.currentEntitlements` (descomentar e completar `updateCustomerProductStatus`).
- [ ] Override de UserDefaults **removido** (ou atrás de `#if DEBUG`).
- [ ] Botão **"Restaurar compras"** visível no paywall (exigência da Apple).
- [ ] Arquivo `.storekit` local para testar sem conta sandbox.
- [ ] Testado no sandbox: comprar, restaurar, cancelar, expirar.
- [ ] Conferir TODOS os pontos que checam `isPremium` (PaywallView, MemberProfileDetailView etc.) contra o entitlement real.

## 2. Vídeos de execução (Abdômen Insano) — BLOQUEADOR de conteúdo

**Estado atual (verificado):** NÃO existe infraestrutura de vídeo — nenhum campo `video_url` nos modelos (`WorkoutExercise` em WorkoutView.swift), nenhuma coluna no schema Supabase, nenhum player na UI.

**Os vídeos JÁ EXISTEM** — o dono forneceu em 23/07/2026. São por **faixa de semana × tipo** (não por exercício), o que combina com `WorkoutGroup.weekNumber` + `focus` que já existem no modelo:

| Semanas | Tipo | Link |
|---|---|---|
| 1, 2, 3 | Treino | https://www.youtube.com/watch?v=k_hzI2IWShw |
| 4 | Treino | https://www.youtube.com/watch?v=5N0auA3J6co |
| 5, 6 | Treino | https://www.youtube.com/watch?v=9fGs21Jih-w |
| 1, 2 | Cardio | https://www.youtube.com/watch?v=yCaqg_UY3xk |
| 3, 4 | Cardio | https://www.youtube.com/watch?v=b2DqIRguX2A |
| 5, 6 | Cardio | https://www.youtube.com/watch?v=pHHiJ5vHtLQ |

**Pronto quando:**
- [ ] Mapa `(weekNumber, focus) -> URL` — pode começar como constante no app; migrar pra coluna no banco quando houver mais desafios com vídeo.
- [ ] Player no nível da SESSÃO (não do exercício): botão "Ver execução" no card do treino do dia quando houver vídeo para aquela semana/tipo.
- [ ] YouTube exige `WKWebView` com embed (o `AVPlayer` não toca link do YouTube) — ou trocar por arquivos no Supabase Storage.
- [ ] Fallback limpo quando não há vídeo para a semana (não mostrar botão quebrado).
- Obs.: o treino desse desafio também precisa ser reestruturado (pendência antiga do dono).

## 2b. Dieta não tem geração NENHUMA — e há promessa quebrada — BLOQUEADOR de produto

**Verificado em 23/07/2026, rastreando o caminho do dado:**

- `DietViewModel` apenas **lê** da tabela `diets`. Não gera nada.
- Usuário novo sem plano cai em `ensureUserDiet()`, que cria uma dieta **VAZIA** ("Minha Dieta"). Refeições só aparecem via template do admin, cópia de desafio, ou digitação manual.
- `OnboardingPlanSummary` calcula TMB/TDEE/macros **de verdade** (Mifflin-St Jeor) e a tela "Seu plano está pronto" exibe "2.848 kcal/dia · 160g proteína"… e **nada disso é persistido**. Busca por `targetKcal`/`proteinG` sendo salvos: zero resultados.

Ou seja: o onboarding promete um plano calculado e a aba Dieta entrega vazio. O treino já tem geração real por IA (ver seção 3) — a dieta ficou desalinhada.

**Pronto quando:**
- [ ] Edge Function `generate-diet` no mesmo padrão de `generate-workout`: recebe peso, altura, idade, sexo, objetivo, rotina, nº de refeições, restrições e preferências → devolve plano com refeições, horários e macros.
- [ ] Persistir o resultado nas tabelas `diets` / `meals` / `meal_items` do usuário.
- [ ] Card de estado vazio na aba Dieta com "Começar" → `DietOnboardingView` → geração (espelhar o `emptyWorkoutInviteCard` de WorkoutView.swift).
- [ ] Alternativa mais barata, se IA for demais: aplicar o `OnboardingPlanSummary` já calculado (a matemática existe e está correta) montando um plano por regras a partir da tabela `foods` (TACO, já semeada).

## 3. Deep links quebrados (domínio flameer.app não existe) — BLOQUEADOR de features sociais

**Onde (verificado):**
- QR do cartão de atleta: `AthleteCardView.swift:88` → `https://flameer.app/u/<username>`
- Convite de desafio: `Challenge.swift:108` e `CreateChallengeSheet.swift:520` → `flameer.app/d/<código>`

**Estado:** o domínio não responde. QR e convites compartilhados levam a lugar nenhum.

**Pronto quando (escolher um caminho):**
- [ ] Comprar `flameer.app` + páginas de redirect + Universal Links (apple-app-site-association), **ou**
- [ ] Trocar o formato do convite para código puro dentro do app (sem URL) e o QR para deep link `flameer://` — mais rápido, menos bonito.

## 4. App Store Connect — operacional (sem código)

- [ ] Conta Apple Developer paga ativa.
- [ ] Listing: nome, subtítulo, descrição, keywords, categoria (Saúde e Fitness).
- [ ] Screenshots (6.9" e 6.5" no mínimo) — usar o fluxo novo do onboarding, que ficou forte.
- [ ] **Privacy Nutrition Labels**: o app coleta e-mail, nome, dados de saúde (HealthKit), fotos (check-in), dados de uso. Preencher com cuidado — mentir aqui é rejeição/remoção.
- [ ] URLs no listing: privacidade = `https://flameer-legal.vercel.app/privacidade.html` (já no app), suporte = definir.
- [ ] Produto IAP submetido JUNTO com o primeiro binário (revisão conjunta).
- [ ] TestFlight com beta real antes de submeter.

## 4b. Publicar a IA de treino no Supabase — PENDENTE (o app já chama)

O app **já chama** a Edge Function `generate-workout` (código em `FlameerTS/supabase/functions/generate-workout/`). Enquanto ela não estiver publicada, toda geração cai no fallback local — e a IA continua não sendo real na prática. O fallback é silencioso (só loga), então isso não aparece como erro na tela.

Projeto: `fmcsresbwnjdfwpoklwg`

```bash
supabase secrets set LOVABLE_API_KEY=<chave> --project-ref fmcsresbwnjdfwpoklwg
supabase functions deploy generate-workout --project-ref fmcsresbwnjdfwpoklwg
supabase migration list --project-ref fmcsresbwnjdfwpoklwg   # conferir as 5 migrations não commitadas
```

- [ ] Função publicada e testada com uma geração real.
- [ ] Confirmar que a `LOVABLE_API_KEY` tem crédito (a função devolve 402 quando acaba → app cai no fallback sem avisar o usuário).
- [ ] Decidir se o fallback deve avisar o usuário ("montei pelo catálogo, IA indisponível") em vez de silenciar.

**Padrão a seguir:** mesmo gateway/modelo do `chat-mentor` que já existia (Lovable → Gemini). Chave no servidor, nunca no binário. A função valida o JSON do modelo antes de devolver, pra o app não receber treino quebrado.

## 5. XP / gamificação — precisa ser desenhada (não só implementada)

**Estado atual (verificado):** `grant_xp` (RPC Supabase) é chamado **1 vez** no app inteiro; o nível ("Recruta · Nível 1") não tem função nem progressão visível; conquistas/badges têm sobreposição.

O dono ainda não definiu o design desse sistema — **alinhar antes de codar**. Perguntas em aberto: o que dá XP (treino? hábito? dia fechado? desafio?), o que o nível desbloqueia, como aparece no cartão/perfil/comunidade.

## 6. Limpezas rápidas antes do binário final

- [ ] Deletar `RankingView` (Comunidade) — código morto com dados FAKE; nunca é instanciado, mas não pode ir pro binário.
- [ ] Revisar strings de log com emoji (cosmético, não bloqueia).
- [ ] `types.ts` do painel (FlameerTS) está desatualizado vs. schema — regenerar.

## 7. Verificação em DEVICE físico (simulador não cobre)

- [ ] Giroscópio: moeda 3D da tela inicial, tilt do cartão de perfil, e o anti-flicker do XP/OFENSIVA no cartão (correção aplicada em 23/07 — `ProfileCardView.swift`: zona morta + `compositingGroup`; confirmar que o "piscar" sumiu).
- [ ] HealthKit real (anéis, passos, sono) + fluxo de consentimento novo (`HealthPrivacyView`).
- [ ] Notificações reais: lembrete de treino no horário APRENDIDO (ver nota abaixo), ofensiva em risco à noite, win-back.
- [ ] Câmera do check-in de desafio (a permissão `NSCameraUsageDescription` foi adicionada em 23/07 — antes crashava).

---

## Nota de arquitetura: os onboardings de treino e dieta foram religados

Mudança de 23/07/2026 — **não desfazer sem entender o porquê.**

Os dois onboardings específicos (`WorkoutOnboardingView`, `DietOnboardingView`) existiam, estavam ligados nas abas… e nunca apareciam para ninguém. Causa: `OnboardingView.prepareSignupMetadata()` marcava `workout_onboarding_done` e `diet_onboarding_done` como `true` **no cadastro**, com dados vazios (`"{}"`). As abas usam essas flags pra decidir se apresentam o próprio onboarding.

Além de escondidos, eles eram **ocos**: coletavam 6–8 telas de respostas, mostravam 3,2s de loading falso, abriam um paywall stub ("Paywall Treino" / "Paywall Dieta") e salvavam a string literal `"{}"` — jogando tudo fora. Só as lesões/alergias sobreviviam, em chaves separadas.

O que mudou:
1. A pré-marcação no cadastro saiu. Quem passa pelo onboarding geral faz o específico ao entrar em cada aba.
2. As respostas agora viram `WorkoutOnboardingData` / `DietOnboardingData` (em `Treino/Modelos/WorkoutOnboardingData.swift`), persistidos de verdade.
3. Os paywalls stub saíram do fim dos dois fluxos. **Quando a monetização real entrar (seção 1), decidir conscientemente onde o paywall reaparece** — não foi "removido de propósito pra sempre", foi removido por ser placeholder que descartava dados.
4. `WorkoutOnboardingData` é exatamente o que alimenta o prompt de `generate-workout`. Os dados do onboarding geral que faltavam localmente (foco, peso, altura) passaram a ser salvos em UserDefaults — antes iam só pro metadata do Supabase e o app não conseguia lê-los de volta.

Também nesta data, na aba Treino: o card de estado vazio virou convite único ("Monte seu treino com IA" + "Começar" → onboarding). O botão "Manual" saiu do card, mas continua acessível em "MONTAR", no cabeçalho de DIVISÃO DE TREINOS — era o **único** gatilho do `FreeWorkoutQuickBuilderSheet` no app, e sem esse novo acesso o construtor livre viraria código morto.

## Nota de arquitetura: horário de treino agora é 100% aprendido

O app **não pergunta mais** o horário de treino (nem no onboarding, nem em Configurações). O fluxo, todo verificado:

1. `WorkoutViewModel.logWorkout` grava a hora da 1ª conclusão do dia numa janela das últimas 30 (`StorageKey.workoutCompletionHours`).
2. `UserRhythm.refreshObservedWorkoutTime()` minera a **mediana** (amostra mínima: 3 treinos).
3. `NotificationScheduler.reconcile()` — disparado pela assinatura de estado do `MainTabView` (completar treino muda a assinatura) — reagenda o lembrete para `observado − 30min`, dentro da janela acordado/dormindo.
4. Prioridade: **observado > declarado (legado) > padrão 8h**. Configurações → Notificações mostra o horário aprendido (somente leitura, "Aprendendo…" antes de 3 amostras).

Não reintroduzir DatePicker de horário de treino sem alinhar com o dono.
