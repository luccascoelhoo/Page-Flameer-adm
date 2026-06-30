import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Sparkles } from "lucide-react";
import { useBounty } from "../useBounty";
import { REWARD_ICONS } from "./icons";

const fire = () => {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.3 },
    colors: ["#FF7300", "#FFB266", "#FFFFFF"],
  });
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(40);
};

const RewardUnlockedToast = () => {
  const { newlyUnlocked, dismissUnlocked, useVoucher, state } = useBounty();
  const voucher = newlyUnlocked[0] ?? null;
  const reward = voucher ? state.rewards.find((r) => r.id === voucher.rewardId) : null;

  useEffect(() => {
    if (voucher) fire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucher?.id]);

  if (!voucher || !reward) return null;
  const Icon = REWARD_ICONS[reward.icon] ?? REWARD_ICONS.gift;

  return (
    <AnimatePresence>
      <motion.div
        key={voucher.id}
        initial={{ y: -120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -120, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="fixed top-3 left-3 right-3 z-[80] mx-auto max-w-md"
      >
        <div className="rounded-3xl bg-gradient-to-br from-primary to-[hsl(15,100%,55%)] text-white shadow-2xl p-4">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0"
            >
              <Icon size={24} strokeWidth={2.6} />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <Sparkles size={12} />
                <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-90">
                  Recompensa desbloqueada
                </p>
              </div>
              <p className="text-sm font-extrabold leading-tight truncate">{reward.name}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <button
              onClick={() => { useVoucher(voucher.id); dismissUnlocked(voucher.id); }}
              className="py-2 rounded-xl bg-white text-primary font-extrabold text-[11px] uppercase tracking-wider"
            >
              Usar agora
            </button>
            <button
              onClick={() => dismissUnlocked(voucher.id)}
              className="py-2 rounded-xl bg-white/20 text-white font-extrabold text-[11px] uppercase tracking-wider"
            >
              Guardar
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RewardUnlockedToast;
