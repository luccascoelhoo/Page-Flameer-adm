import { motion } from "framer-motion";
import { Users, Lock } from "lucide-react";
import type { Challenge } from "../types";
import { TierBadge } from "./TierBadge";
import { PrizeBadge } from "./PrizeBadge";

export const ChallengeCard = ({ challenge, onClick, index = 0 }: { challenge: Challenge; onClick?: () => void; index?: number }) => (
  <motion.button
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className="text-left rounded-2xl overflow-hidden bg-card border border-border/50 group"
  >
    <div className="relative aspect-[4/3] overflow-hidden">
      <img src={challenge.cover} alt={challenge.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2">
        <TierBadge tier={challenge.tier} />
        {challenge.visibility === "private" && (
          <div className="w-6 h-6 rounded-full bg-background/80 backdrop-blur flex items-center justify-center">
            <Lock size={10} className="text-foreground" />
          </div>
        )}
      </div>
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <span className="text-[9px] font-bold text-white/85 uppercase tracking-widest">{challenge.category}</span>
        {challenge.prize && <PrizeBadge prize={challenge.prize} />}
      </div>
    </div>
    <div className="p-3 space-y-1.5">
      <h3 className="text-sm font-extrabold text-foreground leading-tight line-clamp-2">{challenge.title}</h3>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
        <span>{challenge.durationDays} dias</span>
        <span className="flex items-center gap-1">
          <Users size={10} />
          {challenge.participants.toLocaleString("pt-BR")}
        </span>
      </div>
    </div>
  </motion.button>
);