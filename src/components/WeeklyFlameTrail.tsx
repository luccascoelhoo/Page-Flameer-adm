import { motion } from "framer-motion";
import { Flame, Check } from "lucide-react";

/** Day status for the weekly trail */
export type DayStatus = "done" | "today" | "rest" | "missed" | "future";

export interface FlameDay {
  /** Single-letter weekday (S, T, Q...) */
  letter: string;
  status: DayStatus;
}

interface Props {
  days: FlameDay[];
  totalActiveDays: number;
  title?: string;
}

const STATUS_STYLES: Record<DayStatus, string> = {
  done:   "bg-gradient-to-br from-orange-400 to-primary text-white shadow-md shadow-primary/30",
  today:  "bg-gradient-to-br from-sky-300 to-sky-500 text-white shadow-md shadow-sky-400/40",
  rest:   "bg-gradient-to-br from-sky-200 to-sky-400 text-white/90",
  missed: "bg-muted text-muted-foreground/40 border border-border",
  future: "bg-secondary/60 text-muted-foreground/30 border border-border/60",
};

const WeeklyFlameTrail = ({ days, totalActiveDays, title = "Esta semana" }: Props) => {
  return (
    <div className="bg-card rounded-3xl shadow-sm border border-border/50 px-4 py-3.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-primary fill-primary/20" strokeWidth={2.4} />
          <span className="text-xs font-extrabold text-foreground uppercase tracking-widest">
            {title}
          </span>
        </div>
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10">
          <span className="text-[11px] font-extrabold text-primary">
            {totalActiveDays} Dias Ativos
          </span>
          <Flame size={11} className="text-primary fill-primary" />
        </span>
      </div>

      {/* Trail */}
      <div className="flex items-center justify-between gap-1.5">
        {days.map((d, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 18 }}
            className="flex flex-col items-center gap-1.5 flex-1 min-w-0"
          >
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${STATUS_STYLES[d.status]}`}
            >
              {d.status === "done" && <Check size={20} strokeWidth={3} />}
              {(d.status === "today" || d.status === "rest") && (
                <span className="w-2 h-2 rounded-full bg-white/90" />
              )}
            </div>
            <span className="text-[11px] font-bold text-muted-foreground">{d.letter}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default WeeklyFlameTrail;