import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  seconds: number;
  onComplete: () => void;
  onSkip: () => void;
}

const RestTimer = ({ seconds, onComplete, onSkip }: Props) => {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      onComplete();
      return;
    }
    const t = setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onComplete]);

  const progress = remaining / seconds;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="flex flex-col items-center gap-4 py-6"
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descanso</p>
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={6} />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold text-foreground">{remaining}s</span>
        </div>
      </div>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onSkip}
        className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        Pular →
      </motion.button>
    </motion.div>
  );
};

export default RestTimer;
