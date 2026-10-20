# Flameer — Plano de Conversão do Onboarding (UX + Psicologia Comportamental)

*Revisão de design + plano de ação para fadiga de decisão, retenção inicial e
conversão via vieses cognitivos. Guardrail: nada de dark pattern nem número
inventado — toda "prova" é real, calculada dos dados do usuário.*

## Diagnóstico do estado atual (fatos)
- Onboarding = 23 passos lineares (`OnboardingView.swift`).
- A tela "Montando seu protocolo" (`:874-945`) é **teatro**: grava `"{}"`
  (`:679-682`), planos vêm de templates. Passos falsos ("Calculando gasto
  calórico…") não calculam nada.
- `cohort_group` (Hipertrofia/Bem-Estar/Emagrecimento) derivado no signup
  (`:702-716`) mas **nunca consumido** no app.
- TMB/TDEE real (Mifflin-St Jeor) já existe no `DietViewModel`.
- Monetização é **stub** (`StoreKitManager` sem produtos; `ChallengeDetailView:159`
  "Fake purchase for MVP") — a tela de oferta é greenfield.

## A) Novo fluxo (6 fases)
1. **Quiz leve** — 3 blocos (Você / Treino / Dieta), **Smart Defaults** nas
   respostas mais comuns, barra de progresso em **gradiente** que acelera no
   fim (Goal-Gradient, Kivetz). Default é editável (não forçado).
2. **"Gerando" com Ilusão do Trabalho HONESTA** (Buell & Norton) — mostra os
   bastidores REAIS: TMB calculado, filtro de lesões, coorte identificada;
   número aparecendo ("TMB: 1.780 kcal ✓"); ≤ 2,5s.
3. **Prévia de Valor** (Reciprocidade, Cialdini) — entrega antes de pedir:
   dias/semana, macros, análise de perfil, timeline do objetivo, e o
   **desafio da coorte** (fecha o loop de segmentação = o fosso).
4. **Cartão 3D de Perfil** (Efeito IKEA, Norton-Mochon-Ariely) — foto + nome +
   3 estilos premium (Ignição/Obsidiana/Champagne), tilt por giroscópio
   (Reduce Motion → estático). CTA "Continuar com a inscrição".
5. **Cadastro** — Sign in with Apple (obrigatório se houver outros logins,
   guideline 4.8) ou sobrenome+e-mail+senha.
6. **Oferta** — Contraste + Aversão à Perda.

**Sequência recomendada:** Prévia → Cartão 3D → **Oferta** → cadastro no
checkout (usa o pico emocional; menos fricção antes do "sim").

## B) UI — Prévia de Valor + Cartão 3D
**Prévia de Valor** (cards empilhados, adaptativo, laranja): header de perfil +
análise real; card Treino (dias/split); card Dieta (macros + kcal reais do
TDEE); card Timeline (peso→desejado a ~0,5–0,75 kg/sem, **rotulado como
estimativa**); card Coorte (1 desafio). Todos os números derivam do input.

**Cartão 3D:** squircle premium, parallax por `CoreMotion` (Reduce Motion →
estático); editável ao vivo (foto opcional, nome, 3 estilos); mostra
XP0/Recruta/ofensiva (antecipa progressão); CTA abaixo.

## C) Oferta — Contraste + Aversão à Perda
Ancoragem por decoy: Mensal R$39,90 (âncora) / **Anual R$199 "MAIS ESCOLHIDO
−58%"** (alvo, card ampliado) / Vitalício R$599 (decoy caro). Mostrar
"R$478→R$199". Copy de perda ancorada no plano recém-gerado ("Não perca seu
plano de Hipertrofia"; "Sem Pro: volta ao genérico"). Framing de *manter*, não
*comprar*.

**Guardrails:** loading só com passos reais; sem contagem regressiva falsa; o
free-tier precisa ser realmente limitado para a copy ser honesta (senão =
dark pattern + reprovação App Review).

## Pré-requisitos de produto (senão é UX sobre vazio)
1. Personalização por regra real (goal/coorte → template certo).
2. Desafio-por-coorte no app (fecha o fosso).
3. StoreKit real (hoje stub).
