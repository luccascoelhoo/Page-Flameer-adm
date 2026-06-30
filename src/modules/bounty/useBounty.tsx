import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { evaluate, useVoucher as useVoucherFn, EvalContext } from "./bountyEngine";
import type { BountyState, Reward, RewardIcon, UnlockCondition, Voucher } from "./types";

const STORAGE_KEY = "flameer_bounty_v2";

const seed: BountyState = {
  rewards: [
    {
      id: "seed-cs2",
      name: "Jogar CS2 por 2h",
      description: "Sem culpa. Você merece.",
      icon: "gamepad",
      color: "hsl(27, 100%, 50%)",
      condition: { kind: "full_day" },
      cooldownDays: 0,
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "seed-pizza",
      name: "Pizza no fim de semana",
      description: "Cheat meal autorizado.",
      icon: "pizza",
      color: "hsl(0, 80%, 60%)",
      condition: { kind: "streak", days: 7 },
      cooldownDays: 7,
      active: true,
      createdAt: new Date().toISOString(),
    },
  ],
  vouchers: [],
};

const isValidState = (s: unknown): s is BountyState =>
  !!s && typeof s === "object"
    && Array.isArray((s as BountyState).rewards)
    && Array.isArray((s as BountyState).vouchers)
    && (s as BountyState).rewards.every((r) => !!(r as Reward).condition);

const load = (): BountyState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // limpa storage antigo
      try { localStorage.removeItem("flameer_bounty_v1"); } catch { /* noop */ }
      return seed;
    }
    const parsed = JSON.parse(raw);
    return isValidState(parsed) ? parsed : seed;
  } catch {
    return seed;
  }
};

interface Ctx {
  state: BountyState;
  availableVouchers: Voucher[];
  usedVouchers: Voucher[];
  newlyUnlocked: Voucher[];
  dismissUnlocked: (voucherId: string) => void;
  evaluateFromHabits: (ctx: EvalContext) => void;
  createReward: (data: {
    name: string;
    description?: string;
    icon: RewardIcon;
    color: string;
    condition: UnlockCondition;
    cooldownDays?: number;
  }) => void;
  updateReward: (id: string, patch: Partial<Reward>) => void;
  deleteReward: (id: string) => void;
  useVoucher: (voucherId: string) => void;
  reset: () => void;
}

const BountyCtx = createContext<Ctx | null>(null);

export const BountyProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<BountyState>(load);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Voucher[]>([]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  }, [state]);

  const evaluateFromHabits = useCallback((ctx: EvalContext) => {
    setState((cur) => {
      const { state: next, newVouchers } = evaluate(cur, ctx);
      if (newVouchers.length > 0) {
        setNewlyUnlocked((q) => [...q, ...newVouchers]);
      }
      return next;
    });
  }, []);

  const createReward: Ctx["createReward"] = useCallback((data) => {
    setState((cur) => ({
      ...cur,
      rewards: [
        ...cur.rewards,
        {
          id: crypto.randomUUID(),
          name: data.name,
          description: data.description,
          icon: data.icon,
          color: data.color,
          condition: data.condition,
          cooldownDays: data.cooldownDays ?? 0,
          active: true,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  }, []);

  const updateReward = useCallback((id: string, patch: Partial<Reward>) => {
    setState((cur) => ({
      ...cur,
      rewards: cur.rewards.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }, []);

  const deleteReward = useCallback((id: string) => {
    setState((cur) => ({
      ...cur,
      rewards: cur.rewards.filter((r) => r.id !== id),
      vouchers: cur.vouchers.filter((v) => v.rewardId !== id),
    }));
  }, []);

  const useVoucher = useCallback((id: string) => {
    setState((cur) => useVoucherFn(cur, id));
  }, []);

  const dismissUnlocked = useCallback((voucherId: string) => {
    setNewlyUnlocked((cur) => cur.filter((v) => v.id !== voucherId));
  }, []);

  const reset = useCallback(() => {
    setState(seed);
    setNewlyUnlocked([]);
  }, []);

  const value = useMemo<Ctx>(() => ({
    state,
    availableVouchers: state.vouchers.filter((v) => v.status === "available"),
    usedVouchers: state.vouchers.filter((v) => v.status === "used"),
    newlyUnlocked,
    dismissUnlocked,
    evaluateFromHabits,
    createReward,
    updateReward,
    deleteReward,
    useVoucher,
    reset,
  }), [state, newlyUnlocked, dismissUnlocked, evaluateFromHabits, createReward, updateReward, deleteReward, useVoucher, reset]);

  return <BountyCtx.Provider value={value}>{children}</BountyCtx.Provider>;
};

export const useBounty = (): Ctx => {
  const ctx = useContext(BountyCtx);
  if (!ctx) throw new Error("useBounty must be used inside <BountyProvider>");
  return ctx;
};
