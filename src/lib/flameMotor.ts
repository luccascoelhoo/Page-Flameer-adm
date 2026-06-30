// Flame Motor — Streak reward engine (pure mock logic, no backend)

export type FlameState = "ativa" | "tregua" | "extinta" | "normal";

export interface FlameMilestone {
  name: string;
  days: number;
  emoji: string;
  color: string;
}

export const MILESTONES: FlameMilestone[] = [
  { name: "Bronze", days: 7, emoji: "🥉", color: "hsl(30, 60%, 50%)" },
  { name: "Prata", days: 21, emoji: "🥈", color: "hsl(210, 20%, 70%)" },
  { name: "Ouro", days: 63, emoji: "🥇", color: "hsl(45, 90%, 55%)" },
  { name: "Diamante", days: 365, emoji: "💎", color: "hsl(200, 80%, 60%)" },
];

export function getFlameIntensity(streak: number): number {
  if (streak >= 63) return 1;
  if (streak >= 21) return 0.8;
  if (streak >= 7) return 0.6;
  if (streak >= 3) return 0.4;
  return 0.2;
}

export function getCurrentMilestone(streak: number): FlameMilestone | null {
  const earned = MILESTONES.filter((m) => streak >= m.days);
  return earned.length > 0 ? earned[earned.length - 1] : null;
}

export function getNextMilestone(streak: number): { milestone: FlameMilestone; daysLeft: number } | null {
  const next = MILESTONES.find((m) => streak < m.days);
  if (!next) return null;
  return { milestone: next, daysLeft: next.days - streak };
}

export function getFlameState(streak: number, completedToday: boolean): FlameState {
  if (streak === 0) return "extinta";
  if (streak < 3) return "normal";
  if (!completedToday && streak > 0) return "tregua";
  return "ativa";
}
