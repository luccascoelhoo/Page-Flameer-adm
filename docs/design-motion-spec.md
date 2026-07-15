# Flameer — Análise UX/IxD e Especificação de Motion (produção)

*Análise do briefing "Fable 5 Engine / Diretor de Arte" + tradução para a stack
real do produto, por quem auditou os dois códigos-fonte.*

---

## 1. Análise crítica do briefing (o que aproveitar, o que corrigir)

### ✅ O que o briefing acerta
- Identidade coerente (burgundy/champagne, minimalismo de engenharia) — já é a
  direção do app e do painel.
- Física de mola em vez de easings lineares — correto; os números propostos
  (damping 26 / stiffness 170) são bons e **já foram adotados** na
  `ReadinessDetailView` como implementação de referência.
- Formato de entrega com specs técnicas (duração/curvas/camadas/código) — mantido abaixo.

### ⚠️ Correções necessárias antes de implementar

**1. Stack errada.** O briefing pede React Native Reanimated / Lottie / Fable.
O Flameer é **SwiftUI nativo (Swift 6, iOS 18)**. Tudo abaixo está especificado
em SwiftUI (`spring`, `Canvas`, `TimelineView`, `keyframeAnimator`), que entrega
os 120Hz ProMotion nativamente — sem bridge JS.

**2. Paleta divergente.** O briefing pede `#4A0E17`; os tokens reais do produto
são `#6B1D2F` (burgundy) e `#F7F4EF` (off-white) nos DOIS códigos. Trocar a cor
primária agora tem custo alto (painel + app + assets). Recomendação: **manter
`#6B1D2F`** e adicionar `#E8DCC4` (champagne) como token de acento/celebração —
ganho estético do briefing sem retrabalho de marca.

**3. Long-press para "Marcar como Feito" é anti-hábito.** A psicologia de
formação de hábito (Fogg, Duhigg) manda **reduzir fricção na ação-alvo**, não
adicioná-la. Long-press é para ações destrutivas/irreversíveis. Recomendação:
**tap imediato + celebração rica depois** — a dopamina vem da recompensa
(partículas/selo), não do esforço de segurar. Long-press fica para *desfazer*
conclusão.

**4. "Calculation Engine" fake.** A "labor illusion" funciona (pesquisa
Buell/Norton), mas: (a) nós **temos** cálculo real agora — HealthKit, TMB,
prontidão; usar mensagens verdadeiras do pipeline, não teatro; (b) cap de
**2,5s** — acima disso a ilusão vira irritação; (c) nunca travar em 85% se não
há trabalho real acontecendo.

**5. Lemniscata/Fibonacci vs legibilidade.** Anéis concêntricos venceram porque
comunicam % **instantaneamente**. Uma curva contínua elegante perde leitura de
progresso. Compromisso especificado abaixo: **"Fluxo de Energia"** — três arcos
espirais independentes que se fundem visualmente ao completar, mantendo leitura
de fração por arco.

**6. Acessibilidade é bloqueador de produção, não detalhe.** Auditoria real:
o app **nunca tratava `Reduce Motion`** (0 ocorrências — agora 1, na tela de
prontidão). Toda spec abaixo tem a variante reduzida obrigatória. Metaball/
partículas: máx. 24 partículas, `TimelineView` pausado fora de tela, nada de
loop infinito (bateria).

---

## 2. Especificações de componentes (SwiftUI, prontos para implementar)

> Tokens: `burgundy = Color(hex: 0x6B1D2F)` · `champagne = Color(hex: 0xE8DCC4)`
> · hairline = `1 / displayScale`.

### A. "Fluxo de Energia" (substituto dos anéis)

**Conceito/psicologia:** três arcos espirais (Movimento/Nutrição/Hidratação)
com raios decrescentes e gap de 12°, preenchendo em gradiente
burgundy→champagne. Ao completar os três, um pulso único de luz percorre a
espiral inteira (momento "fechou o dia"). Diferencia da Apple sem sacrificar a
leitura de fração.

**Motion:**
| Propriedade | Valor |
|---|---|
| Preenchimento (trim) | `.spring(response: 0.55, dampingFraction: 0.82)` por mudança de meta |
| Pulso de conclusão | 900 ms, `cubic-bezier(0.16, 1, 0.3, 1)` (easeOutExpo), opacidade 0→0.9→0 |
| Fusão dos arcos | crossfade de 300 ms do gap de 12° → 0° |
| Reduce Motion | trim sem animação; pulso substituído por mudança de opacidade 200 ms |

**Camadas:** 1-trilho (champagne 20%, hairline) · 2-progresso (gradiente,
`lineCap: .round`) · 3-pulso (blur 6, `blendMode(.screen)`) · 4-rótulos.

```swift
struct EnergyFlowArc: View {
    let progress: Double   // 0...1
    let radius: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Circle().trim(from: 0, to: 0.97)
                .stroke(Color.champagne.opacity(0.2), lineWidth: 1)
            Circle().trim(from: 0, to: progress * 0.97)
                .stroke(
                    AngularGradient(colors: [.burgundy, .champagne],
                                    center: .center),
                    style: StrokeStyle(lineWidth: 5, lineCap: .round))
                .animation(reduceMotion ? nil :
                    .spring(response: 0.55, dampingFraction: 0.82),
                    value: progress)
        }
        .rotationEffect(.degrees(-90))
        .frame(width: radius * 2, height: radius * 2)
    }
}
```

### B. Onboarding ritual + barra de cálculo real

**Motion das transições:** exatamente os números do briefing —
`.interpolatingSpring(stiffness: 170, damping: 26)`; textos entram com
`opacity 0→1` + `offset(y: 15→0)`, stagger de 60 ms por elemento
(`.transition(.opacity.combined(with: .offset(y: 15)))`).

**Barra de cálculo (honesta):** hairline burgundy sobre trilho champagne;
etapas com progresso **assíncrono real**: "Calculando TMB…" (cálculo real,
`metabolism`), "Definindo metas de macros…", "Preparando linha de base de
prontidão…". Curva percebida: 0→70% em 900 ms (easeOut), 70→92% em 1.100 ms
(linear lento), 92→100% em 300 ms (`spring bounce 0.25`) **disparada pela
conclusão real das tarefas**. Cap total 2,5 s; Reduce Motion → barra
determinística linear.

### C. "Marcar como Feito" + selo 2QP

**Interação (corrigida do briefing):**
1. Tap: `scale 1→0.96` em 80 ms (pressionado), solta com
   `.spring(response: 0.3, dampingFraction: 0.6)` + haptic `.rigid`.
2. Check desenha-se via `trim(from:to:)` — 350 ms, easeOutExpo.
3. **12–24 partículas champagne** (Canvas + `TimelineView(.animation)`):
   velocidade inicial radial 40–90 pt/s, gravidade −30 pt/s², vida 600–900 ms,
   `opacity` easeOut até 0. Encerra o `TimelineView` ao fim (bateria).
4. Reduce Motion: sem partículas — flash de opacidade no anel (150 ms) + haptic.

**Selo/monograma (marco semanal, não diário):** monograma "2QP/Flameer" em
traço hairline que se auto-desenha (`trim` 0→1, 1.200 ms, easeInOutCubic) com
`shimmer` de gradiente metálico passando 1× (800 ms). Reservar para marcos
(7/30 dias de ofensiva) — usar diariamente mata o prestígio que o briefing quer.

---

## 3. Checklist de produção (auditado em 15/07/2026)

| Item | Estado | Ação |
|---|---|---|
| `PrivacyInfo.xcprivacy` | ✅ existe (`Flameer/Resources/`) | conferir reason codes de UserDefaults + declarar tipos de dados de saúde coletados |
| Reduce Motion | 🔴 ausente no app inteiro (1 tela corrigida) | aplicar variantes desta spec ao implementar animações |
| Consentimento saúde (App Review 5.1.3) | ✅ duas etapas implementadas | garantir URL de política de privacidade cobrindo HealthKit na ficha da App Store |
| Usage strings HealthKit | ✅ via project.yml | — |
| Versão/build | ✅ 1.0.0 (1) | — |
| Segredos | ⚠️ placeholders se `Secrets.xcconfig` ausente | garantir injeção no CI/arquivo antes do archive |
| Testes | 🔴 zero targets de teste | mínimo: target com os 6 casos do ReadinessEngine (harness pronto no histórico da sessão) |
| Localização | ⚠️ strings pt-BR hardcoded | ok para lançamento BR; extrair para catálogo se for internacionalizar |
| Painel web | ✅ typecheck+build; RPCs corrigidas na `20260715090000` | aplicar migrações |

**Como usar esta spec:** os componentes A/B/C são standalone — quando as telas
em WIP (InicioView, BattleModeView) estabilizarem, cada um entra com
`EnergyFlowArc(progress:)` / um `ViewModifier` de transição / um botão. Não
alterei essas telas para não conflitar com o trabalho em andamento.
