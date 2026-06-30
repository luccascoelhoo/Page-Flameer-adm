import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Trophy,
  ShieldCheck,
  Activity,
  Utensils,
  Copy,
  Crown,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import logoBranco from "@/assets/insano-logo-branco.svg";

export type Badge = {
  id: string;
  label: string;
  icon: LucideIcon;
  earned: boolean;
};

export const DEFAULT_BADGES: Badge[] = [
  { id: "spark", label: "Primeira Faísca", icon: Flame, earned: true },
  { id: "streak7", label: "Ofensiva 7d", icon: Flame, earned: true },
  { id: "streak14", label: "Ofensiva 14d", icon: Flame, earned: true },
  { id: "streak30", label: "Ofensiva 30d", icon: Trophy, earned: false },
  { id: "discipline", label: "Disciplinado", icon: ShieldCheck, earned: true },
  { id: "cardio", label: "Cardio Beast", icon: Activity, earned: false },
  { id: "nutri", label: "Nutri Pro", icon: Utensils, earned: false },
  { id: "inspire", label: "Inspirador", icon: Copy, earned: false },
  { id: "elite", label: "Elite", icon: Crown, earned: true },
];

type Props = {
  name: string;
  handle: string;
  avatar: string;
  posts: number | string;
  followers: number | string;
  activeDays: number | string;
  plan: string;
  badges?: Badge[];
};

const AthleteCard = ({
  name,
  handle,
  avatar,
  posts,
  followers,
  activeDays,
  plan,
  badges = DEFAULT_BADGES,
}: Props) => {
  const [flipped, setFlipped] = useState(false);
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="px-4 pt-4">
      <div style={{ perspective: 1400 }}>
        <motion.button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-pressed={flipped}
          aria-label="Virar cartão de atleta"
          className="relative w-full aspect-[1.55/1] rounded-3xl outline-none"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.75, ease: [0.4, 0, 0.2, 1] }}
          whileTap={{ scale: 0.985 }}
        >
          {/* FRONT */}
          <div
            className="absolute inset-0 rounded-3xl overflow-hidden p-4 flex flex-col text-left bg-gradient-to-br from-[hsl(27_100%_55%)] via-[hsl(20_100%_50%)] to-[hsl(15_95%_42%)] shadow-[0_20px_50px_-15px_hsl(20_80%_30%/0.5)]"
            style={{ backfaceVisibility: "hidden" }}
          >
            {/* Concentric circles top-right */}
            <svg
              viewBox="0 0 200 200"
              className="absolute -top-8 -right-10 w-56 h-56 text-white/40 pointer-events-none"
              aria-hidden
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <circle
                  key={n}
                  cx="100"
                  cy="100"
                  r={20 * n}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  opacity={1 - n * 0.13}
                />
              ))}
            </svg>

            {/* Logo + brand */}
            <div className="relative flex items-center gap-1.5">
              <img src={logoBranco} alt="Flameer" className="h-4 w-auto" />
              <span className="text-[10px] tracking-[0.18em] font-bold text-white">
                FLAMEER
              </span>
            </div>

            {/* Avatar + name */}
            <div className="relative flex items-center gap-2.5 mt-3">
              <div className="p-[2px] rounded-full bg-white/90">
                <Avatar className="w-12 h-12 border-2 border-white/0">
                  <AvatarImage src={avatar} />
                  <AvatarFallback className="text-base font-bold">
                    {name[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="min-w-0">
                <p className="text-base font-extrabold text-white leading-tight truncate">
                  {name}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="relative mt-auto grid grid-cols-3 gap-1.5">
              {[
                { v: posts, l: "POSTS" },
                { v: followers, l: "SEGUIDORES" },
                { v: activeDays, l: "DIAS ATIVOS" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="text-lg font-extrabold text-white leading-none tabular-nums">
                    {s.v}
                  </p>
                  <p className="text-[8px] tracking-[0.12em] font-bold text-white/75 mt-1">
                    {s.l}
                  </p>
                </div>
              ))}
            </div>

            {/* Bottom row */}
            <div className="relative flex items-end justify-between mt-2.5 pt-2.5 border-t border-white/20">
              <span className="text-[9px] tracking-[0.15em] font-bold text-white">
                {plan}
              </span>
              <span className="text-[9px] tracking-[0.12em] font-bold text-white/85 shrink-0">
                BRA 🇧🇷
              </span>
            </div>
          </div>

          {/* BACK */}
          <div
            className="absolute inset-0 rounded-3xl overflow-hidden p-4 flex flex-col bg-gradient-to-br from-[hsl(220_10%_28%)] via-[hsl(220_10%_20%)] to-[hsl(220_12%_14%)] shadow-[0_20px_50px_-15px_hsl(220_30%_5%/0.5)]"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-primary/15 blur-3xl pointer-events-none" />

            <div className="relative flex items-center justify-between">
              <span className="text-[10px] tracking-[0.18em] font-bold text-white/90">
                INSÍGNIAS
              </span>
              <span className="text-[10px] tracking-[0.15em] font-bold text-primary">
                {earnedCount}/{badges.length}
              </span>
            </div>
            <div className="relative mt-1.5 h-0.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${(earnedCount / badges.length) * 100}%` }}
              />
            </div>

            <div className="relative mt-2.5 flex-1 grid grid-cols-3 gap-y-1.5 gap-x-2 content-between">
              {badges.map((b) => {
                const Icon = b.icon;
                return (
                  <div key={b.id} className="flex flex-col items-center gap-0.5">
                    <div
                      className={cn(
                        "relative w-9 h-9 rounded-full flex items-center justify-center",
                        b.earned
                          ? "bg-gradient-to-br from-primary to-[hsl(15,100%,50%)] shadow-[0_0_12px_hsl(27_100%_50%/0.5)]"
                          : "bg-white/5 border border-white/10"
                      )}
                    >
                      <Icon
                        size={15}
                        strokeWidth={2.4}
                        className={b.earned ? "text-white" : "text-white/30"}
                      />
                      {!b.earned && (
                        <Lock
                          size={8}
                          strokeWidth={3}
                          className="absolute -bottom-0.5 -right-0.5 text-white/50 bg-[hsl(220_12%_14%)] rounded-full p-[1px] w-3 h-3"
                        />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[8px] font-bold text-center leading-tight",
                        b.earned ? "text-white/90" : "text-white/35"
                      )}
                    >
                      {b.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={flipped ? "back" : "front"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="text-center text-[11px] text-muted-foreground mt-2 font-medium"
        >
          {flipped ? "Toque para ver o cartão" : "Toque no cartão para ver insígnias"}
        </motion.p>
      </AnimatePresence>
    </div>
  );
};

export default AthleteCard;