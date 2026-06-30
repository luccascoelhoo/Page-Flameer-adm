import type { Challenge } from "../types";
import { ChallengeCard } from "./ChallengeCard";

export const FeaturedCarousel = ({ items, onSelect }: { items: Challenge[]; onSelect: (c: Challenge) => void }) => (
  <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none snap-x snap-mandatory">
    {items.map((c, i) => (
      <div key={c.id} className="shrink-0 w-44 snap-start">
        <ChallengeCard challenge={c} index={i} onClick={() => onSelect(c)} />
      </div>
    ))}
  </div>
);