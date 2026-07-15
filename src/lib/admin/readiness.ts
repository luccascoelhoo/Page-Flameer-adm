/**
 * Flameer Readiness Engine — transparent 0–100 readiness score.
 *
 * Methodology (published sports science, not any vendor's proprietary code):
 *  - HRV: ln-transformed daily HRV compared as a z-score against the member's
 *    own 60-day baseline (Plews et al. rolling-baseline approach). Method-
 *    relative: works for SDNN (Apple) or RMSSD (most straps) because the
 *    z-score normalises scale — but the two are NEVER mixed in one series.
 *  - Resting HR: z-score vs 60-day baseline; elevated RHR = recovery/illness signal.
 *  - Sleep: quantity (TST vs need), continuity (efficiency vs 90%), and
 *    quality ((deep+REM) proportion of TST vs 45% reference).
 *  - Load: yesterday's session load vs the 28-day chronic daily mean
 *    (short-term recovery demand). The 7:28 ACWR is computed as a SOFT flag
 *    only (the ratio is contested in the literature — Lolli, Impellizzeri —
 *    so it never caps the score).
 *
 * Honesty rules:
 *  - < MIN_BASELINE_DAYS of cardio data → score is NULL (never 0): a new
 *    member must not top the at-risk list with a fabricated alarm.
 *  - Missing components renormalise the remaining weights and the result
 *    discloses exactly which weights were used (usedWeights).
 *
 * Pure module: no I/O, no React, fully deterministic → unit-testable, and
 * portable to Swift for on-device parity.
 */

export const READINESS_WEIGHTS = { hrv: 0.4, rhr: 0.2, sleep: 0.25, load: 0.15 } as const;
export const SLEEP_WEIGHTS = { quantity: 0.6, continuity: 0.2, quality: 0.2 } as const;
export const BASELINE_DAYS = 60;
export const CHRONIC_LOAD_DAYS = 28;
export const MIN_BASELINE_DAYS = 14;
export const DEFAULT_SLEEP_NEED_MIN = 480;
export const Z_CLAMP = 3;

export type ReadinessBand = 'green' | 'amber' | 'red';

export const BAND_THRESHOLDS = {
  default: { green: 67, amber: 34 },
  athlete: { green: 75, amber: 50 },
} as const;

export type ReadinessFlag =
  | 'illness_signal'
  | 'hrv_suppressed_7d'
  | 'acwr_spike'
  | 'insufficient_baseline'
  | 'no_hrv_data'
  | 'no_rhr_data'
  | 'no_sleep_data'
  | 'no_load_data'
  | 'no_data';

export interface DailyPoint {
  day: string; // 'YYYY-MM-DD', ascending
  hrv?: number | null; // ms
  hrvMethod?: 'sdnn' | 'rmssd' | null;
  restingHr?: number | null; // bpm
  sleepTotalMin?: number | null;
  timeInBedMin?: number | null;
  sleepDeepMin?: number | null;
  sleepRemMin?: number | null;
  srpeLoad?: number | null; // AU
}

export interface Baseline {
  mean: number;
  sd: number;
  n: number;
}

export interface ReadinessResult {
  score: number | null; // null = insufficient baseline (never fabricate)
  band: ReadinessBand | null;
  sub: { hrv: number | null; rhr: number | null; sleep: number | null; load: number | null };
  usedWeights: { hrv: number; rhr: number; sleep: number; load: number };
  zHrv: number | null;
  zRhr: number | null;
  acwr: number | null;
  flags: ReadinessFlag[];
  narrative: string;
}

// ── small helpers ───────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Guard against zero/near-zero variance (constant or quantized device values):
 *  a ~1e-16 sd from floating-point accumulation must not mint huge z-scores. */
const MIN_SD = 1e-6;

function meanSd(values: number[]): Baseline {
  const n = values.length;
  if (n === 0) return { mean: 0, sd: 0, n: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { mean, sd: 0, n };
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return { mean, sd, n };
}

/** Keep only the majority HRV method — SDNN and RMSSD are never comparable. */
export function dominantHrvSeries(history: DailyPoint[]): DailyPoint[] {
  const counts = new Map<string, number>();
  history.forEach((p) => {
    if (p.hrv != null && p.hrv > 0) {
      const m = p.hrvMethod ?? 'unknown';
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
  });
  if (counts.size <= 1) return history;
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return history.map((p) =>
    p.hrv != null && (p.hrvMethod ?? 'unknown') !== dominant ? { ...p, hrv: null } : p
  );
}

// ── baselines ───────────────────────────────────────────────────────────────

/** ln(HRV) baseline over up to the prior 60 days (excludes the last point). */
export function lnHrvBaseline(history: DailyPoint[]): Baseline {
  const prior = history.slice(0, -1).slice(-BASELINE_DAYS);
  const vals = prior.filter((p) => p.hrv != null && p.hrv > 0).map((p) => Math.log(p.hrv!));
  return meanSd(vals);
}

export function rhrBaseline(history: DailyPoint[]): Baseline {
  const prior = history.slice(0, -1).slice(-BASELINE_DAYS);
  const vals = prior.filter((p) => p.restingHr != null && p.restingHr! > 0).map((p) => p.restingHr!);
  return meanSd(vals);
}

/** 7-day rolling mean of ln(HRV) ending at the last point. */
export function rollingLnHrv7(history: DailyPoint[]): number | null {
  const window = history.slice(-7).filter((p) => p.hrv != null && p.hrv! > 0);
  if (window.length === 0) return null;
  return window.reduce((a, p) => a + Math.log(p.hrv!), 0) / window.length;
}

// ── sub-scores (0–100 or null when the input is absent) ─────────────────────

export function hrvSubScore(history: DailyPoint[]): { score: number | null; z: number | null } {
  const base = lnHrvBaseline(history);
  const roll = rollingLnHrv7(history);
  if (roll == null || base.n < MIN_BASELINE_DAYS || base.sd < MIN_SD) {
    return { score: null, z: null };
  }
  const z = clamp((roll - base.mean) / base.sd, -Z_CLAMP, Z_CLAMP);
  return { score: clamp(60 + 20 * z, 0, 100), z };
}

export function rhrSubScore(history: DailyPoint[]): { score: number | null; z: number | null } {
  const today = history[history.length - 1];
  if (!today || today.restingHr == null || today.restingHr <= 0) return { score: null, z: null };
  const base = rhrBaseline(history);
  if (base.n < MIN_BASELINE_DAYS || base.sd < MIN_SD) return { score: null, z: null };
  const z = clamp((today.restingHr - base.mean) / base.sd, -Z_CLAMP, Z_CLAMP);
  // Lower RHR than baseline = better recovery.
  return { score: clamp(60 - 20 * z, 0, 100), z };
}

export function sleepSubScore(
  today: DailyPoint | undefined,
  sleepNeedMin = DEFAULT_SLEEP_NEED_MIN
): number | null {
  if (!today || today.sleepTotalMin == null || today.sleepTotalMin <= 0) return null;
  const tst = today.sleepTotalMin;

  const quantity = Math.min(tst / sleepNeedMin, 1);

  let continuity = 1;
  if (today.timeInBedMin != null && today.timeInBedMin > 0) {
    const efficiency = tst / today.timeInBedMin;
    continuity = Math.min(efficiency / 0.9, 1);
  }

  let quality: number | null = null;
  if (today.sleepDeepMin != null && today.sleepRemMin != null) {
    // Proportion of restorative sleep vs ~45% reference — computed as a
    // FRACTION of TST (minutes/minutes), not raw minutes.
    const restorative = (today.sleepDeepMin + today.sleepRemMin) / tst;
    quality = Math.min(restorative / 0.45, 1);
  }

  const q = SLEEP_WEIGHTS.quantity * quantity + SLEEP_WEIGHTS.continuity * continuity;
  const total =
    quality != null
      ? q + SLEEP_WEIGHTS.quality * quality
      : // no stage data → renormalise quantity+continuity to full weight
        q / (SLEEP_WEIGHTS.quantity + SLEEP_WEIGHTS.continuity);

  return clamp(Math.round(total * 1000) / 10, 0, 100);
}

/** Acute (7d mean) : chronic (28d mean) daily-load ratio. Soft signal only. */
export function acwr(history: DailyPoint[]): number | null {
  const loads = history.slice(-CHRONIC_LOAD_DAYS).map((p) => p.srpeLoad ?? null);
  const valid = loads.filter((v): v is number => v != null);
  if (valid.length < 7) return null;
  const chronic = valid.reduce((a, b) => a + b, 0) / valid.length;
  if (chronic === 0) return null;
  const acute7 = history
    .slice(-7)
    .map((p) => p.srpeLoad ?? 0)
    .reduce((a, b) => a + b, 0) / 7;
  return Math.round((acute7 / chronic) * 100) / 100;
}

export function loadSubScore(history: DailyPoint[]): { score: number | null; acwr: number | null } {
  const ratio = acwr(history);
  const yesterday = history[history.length - 2];
  const chronicWindow = history
    .slice(-CHRONIC_LOAD_DAYS - 1, -1)
    .map((p) => p.srpeLoad)
    .filter((v): v is number => v != null);

  if (chronicWindow.length < 7 || !yesterday || yesterday.srpeLoad == null) {
    return { score: null, acwr: ratio };
  }
  const chronicMean = chronicWindow.reduce((a, b) => a + b, 0) / chronicWindow.length;
  if (chronicMean === 0) return { score: 100, acwr: ratio };

  // Short-term recovery demand: how much bigger than usual was yesterday?
  const r = yesterday.srpeLoad / chronicMean;
  const score = r <= 1 ? 100 : clamp(100 - 40 * (r - 1), 0, 100);
  return { score, acwr: ratio };
}

// ── composite ───────────────────────────────────────────────────────────────

export function bandFor(score: number, variant: keyof typeof BAND_THRESHOLDS = 'default'): ReadinessBand {
  const t = BAND_THRESHOLDS[variant];
  if (score >= t.green) return 'green';
  if (score >= t.amber) return 'amber';
  return 'red';
}

export function computeReadiness(
  historyRaw: DailyPoint[],
  opts?: { variant?: keyof typeof BAND_THRESHOLDS; sleepNeedMin?: number }
): ReadinessResult {
  const flags: ReadinessFlag[] = [];
  const empty: ReadinessResult = {
    score: null,
    band: null,
    sub: { hrv: null, rhr: null, sleep: null, load: null },
    usedWeights: { hrv: 0, rhr: 0, sleep: 0, load: 0 },
    zHrv: null,
    zRhr: null,
    acwr: null,
    flags: ['no_data'],
    narrative: 'Sem dados de wearable sincronizados.',
  };
  if (historyRaw.length === 0) return empty;

  const history = dominantHrvSeries([...historyRaw].sort((a, b) => (a.day < b.day ? -1 : 1)));
  const today = history[history.length - 1];

  const cardioDays = history
    .slice(-BASELINE_DAYS)
    .filter((p) => (p.hrv != null && p.hrv > 0) || (p.restingHr != null && p.restingHr > 0)).length;

  // Baseline gate: a member without history must NOT read as "maximally
  // unready" — return null and let the UI say "coletando linha de base".
  if (cardioDays < MIN_BASELINE_DAYS) {
    return {
      ...empty,
      flags: ['insufficient_baseline'],
      narrative: `Coletando linha de base (${cardioDays}/${MIN_BASELINE_DAYS} dias de dados cardíacos).`,
    };
  }

  const hrv = hrvSubScore(history);
  const rhr = rhrSubScore(history);
  const sleep = sleepSubScore(today, opts?.sleepNeedMin);
  const load = loadSubScore(history);

  if (hrv.score == null) flags.push('no_hrv_data');
  if (rhr.score == null) flags.push('no_rhr_data');
  if (sleep == null) flags.push('no_sleep_data');
  if (load.score == null) flags.push('no_load_data');

  // Disclosed reweighting over the components that actually have data.
  const parts: { key: keyof typeof READINESS_WEIGHTS; score: number | null }[] = [
    { key: 'hrv', score: hrv.score },
    { key: 'rhr', score: rhr.score },
    { key: 'sleep', score: sleep },
    { key: 'load', score: load.score },
  ];
  const available = parts.filter((p) => p.score != null);
  if (available.length === 0) {
    return { ...empty, flags: [...flags, 'no_data'] };
  }
  const weightSum = available.reduce((a, p) => a + READINESS_WEIGHTS[p.key], 0);
  const usedWeights = { hrv: 0, rhr: 0, sleep: 0, load: 0 };
  let score = 0;
  available.forEach((p) => {
    const w = READINESS_WEIGHTS[p.key] / weightSum;
    usedWeights[p.key] = Math.round(w * 1000) / 1000;
    score += w * (p.score as number);
  });
  score = Math.round(score * 10) / 10;

  let band = bandFor(score, opts?.variant ?? 'default');

  // Soft ACWR ramp flag — contested metric, never caps the score.
  if (load.acwr != null && load.acwr > 1.5) flags.push('acwr_spike');

  // Safety overrides (independent of the composite):
  // classic illness signature — RHR spiked AND HRV suppressed.
  if (rhr.z != null && hrv.z != null && rhr.z >= 2 && hrv.z <= -1.5) {
    flags.push('illness_signal');
    band = 'red';
  }
  // chronically suppressed HRV: every one of the last 7 readings below baseline mean.
  const base = lnHrvBaseline(history);
  if (base.n >= MIN_BASELINE_DAYS && base.sd >= MIN_SD) {
    const last7 = history.slice(-7).filter((p) => p.hrv != null && p.hrv > 0);
    // require a meaningfully-below-baseline reading (¼ SD), not a 1-ulp artifact
    const threshold = base.mean - Math.max(base.sd * 0.25, 1e-9);
    if (last7.length === 7 && last7.every((p) => Math.log(p.hrv!) < threshold)) {
      flags.push('hrv_suppressed_7d');
      if (band === 'green') band = 'amber';
    }
  }

  const result: ReadinessResult = {
    score,
    band,
    sub: { hrv: hrv.score, rhr: rhr.score, sleep, load: load.score },
    usedWeights,
    zHrv: hrv.z,
    zRhr: rhr.z,
    acwr: load.acwr,
    flags,
    narrative: '',
  };
  result.narrative = readinessNarrative(result);
  return result;
}

// ── presentation helpers ────────────────────────────────────────────────────

const fmt1 = (v: number) => v.toFixed(1).replace('.', ',');

export function readinessNarrative(r: ReadinessResult): string {
  if (r.score == null) return 'Linha de base insuficiente — sem pontuação.';
  const drivers: string[] = [];
  if (r.flags.includes('illness_signal')) {
    return `Sinal de possível doença: FC de repouso +${fmt1(r.zRhr ?? 0)} DP e HRV ${fmt1(r.zHrv ?? 0)} DP. Recomendar descanso e observar amanhã.`;
  }
  if (r.zHrv != null && r.zHrv <= -1) drivers.push(`HRV baixa (${fmt1(r.zHrv)} DP)`);
  if (r.zRhr != null && r.zRhr >= 1) drivers.push(`FC repouso elevada (+${fmt1(r.zRhr)} DP)`);
  if (r.sub.sleep != null && r.sub.sleep < 60) drivers.push('sono insuficiente');
  if (r.sub.load != null && r.sub.load < 60) drivers.push('carga alta ontem');
  if (r.flags.includes('acwr_spike')) drivers.push('rampa de carga acelerada (ACWR > 1,5)');
  if (r.flags.includes('hrv_suppressed_7d')) drivers.push('HRV suprimida há 7 dias');

  if (r.band === 'green') {
    return drivers.length === 0
      ? 'Recuperado — pronto para carga plena.'
      : `Pronto, mas observar: ${drivers.join(', ')}.`;
  }
  if (r.band === 'amber') {
    return drivers.length === 0
      ? 'Recuperação parcial — treino moderado.'
      : `Treino moderado: ${drivers.join(', ')}.`;
  }
  return drivers.length === 0
    ? 'Baixa prontidão — priorizar recuperação.'
    : `Priorizar recuperação: ${drivers.join(', ')}.`;
}

/** Discrete band colors (RAG) — semantic, aligned with the panel theme. */
export function bandColor(band: ReadinessBand | null): string {
  switch (band) {
    case 'green':
      return 'hsl(142 50% 45%)'; // --success
    case 'amber':
      return '#D9A521';
    case 'red':
      return 'hsl(345 85% 55%)'; // --destructive
    default:
      return 'hsl(240 5% 65%)'; // muted
  }
}

export const BAND_LABEL: Record<ReadinessBand, string> = {
  green: 'Pronto',
  amber: 'Monitorar',
  red: 'Descanso',
};
