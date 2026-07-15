/**
 * Morning briefing builder — turns the roster's readiness rows into the
 * coach's daily summary. Strictly derived from real rows: members without a
 * score are listed as "collecting baseline", never ranked as at-risk.
 */

import type { ReadinessBand, ReadinessResult } from './readiness';

export interface RosterRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  readiness: ReadinessResult;
  lastDay: string | null; // last day with data
}

export interface BriefingItem {
  userId: string;
  name: string;
  band: ReadinessBand;
  score: number;
  drivers: string;
}

export interface Briefing {
  headline: string;
  cohortLine: string;
  atRisk: BriefingItem[]; // worst-first, red then amber
  collecting: number; // members still building a baseline
}

export function buildBriefing(rows: RosterRow[], topN = 8): Briefing {
  const scored = rows.filter((r) => r.readiness.score != null && r.readiness.band != null);
  const collecting = rows.length - scored.length;

  const atRisk = scored
    .filter((r) => r.readiness.band !== 'green')
    .sort((a, b) => (a.readiness.score! - b.readiness.score!))
    .slice(0, topN)
    .map((r) => ({
      userId: r.userId,
      name: r.name,
      band: r.readiness.band as ReadinessBand,
      score: r.readiness.score as number,
      drivers: r.readiness.narrative,
    }));

  const avg =
    scored.length > 0
      ? Math.round((scored.reduce((a, r) => a + (r.readiness.score as number), 0) / scored.length) * 10) / 10
      : null;

  const headline =
    scored.length === 0
      ? 'Nenhum membro com pontuação de prontidão ainda.'
      : atRisk.length === 0
      ? `Nenhum membro em risco hoje — ${scored.length} monitorados.`
      : `${atRisk.length} de ${scored.length} membros precisam de atenção hoje.`;

  const cohortLine =
    avg == null
      ? 'Prontidão média indisponível.'
      : `Prontidão média da coorte: ${String(avg).replace('.', ',')}.`;

  return { headline, cohortLine, atRisk, collecting };
}
