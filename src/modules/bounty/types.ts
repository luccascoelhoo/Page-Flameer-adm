export type RewardIcon =
  | "gamepad"
  | "pizza"
  | "film"
  | "shoppingbag"
  | "music"
  | "coffee"
  | "beer"
  | "gift";

/**
 * Condição de desbloqueio. Avaliada uma vez por dia.
 * - full_day: bater 100% dos hábitos do dia
 * - streak: atingir N dias seguidos de chama
 * - habits_done: completar um conjunto específico de hábitos no dia
 */
export type UnlockCondition =
  | { kind: "full_day" }
  | { kind: "streak"; days: number }
  | { kind: "habits_done"; habitIds: string[] };

export interface Reward {
  id: string;
  name: string;
  description?: string;
  icon: RewardIcon;
  color: string; // hsl(...)
  condition: UnlockCondition;
  cooldownDays: number; // dias entre desbloqueios
  active: boolean;
  createdAt: string;
}

export type VoucherStatus = "available" | "used";

export interface Voucher {
  id: string;
  rewardId: string;
  status: VoucherStatus;
  unlockedAt: string; // ISO
  unlockedDay: string; // YYYY-MM-DD (idempotência por dia)
  usedAt?: string;
}

export interface BountyState {
  rewards: Reward[];
  vouchers: Voucher[];
}