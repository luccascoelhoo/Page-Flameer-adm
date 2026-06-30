import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export const PrizeBadge = ({ prize, className }: { prize: string; className?: string }) => (
  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400", className)}>
    <Trophy size={10} className="fill-current" />
    {prize}
  </span>
);