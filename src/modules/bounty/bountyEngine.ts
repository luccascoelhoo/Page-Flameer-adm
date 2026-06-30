import type { Reward, UnlockCondition, BountyState, Voucher } from "./types";

export const todayKey = (): string => new Date().toISOString().slice(0, 10);

export interface EvalContext {
  doneHabitIds: string[];
  habitsTotal: number;
  streak: number;
  day?: string;
}

export const isConditionMet = (
  cond: UnlockCondition,
  ctx: EvalContext,
): boolean => {
  switch (cond.kind) {
    case "full_day":
      return ctx.habitsTotal > 0 && ctx.doneHabitIds.length >= ctx.habitsTotal;
    case "streak":
      return ctx.streak >= cond.days;
    case "habits_done":
      return cond.habitIds.length > 0
        && cond.habitIds.every((id) => ctx.doneHabitIds.includes(id));
  }
};

export const describeCondition = (cond: UnlockCondition): string => {
  switch (cond.kind) {
    case "full_day": return "Quando bater o dia 100%";
    case "streak": return `A cada ${cond.days} dias seguidos de chama`;
    case "habits_done":
      return cond.habitIds.length === 1
        ? "Ao completar 1 hábito específico"
        : `Ao completar ${cond.habitIds.length} hábitos específicos`;
  }
};

const lastUnlockOf = (state: BountyState, rewardId: string): Voucher | undefined =>
  state.vouchers
    .filter((v) => v.rewardId === rewardId)
    .sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt))[0];

const inCooldown = (reward: Reward, last?: Voucher): boolean => {
  if (!last || reward.cooldownDays <= 0) return false;
  const diffDays =
    (Date.now() - new Date(last.unlockedAt).getTime()) / (1000 * 60 * 60 * 24);
  return diffDays < reward.cooldownDays;
};

/**
 * Avalia todas as recompensas ativas. Cria 1 voucher por recompensa
 * elegível por dia (idempotente: não duplica no mesmo dia).
 */
export const evaluate = (
  state: BountyState,
  ctx: EvalContext,
): { state: BountyState; newVouchers: Voucher[] } => {
  const day = ctx.day ?? todayKey();
  const newVouchers: Voucher[] = [];

  for (const reward of state.rewards) {
    if (!reward.active) continue;
    // já tem voucher dessa recompensa hoje?
    const alreadyToday = state.vouchers.some(
      (v) => v.rewardId === reward.id && v.unlockedDay === day,
    );
    if (alreadyToday) continue;
    if (inCooldown(reward, lastUnlockOf(state, reward.id))) continue;
    if (!isConditionMet(reward.condition, ctx)) continue;

    newVouchers.push({
      id: crypto.randomUUID(),
      rewardId: reward.id,
      status: "available",
      unlockedAt: new Date().toISOString(),
      unlockedDay: day,
    });
  }

  if (newVouchers.length === 0) return { state, newVouchers };
  return {
    state: { ...state, vouchers: [...state.vouchers, ...newVouchers] },
    newVouchers,
  };
};

export const useVoucher = (state: BountyState, voucherId: string): BountyState => ({
  ...state,
  vouchers: state.vouchers.map((v) =>
    v.id === voucherId
      ? { ...v, status: "used", usedAt: new Date().toISOString() }
      : v,
  ),
});
