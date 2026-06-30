import { Gamepad2, Pizza, Film, ShoppingBag, Music, Coffee, Beer, Gift } from "lucide-react";
import type { RewardIcon } from "../types";

export const REWARD_ICONS: Record<RewardIcon, typeof Gift> = {
  gamepad: Gamepad2,
  pizza: Pizza,
  film: Film,
  shoppingbag: ShoppingBag,
  music: Music,
  coffee: Coffee,
  beer: Beer,
  gift: Gift,
};

export const REWARD_ICON_KEYS: RewardIcon[] = [
  "gamepad", "pizza", "film", "shoppingbag", "music", "coffee", "beer", "gift",
];

export const REWARD_COLORS = [
  "hsl(27, 100%, 50%)",
  "hsl(0, 80%, 60%)",
  "hsl(260, 60%, 60%)",
  "hsl(200, 80%, 55%)",
  "hsl(142, 70%, 45%)",
  "hsl(45, 95%, 55%)",
  "hsl(340, 80%, 60%)",
  "hsl(180, 65%, 45%)",
];