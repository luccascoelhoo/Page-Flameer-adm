import { motion } from "framer-motion";
import { Trophy, Crown, Flame, Medal, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

type League = "essencial" | "constancia" | "elite";

const LEAGUE_LABELS: Record<League, { label: string; color: string }> = {
  essencial:  { label: "Essencial",  color: "text-emerald-500" },
  constancia: { label: "Constância", color: "text-blue-500" },
  elite:      { label: "Elite",      color: "text-rose-500" },
};

type RankEntry = { name: string; avatar: string; days: number; streak: number; isMe?: boolean };

const RANKING: Record<League, RankEntry[]> = {
  essencial: [
    { name: "Marina S.", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face", days: 26, streak: 14 },
    { name: "Você",      avatar: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=80&h=80&fit=crop&crop=face", days: 24, streak: 14, isMe: true },
    { name: "Pedro L.",  avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face", days: 22, streak: 9 },
    { name: "Camila R.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face", days: 21, streak: 7 },
    { name: "Igor C.",   avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=80&h=80&fit=crop&crop=face", days: 19, streak: 5 },
    { name: "Lucas M.",  avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=80&h=80&fit=crop&crop=face", days: 17, streak: 3 },
  ],
  constancia: [
    { name: "Rafael T.", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face", days: 28, streak: 20 },
    { name: "Ana B.",    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face", days: 25, streak: 12 },
    { name: "Bruno K.",  avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=80&h=80&fit=crop&crop=face", days: 23, streak: 8 },
  ],
  elite: [
    { name: "Carla F.",   avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face", days: 30, streak: 30 },
    { name: "Gustavo P.", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face", days: 29, streak: 25 },
  ],
};

const Podium = ({ entries }: { entries: RankEntry[] }) => {
  const top3 = entries.slice(0, 3);
  if (top3.length === 0) return null;
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  const heights = ["h-20", "h-28", "h-16"];
  const ranks = [2, 1, 3];
  const ringColors = ["ring-[hsl(0,0%,75%)]", "ring-primary", "ring-[hsl(30,70%,55%)]"];

  return (
    <div className="grid grid-cols-3 gap-2 items-end pt-4">
      {order.map((e, i) => {
        const rank = ranks[i];
        return (
          <div key={e?.name ?? i} className="flex flex-col items-center gap-2">
            <div className="relative">
              <div className={cn("rounded-full p-[3px] ring-2", ringColors[i])}>
                <img src={e.avatar} alt={e.name} className="w-14 h-14 rounded-full object-cover" />
              </div>
              {rank === 1 && (
                <Crown size={16} className="absolute -top-3 left-1/2 -translate-x-1/2 text-primary fill-primary" />
              )}
              <span className={cn(
                "absolute -bottom-1 -right-1 w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center text-white",
                rank === 1 ? "bg-primary" : rank === 2 ? "bg-foreground/60" : "bg-[hsl(30,70%,55%)]"
              )}>{rank}</span>
            </div>
            <p className="text-[11px] font-extrabold text-foreground text-center truncate w-full">{e.name}</p>
            <div className={cn(
              "w-full rounded-t-2xl bg-secondary border-t border-x border-border/60 flex items-center justify-center",
              heights[i]
            )}>
              <div className="flex flex-col items-center">
                <span className="text-base font-extrabold text-primary">{e.days}</span>
                <span className="text-[9px] text-muted-foreground font-bold uppercase">dias</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const RankingView = () => {
  const league: League = "essencial";
  const ranking = RANKING[league];
  const rest = ranking.slice(3);
  const me = ranking.find((r) => r.isMe);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="px-4 py-4 space-y-4"
    >
      <div className="bento-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sua Liga</p>
            <p className={cn("text-base font-extrabold", LEAGUE_LABELS[league].color)}>
              Liga {LEAGUE_LABELS[league].label}
            </p>
          </div>
          <Trophy className={LEAGUE_LABELS[league].color} size={22} />
        </div>
        <Podium entries={ranking} />
      </div>

      <div className="bento-card p-2">
        <div className="space-y-1">
          {rest.map((e, i) => (
            <div
              key={e.name}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-colors",
                e.isMe ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/50"
              )}
            >
              <span className="w-6 text-xs font-extrabold text-muted-foreground tabular-nums">#{i + 4}</span>
              <img src={e.avatar} alt={e.name} className="w-9 h-9 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-foreground truncate">{e.name}</p>
                <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
                  <span>{e.days} dias</span>
                  <span className="flex items-center gap-0.5">
                    <Flame size={10} className="text-primary" /> {e.streak}
                  </span>
                </div>
              </div>
              {i === 0 && <Medal size={16} className="text-[hsl(30,70%,55%)]" />}
            </div>
          ))}
        </div>

        {me && (
          <div className="mt-2 pt-2 border-t border-border/60">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/30">
              <span className="w-6 text-xs font-extrabold text-primary">#{ranking.indexOf(me) + 1}</span>
              <img src={me.avatar} alt="Você" className="w-9 h-9 rounded-full object-cover ring-2 ring-primary" />
              <div className="flex-1">
                <p className="text-sm font-extrabold text-foreground">Sua posição</p>
                <p className="text-[11px] font-bold text-muted-foreground">{me.days} dias ativos</p>
              </div>
              <Flame size={18} className="text-primary" />
            </div>
          </div>
        )}
      </div>

      <div className="bento-card flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Gift size={18} className="text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Prêmio do mês</p>
          <p className="text-sm font-extrabold text-foreground">Kit Suplementação Completo 🎁</p>
          <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
            Para o Top 3 da sua liga · Sorteio dia 30
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default RankingView;