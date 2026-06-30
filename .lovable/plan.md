# Plano — Área de Membros / Desafios

Reformular `/desafio` para transformá-la no hub de **Desafios** (não mais cursos genéricos), com duas camadas claras: **Públicos Premium** (curados, em destaque na aba) e **Privados por Link** (criados por qualquer usuário, acessíveis só via busca de link/código).

---

## 1. Modelo de dados (mock, em memória)

Criar `src/modules/challenges/types.ts`:

```ts
type ChallengeVisibility = "public" | "private";
type ChallengeTier = "admin" | "influencer" | "premium_user" | "friend";

type Challenge = {
  id: string;
  code: string;              // ex: "FIT-9X2K" — usado para link/busca
  title: string;
  subtitle: string;
  cover: string;
  category: "Treino" | "Nutrição" | "Recovery" | "Mente";
  visibility: ChallengeVisibility;
  tier: ChallengeTier;
  featured?: boolean;        // destaque visual
  prize?: string;            // "R$ 500" | "Kit suplementos" | undefined
  durationDays: number;
  participants: number;
  startsAt: string;
  hostName: string;          // "Equipe Flameer" | "@nomeinflu" | "Você"
  hostAvatar?: string;
  joined?: boolean;
};
```

Mock inicial em `src/modules/challenges/mockChallenges.ts` com:
- 2 desafios **admin** (criados por nós) com `featured: true` e premiação
- 2 desafios **influencer** públicos com prêmios
- 1 desafio **premium_user** público
- (Privados aparecem só após "entrar via link")

Estado global simples via hook `useChallenges()` em `localStorage` (`challenges:v1`) — sem backend, alinhado ao padrão do módulo Bounty.

---

## 2. Reformulação da página `/desafio`

Renomear conceitualmente de "Cursos" → "Desafios". Substituir conteúdo de `src/pages/Desafio.tsx`.

### Estrutura visual (mobile-first, viewport ~390px)

```text
┌─────────────────────────────────────┐
│ ÁREA DE MEMBROS                     │
│ Desafios 🏆               [🔍]      │
├─────────────────────────────────────┤
│ HERO destaque (featured admin)      │
│ ┌──────────────────────────────┐    │
│ │ 🏅 PRÊMIO · R$ 500           │    │
│ │ Verão Insano 2026            │    │
│ │ 30 dias · 1.245 atletas      │    │
│ │ [Participar]                 │    │
│ └──────────────────────────────┘    │
├─────────────────────────────────────┤
│ Filtros: Tudo · Admin · Influencer  │
│         · Premium · Com prêmio      │
├─────────────────────────────────────┤
│ EM DESTAQUE ✨                       │
│ Carrossel horizontal de cards       │
├─────────────────────────────────────┤
│ TODOS OS DESAFIOS PÚBLICOS          │
│ Grid 2 col com badge de tier        │
└─────────────────────────────────────┘
                                  ┌──┐
                                  │ +│ ← FAB
                                  └──┘
```

### Componentes novos em `src/modules/challenges/components/`

- `ChallengeHeroCard.tsx` — destaque grande do desafio em evidência
- `ChallengeCard.tsx` — card de grid com badge de tier (Admin/Influencer/Premium), badge de prêmio, contador de participantes
- `TierBadge.tsx` — pílula colorida: Admin (gradiente primary), Influencer (gradiente roxo→rosa), Premium (gold)
- `PrizeBadge.tsx` — chip com ícone Trophy + valor do prêmio
- `FeaturedCarousel.tsx` — scroll horizontal dos `featured`

---

## 3. FAB "+" — Criar / Buscar desafio privado

`src/modules/challenges/components/CreateChallengeFAB.tsx`:

- Botão circular fixo `bottom-24 right-4` (acima do BottomNav), 56x56, gradiente primary, `Plus` icon, sombra elegante, animação `whileTap scale 0.92`
- Ao clicar abre **bottom sheet** (`Drawer` do shadcn) com 2 abas:

### Aba "Criar desafio com amigos"
- Inputs: título, descrição, duração (slider 7/14/30/90 dias), categoria
- Toggle "Com prêmio simbólico" (texto livre)
- Botão **"Gerar link"** → cria `Challenge` com `visibility: "private"`, gera `code` aleatório (ex: `FIT-9X2K`)
- Tela de sucesso: mostra link `flameer.app/c/FIT-9X2K`, botões **Copiar** e **Compartilhar** (Web Share API)

### Aba "Entrar via link"
- Input grande: cole link ou código
- Botão **Buscar** → procura no mock pelo `code`; se achar, mostra preview do desafio + **Entrar**; se não, estado vazio "Desafio não encontrado"
- Após entrar, o desafio privado aparece numa seção **"Meus desafios privados"** no topo da página (só visível se houver pelo menos 1)

---

## 4. Busca (ícone 🔍 do header)

Hoje só decorativo. Transformar em sheet de busca:
- Input com placeholder "Buscar por nome, link ou código…"
- Resultados: filtra públicos por título e privados por `code` exato
- Permite colar link completo (extrai o código com regex)

---

## 5. Comunidade (ajuste pequeno)

A aba `/comunidade` já existe e é aberta. **Não mexer na lógica**, apenas garantir que continue acessível a todos (verificar header/textos). Caso a copy atual sugira gating, ajustar para "Aberto a todos os atletas".

---

## 6. Detalhes técnicos

- Usar `framer-motion` para hero, carrossel e FAB (pattern já presente)
- Tokens: `bg-primary`, `bg-card`, `border-border/60`, `bento-card`, `rounded-3xl`
- Cores de tier via classes utilitárias derivadas de tokens (sem cores hardcoded)
- FAB respeita `pb-24` do `BottomNav`
- Persistência: `localStorage` `challenges:v1` (lista) e `challenges:joined:v1` (códigos privados que o usuário entrou)
- Geração de código: `crypto.getRandomValues` → 4 letras + 4 alfanum
- Web Share API com fallback para `navigator.clipboard`
- Sem mudanças de backend / Supabase nesta etapa

---

## 7. Arquivos

**Novos:**
- `src/modules/challenges/types.ts`
- `src/modules/challenges/mockChallenges.ts`
- `src/modules/challenges/useChallenges.tsx`
- `src/modules/challenges/utils.ts` (gerar código, parsear link)
- `src/modules/challenges/components/ChallengeHeroCard.tsx`
- `src/modules/challenges/components/ChallengeCard.tsx`
- `src/modules/challenges/components/TierBadge.tsx`
- `src/modules/challenges/components/PrizeBadge.tsx`
- `src/modules/challenges/components/FeaturedCarousel.tsx`
- `src/modules/challenges/components/CreateChallengeFAB.tsx`
- `src/modules/challenges/components/CreateChallengeSheet.tsx`
- `src/modules/challenges/components/SearchChallengeSheet.tsx`

**Editados:**
- `src/pages/Desafio.tsx` (rewrite completo, removendo cursos/módulos/aulas)

**Não mexidos:** `BottomNav`, `Comunidade`, módulo Bounty, Onboarding.

---

## 8. Fora de escopo (confirmar depois)

- Tela de detalhe interno do desafio (ranking, check-ins diários) — manter por ora um modal simples "Você entrou!"
- Gating real de "premium user" cria desafio público — por ora qualquer um pode criar privado; públicos só pelo mock
- Backend / persistência multi-device