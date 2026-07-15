# Flameer — Contrato de Sincronização HealthKit → Supabase

Contrato que o app iOS (`/Flameer`, SwiftUI) deve implementar para alimentar o
board **Saúde e Prontidão** do painel web. As tabelas e RPCs já existem nas
migrações `20260714110000..2` deste repositório.

## Estado da implementação (julho/2026) — ✅ IMPLEMENTADO no app

- `Flameer.entitlements` tem `com.apple.developer.healthkit` e
  `healthkit.background-delivery` = true.
- As usage strings `NSHealthShareUsageDescription`/`Update` **já são injetadas
  pelo XcodeGen** via `project.yml` (`INFOPLIST_KEY_*`) — não editar o
  `Info.plist` na mão; o projeto é regenerado por `xcodegen generate`.
- Implementação real (substituiu os mocks):
  - `Flameer/Core/Servicos/HealthKitSyncService.swift` — queries reais
    (HKStatisticsQuery/HKSampleQuery), consentimento, backfill 30d, observer
    queries + background delivery diário, upserts nas 3 tabelas.
  - `Flameer/Core/Modelos/HealthSyncDTOs.swift` — DTOs do contrato.
  - `Flameer/Telas/5_Perfil/Componentes/HealthPrivacyView.swift` — tela de
    consentimento (Configurações → Privacidade → Saúde e wearables).
  - `BioFeedbackEngine.swift` — agora usa HRV/sono reais; sem dados → score 0
    e `volumeAdjustment` neutro (nunca inventa números).

### Decisões da v1 (documentadas)
- **Carga (`srpe_load`)**: sem `workoutEffortScore`, deriva-se intensidade
  1–10 da FC média do treino (`clamp((avgHR−90)/12, 1, 10)`) × minutos;
  sem FC, intensidade 4. Transparente e substituível quando o effort score
  for adotado.
- **Temperatura de pulso**: NÃO enviada na v1 (proxy de ciclo — sensível).
- **Sono**: janela 18h véspera → 18h do dia; `external_uuid` sintético
  estável `"<user>-sleep-<day>"` (uma sessão por noite, upsert idempotente).
- **`readiness_score`**: o app não grava; o painel calcula (fonte de verdade).

## Consentimento (obrigatório, em duas etapas)

1. Autorização do HealthKit (dialog do iOS).
2. Tela de consentimento do Flameer gravando em `user_health_consent`:
   - `share_with_coach` — visibilidade nominal para **toda a equipe** admin/professional (não é por coach individual — deixar claro no texto).
   - `share_sensitive` — dados de ciclo/clínicos **e** temperatura de pulso (proxy de ciclo).
   - `allow_cohort_anon` — inclusão em agregados anônimos.
   - Todos `false` por padrão. Revogação = `revoked_at = now()` (o painel some com o membro imediatamente).

## Tipos a autorizar (leitura)

`restingHeartRate`, `heartRateVariabilitySDNN`, `heartRateRecoveryOneMinute`,
`vo2Max`, `respiratoryRate`, `oxygenSaturation`, `appleSleepingWristTemperature`,
`stepCount`, `distanceWalkingRunning`, `activeEnergyBurned`, `basalEnergyBurned`,
`appleExerciseTime`, `appleStandTime`, `flightsClimbed`, `bodyMass`,
`bodyFatPercentage`, `leanBodyMass`, `height`,
`HKCategoryTypeIdentifier.sleepAnalysis`, `HKObjectType.workoutType()`.

`menstrualFlow`: pedir **separadamente** e só se o usuário ativar
`share_sensitive`; gravar apenas via RPC `encrypt_sensitive_health` (nunca em
claro, nunca nas tabelas normais).

## Upsert diário — `user_health_daily`

- **Conflito:** `onConflict: "user_id,day"`.
- **Cadência:** 1×/dia via `HKObserverQuery` + `enableBackgroundDelivery(.daily)`
  + catch-up em foreground. Backfill de 30 dias na primeira autorização.
- **Regras:**
  - `day` = dia-calendário **local** do aparelho; enviar `tz` (IANA).
  - **Omitir chaves sem dado** — nunca enviar `0` para "sem leitura".
  - `hrv_method` = `"sdnn"` (Apple). Nunca misturar com RMSSD de outras fontes.
  - Uma fonte autoritativa por métrica (preferir Apple Watch para FC/energia);
    nunca somar passos/energia de fontes sobrepostas.
  - `srpe_load` (carga da sessão): `workoutEffortScore (1–10, iOS 18) × duração_min`;
    sem effort score, usar TRIMP simplificado por FC média, ou omitir.

```json
{
  "user_id": "<auth.uid>",
  "day": "2026-07-14",
  "tz": "America/Sao_Paulo",
  "resting_hr": 52.0,
  "hrv": 41.3,
  "hrv_method": "sdnn",
  "vo2max": 47.2,
  "respiratory_rate": 14.1,
  "spo2": 0.972,
  "steps": 8432,
  "distance_m": 6120.5,
  "active_energy_kcal": 640.0,
  "basal_energy_kcal": 1680.0,
  "exercise_minutes": 42,
  "flights_climbed": 11,
  "sleep_total_min": 402,
  "time_in_bed_min": 455,
  "sleep_efficiency": 0.883,
  "sleep_awake_min": 24,
  "sleep_core_min": 210,
  "sleep_deep_min": 78,
  "sleep_rem_min": 90,
  "srpe_load": 315.0,
  "primary_source": "apple_health",
  "sources": ["apple_health"],
  "synced_at": "2026-07-14T09:05:00Z"
}
```

`wrist_temp_dev` só deve ser enviado se `share_sensitive` estiver ativo (o
painel também o oculta no servidor sem esse consentimento).

## Demais tabelas

| Tabela | Conflito | Conteúdo |
|---|---|---|
| `user_sleep_sessions` | `external_uuid` (UUID do HKSample) | sessão principal + `segments` `[{stage,start,end}]` para hipnograma |
| `user_hk_workouts` | `external_uuid` | cada `HKWorkout`: `activity_type` canônico + `hk_activity_raw`, duração, kcal, distância, `avg_hr`/`max_hr` via `statistics(for:)`, `effort_score` |
| `user_health_samples` | `onConflict: "user_id,metric,measured_at,source"` | pontos esparsos (HRV noturna, RHR) p/ baseline; enviar `source_bundle` e `method` |

## Snippet representativo (Swift)

```swift
struct DBHealthDailyInput: Encodable {
    let user_id: String
    let day: String            // "YYYY-MM-DD" no fuso local
    let tz: String
    var resting_hr: Double?
    var hrv: Double?
    var hrv_method: String?    // "sdnn"
    var sleep_total_min: Int?
    var sleep_deep_min: Int?
    var sleep_rem_min: Int?
    var active_energy_kcal: Double?
    var steps: Int?
    var vo2max: Double?
    var srpe_load: Double?
    let primary_source = "apple_health"
    let sources = ["apple_health"]
    let synced_at: String      // ISO8601
    // ... demais colunas opcionais de user_health_daily; nil → omitido
}

try await supabase
    .from("user_health_daily")
    .upsert(payload, onConflict: "user_id,day")
    .execute()
```

## Paridade do score — ✅ implementada

O motor foi portado 1:1 para Swift em
`Flameer/Core/Servicos/ReadinessEngine.swift`, com **paridade numérica
verificada** contra `src/lib/admin/readiness.ts` (mesmos casos sintéticos:
72,2/verde · 39,3/vermelho+doença · ACWR 1,93 · pesos renormalizados
0,471/0,235/0,294 · score nulo p/ linha de base insuficiente).

Fluxo: após cada sync, `HealthKitSyncService.refreshReadiness()` lê os 60
dias de `user_health_daily`, computa o score e **grava o cache**
(`readiness_score/band/flags`) na linha mais recente — as RPCs de
distribuição/tendência do painel leem essa coluna. O `BioFeedbackEngine`
usa o motor completo quando há histórico e cai no composto simples
(HRV 60%/Sono 40%) enquanto a linha de base é construída. O painel continua
recalculando do zero — o cache do device alimenta agregados, não substitui
a verdade.
