import { motion } from "framer-motion";
import { Flame, Share2 } from "lucide-react";

interface VictoryCardProps {
  activeDays?: number;
  userName?: string;
}

const VictoryCard = ({ activeDays = 18, userName = "ANAAC CLUB" }: VictoryCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="relative overflow-hidden rounded-3xl p-6 bg-black shadow-xl min-h-[220px] flex flex-col"
    >
      {/* Subtle background glow */}
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-[80px] bg-primary/40" />
      <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full blur-[100px] bg-primary/30" />

      <div className="relative z-10 flex items-center justify-between">
        <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
          Compartilhar
        </p>
        <button aria-label="Compartilhar" className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
          <Share2 size={16} className="text-white" strokeWidth={2.4} />
        </button>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center py-2">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.2 }}
        >
          <Flame size={36} strokeWidth={2.5} className="text-primary mx-auto mb-1" />
        </motion.div>
        <p
          className="text-[20px] font-extrabold uppercase text-primary leading-none"
          style={{ letterSpacing: "1.5px" }}
        >
          DIAS ATIVOS
        </p>
        <motion.p
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.3 }}
          className="text-6xl font-black text-white leading-none mt-1"
        >
          {activeDays}
        </motion.p>
      </div>
    </motion.div>
  );
};

export default VictoryCard;