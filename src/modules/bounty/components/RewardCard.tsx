import { motion } from "framer-motion";
import { Lock, Trash2 } from "lucide-react";
import type { Reward } from "../types";
import { describeCondition } from "../bountyEngine";
import { REWARD_ICONS } from "./icons";

interface Props {
  reward: Reward;
  hasAvailableVoucher: boolean;
  onDelete?: (id: string) => void;
}

const RewardCard = ({ reward, hasAvailableVoucher, onDelete }: Props) => {
  const Icon = REWARD_ICONS[reward.icon] ?? REWARD_ICONS.gift;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative bg-card rounded-3xl border p-4 shadow-sm overflow-hidden ${
        hasAvailableVoucher ? "border-primary/40" : "border-border/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `color-mix(in srgb, ${reward.color} 18%, transparent)` }}
        >
          <Icon size={24} style={{ color: reward.color }} strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-foreground leading-tight truncate">
            {reward.name}
          </p>
          {reward.description && (
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5 line-clamp-2">
              {reward.description}
            </p>
          )}
        </div>
        {hasAvailableVoucher ? (
          <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground shrink-0">
            pronta
          </span>
        ) : (
          <Lock size={14} className="text-muted-foreground shrink-0 mt-1" />
        )}
      </div>

      <div className="mt-3 px-3 py-2 rounded-2xl bg-muted/60">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Condição
        </p>
        <p className="text-xs font-extrabold text-foreground mt-0.5 leading-tight">
          {describeCondition(reward.condition)}
        </p>
      </div>

      {reward.cooldownDays > 0 && (
        <p className="mt-2 text-[10px] font-bold text-muted-foreground">
          Cooldown: {reward.cooldownDays} dia(s)
        </p>
      )}

      {onDelete && (
        <button
          onClick={() => onDelete(reward.id)}
          aria-label="Remover"
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          <Trash2 size={13} className="text-destructive" />
        </button>
      )}
    </motion.div>
  );
};

export default RewardCard;
