import { Bell } from "lucide-react";
import { motion } from "framer-motion";
import { WalletBadge } from "@/modules/bounty";

/**
 * Minimal Instagram-like top bar with the "Flameerclub" wordmark.
 * Uses the Sora display font + tight tracking to feel editorial / minimal.
 */
const AppHeader = ({
  onCreate,
  onLike,
}: {
  onCreate?: () => void;
  onLike?: () => void;
}) => {
  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border/60">
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
        <div className="-ml-1">
          <WalletBadge />
        </div>

        <motion.h1
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-[22px] font-extrabold tracking-tight text-foreground select-none"
          style={{ letterSpacing: "-0.04em" }}
        >
          Flameer
        </motion.h1>

        <button
          onClick={onLike}
          aria-label="Notificações"
          className="w-10 h-10 -mr-1 flex items-center justify-center rounded-full hover:bg-secondary transition-colors"
        >
          <Bell size={24} strokeWidth={2} className="text-foreground" />
        </button>
      </div>
    </header>
  );
};

export default AppHeader;