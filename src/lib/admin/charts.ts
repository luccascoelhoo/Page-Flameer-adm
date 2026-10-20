/**
 * Shared chart theming so every visualisation in the Intelligence Center reads
 * as one system. Colours are CSS-variable based where possible so charts adapt
 * to light/dark automatically; the categorical ramp is a fixed burgundy-anchored
 * palette tuned to the Flameer identity.
 */

// SALA DE CONTROLE (17/08): paleta calibrada para o grafite dark-first —
// o laranja Flameer lidera; as demais são séries frias de luminância média,
// legíveis sobre escuro E sobre claro (o tema light é secundário).
export const CHART_COLORS = {
  primary: 'hsl(25 100% 50%)', // laranja Flameer
  tan: '#D9A05B',
  gold: '#E8B931',
  slate: '#8A9BAC',
  teal: '#4FA08A',
  rose: '#C57783',
  indigo: '#7C8BD0',
} as const;

/** Ordered categorical ramp for pies / multi-series charts. */
export const CATEGORICAL: string[] = [
  CHART_COLORS.primary,
  CHART_COLORS.tan,
  CHART_COLORS.teal,
  CHART_COLORS.gold,
  CHART_COLORS.slate,
  CHART_COLORS.rose,
  CHART_COLORS.indigo,
];

/** Rampa sequencial de calor: superfície apagada → laranja aceso (a chama).
    Index 0 = mais frio. Funciona sobre o grafite do tema principal. */
export const HEAT_RAMP: string[] = [
  'hsl(220 7% 14%)',
  'hsl(25 45% 22%)',
  'hsl(25 70% 30%)',
  'hsl(25 90% 40%)',
  'hsl(25 100% 50%)',
  'hsl(35 100% 60%)',
];

/** Map a 0..1 intensity onto the heat ramp. */
export function heatColor(intensity: number): string {
  if (!Number.isFinite(intensity) || intensity <= 0) return HEAT_RAMP[0];
  const idx = Math.min(
    HEAT_RAMP.length - 1,
    Math.round(intensity * (HEAT_RAMP.length - 1))
  );
  return HEAT_RAMP[idx];
}

export const tooltipStyle = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '10px',
  fontSize: '11px',
  color: 'hsl(var(--popover-foreground))',
  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
} as const;

export const axisStyle = {
  stroke: 'hsl(var(--muted-foreground))',
  fontSize: 10,
} as const;
