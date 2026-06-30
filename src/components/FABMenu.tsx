import { motion, AnimatePresence } from "framer-motion";
import { Dumbbell, ClipboardCheck, Droplets, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  onCheckIn: () => void;
}

const actions = [
  { icon: Dumbbell, label: "Registrar Treino", path: "/treino", color: "bg-primary" },
  { icon: ClipboardCheck, label: "Check-in Diário", action: "checkin", color: "bg-success" },
  { icon: Droplets, label: "Beber Água", action: "water", color: "bg-[hsl(200,80%,55%)]" },
];

const FABMenu = ({ open, onClose, onCheckIn }: Props) => {
  const navigate = useNavigate();

  const handleAction = (a: typeof actions[number]) => {
    onClose();
    if (a.path) {
      navigate(a.path);
    } else if (a.action === "checkin") {
      setTimeout(onCheckIn, 200);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[55] bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
            {actions.map((a, i) => {
              const Icon = a.icon;
              return (
                <motion.button
                  key={a.label}
                  initial={{ opacity: 0, y: 30, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.8 }}
                  transition={{ delay: (actions.length - 1 - i) * 0.06, type: "spring", stiffness: 400, damping: 25 }}
                  onClick={(e) => { e.stopPropagation(); handleAction(a); }}
                  className="flex items-center gap-3 bg-card rounded-2xl px-5 py-3 shadow-lg border border-border/50"
                >
                  <div className={`w-9 h-9 rounded-xl ${a.color} flex items-center justify-center`}>
                    <Icon size={18} className="text-white" />
                  </div>
                  <span className="text-sm font-semibold text-foreground whitespace-nowrap">{a.label}</span>
                </motion.button>
              );
            })}
          </div>

          <motion.button
            className="absolute bottom-5 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg"
            initial={{ rotate: 0 }}
            animate={{ rotate: 45 }}
            exit={{ rotate: 0 }}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            <X className="text-primary-foreground" size={28} strokeWidth={2.5} />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FABMenu;
