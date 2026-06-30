import { motion } from "framer-motion";
import { Plus } from "lucide-react";

export const CreateChallengeFAB = ({ onClick }: { onClick: () => void }) => (
  <motion.button
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 20 }}
    whileTap={{ scale: 0.92 }}
    onClick={onClick}
    aria-label="Criar ou entrar em desafio"
    className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.6)] flex items-center justify-center"
  >
    <Plus size={26} strokeWidth={2.6} />
  </motion.button>
);