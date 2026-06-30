import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DashboardHeroProps {
  hasTrainingPlan?: boolean;
  todayScheduleName?: string;
  adherence?: number;
  streak?: number;
  ranking?: number;
  currentDayLabel?: string;
}

const DashboardHero = ({
  hasTrainingPlan = true,
  todayScheduleName = "Costas & Bíceps",
  adherence = 78,
  streak = 14,
  ranking = 3,
  currentDayLabel = "QUI",
}: DashboardHeroProps) => {
  const navigate = useNavigate();
  const cappedAdherence = Math.min(adherence, 100);

  return (
    <div className="relative z-10 w-full h-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl p-5 overflow-hidden shadow-xl flex flex-row items-center justify-between gap-4 bg-gradient-to-br from-primary to-[hsl(15,100%,55%)] shadow-primary/20 h-full"
      >
        {/* Background Glow */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-white/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/5 rounded-full blur-[80px]" />

        {/* Left: Text + Button */}
        <div className="relative z-10 flex-1 space-y-3 min-w-0">
          <div className="space-y-1">
            {hasTrainingPlan && currentDayLabel && (
              <p className="text-white/75 font-bold text-[10px] tracking-[0.2em] uppercase">
                {currentDayLabel}
              </p>
            )}
            <h2 className="text-lg font-extrabold text-white leading-[1.1] tracking-tight">
              {hasTrainingPlan ? todayScheduleName.toUpperCase() : "SEU DESAFIO COMEÇA AGORA"}
            </h2>
          </div>

          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(hasTrainingPlan ? "/treino" : "/desafio")}
            className="px-5 py-2.5 bg-white text-primary font-extrabold text-xs rounded-full tracking-wider shadow-lg uppercase"
          >
            {hasTrainingPlan ? "Iniciar Treino" : "Escolha o plano"}
          </motion.button>
        </div>

        {/* Right: Circular Progress + Stats */}
        <div className="relative z-10 flex flex-col items-center gap-3 shrink-0">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle
                cx="60" cy="60" r="54"
                stroke="currentColor" strokeWidth="6"
                fill="transparent"
                className="text-white/25"
              />
              <motion.circle
                cx="60" cy="60" r="54"
                stroke="currentColor" strokeWidth="6"
                fill="transparent"
                strokeDasharray="339.29"
                initial={{ strokeDashoffset: 339.29 }}
                animate={{ strokeDashoffset: 339.29 - (339.29 * cappedAdherence) / 100 }}
                transition={{ duration: 1.6, ease: "easeOut" }}
                strokeLinecap="round"
                className="text-white"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Flame className="text-white animate-pulse w-4 h-4 mb-0.5" />
              <span className="text-xl font-extrabold text-white leading-none">{cappedAdherence}%</span>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <div className="text-center">
              <p className="text-base font-extrabold text-white leading-none">{streak}</p>
              <p className="text-[8px] text-white/85 uppercase tracking-widest mt-1">Dias</p>
            </div>
            <div className="w-px h-6 bg-white/30" />
            <div className="text-center">
              <p className="text-base font-extrabold text-white leading-none">#{ranking}</p>
              <p className="text-[8px] text-white/85 uppercase tracking-widest mt-1">Rank</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DashboardHero;