import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Gift } from "lucide-react";
import { useBounty } from "../useBounty";

/**
 * Badge no header mostrando vouchers disponíveis para usar.
 * Antigo "WalletBadge" (moedas) — agora simbólico de presentes.
 */
const WalletBadge = () => {
  const { availableVouchers } = useBounty();
  const navigate = useNavigate();
  const count = availableVouchers.length;
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={() => navigate("/recompensas")}
      aria-label={`Recompensas: ${count} disponíveis`}
      className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full bg-primary/10 border border-primary/20"
    >
      <Gift size={15} className="text-primary" strokeWidth={2.6} />
      <span className="text-sm font-extrabold text-primary tabular-nums">
        {count}
      </span>
    </motion.button>
  );
};

export default WalletBadge;
