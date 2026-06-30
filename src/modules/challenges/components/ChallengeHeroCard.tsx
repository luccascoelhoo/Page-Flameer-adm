import { motion } from "framer-motion";
import { Users, Calendar } from "lucide-react";
import type { Challenge } from "../types";
import { TierBadge } from "./TierBadge";
import { PrizeBadge } from "./PrizeBadge";

export const ChallengeHeroCard = ({ challenge, onClick }: { challenge: Challenge; onClick?: () => void }) => (
  <motion.button
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="relative w-full text-left rounded-3xl overflow-hidden h-52 group"
  >
    <img src={challenge.cover} alt={challenge.title} className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105" />
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <TierBadge tier={challenge.tier} />
        {challenge.prize && <PrizeBadge prize={challenge.prize} />}
      </div>
    </div>
    <div className="absolute bottom-0 inset-x-0 p-4 text-white space-y-2">
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{challenge.category} · {challenge.hostName}</span>
      <h2 className="text-xl font-extrabold leading-tight">{challenge.title}</h2>
      <div className="flex items-center gap-3 text-[11px] font-semibold opacity-90">
        <span className="flex items-center gap-1"><Calendar size={11} /> {challenge.durationDays} dias</span>
        <span className="flex items-center gap-1"><Users size={11} /> {challenge.participants.toLocaleString("pt-BR")}</span>
      </div>
    </div>
  </motion.button>
);