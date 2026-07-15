/**
 * Shared chart theming so every visualisation in the Intelligence Center reads
 * as one system. Colours are CSS-variable based where possible so charts adapt
 * to light/dark automatically; the categorical ramp is a fixed burgundy-anchored
 * palette tuned to the Flameer identity.
 */

export const CHART_COLORS = {
  primary: 'hsl(346 57% 32%)', // burgundy
  tan: '#C89B6A',
  gold: '#D9A521',
  slate: '#6E7F8D',
  teal: '#3F7A6A',
  rose: '#A45D63',
  indigo: '#5B6BA8',
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

/** Sequential burgundy ramp for heatmaps (light → dark). Index 0 = coldest. */
export const HEAT_RAMP: string[] = [
  'hsl(40 30% 92%)',
  'hsl(346 40% 82%)',
  'hsl(346 48% 66%)',
  'hsl(346 55% 50%)',
  'hsl(346 60% 38%)',
  'hsl(346 65% 27%)',
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
