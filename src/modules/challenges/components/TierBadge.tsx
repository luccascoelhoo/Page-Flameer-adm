import { Shield, Star, Crown, Users } from "lucide-react";
import type { ChallengeTier } from "../types";
import { cn } from "@/lib/utils";

const config: Record<ChallengeTier, { label: string; icon: typeof Shield; className: string }> = {
  admin: { label: "Oficial", icon: Shield, className: "bg-primary text-primary-foreground" },
  influencer: { label: "Influencer", icon: Star, className: "bg-foreground text-background" },
  premium_user: { label: "Premium", icon: Crown, className: "bg-amber-500 text-white" },
  friend: { label: "Privado", icon: Users, className: "bg-secondary text-secondary-foreground border border-border/60" },
};

export const TierBadge = ({ tier, className }: { tier: ChallengeTier; className?: string }) => {
  const c = config[tier];
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest", c.className, className)}>
      <Icon size={9} />
      {c.label}
    </span>
  );
};