import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Droplets, Footprints, Moon, Dumbbell, Apple, Heart, BookOpen, Sparkles, Hash, Check } from "lucide-react";

export type HabitIconKey = "droplets" | "footprints" | "moon" | "dumbbell" | "apple" | "heart" | "book" | "sparkles";

export const HABIT_ICONS: Record<HabitIconKey, typeof Droplets> = {
  droplets: Droplets,
  footprints: Footprints,
  moon: Moon,
  dumbbell: Dumbbell,
  apple: Apple,
  heart: Heart,
  book: BookOpen,
  sparkles: Sparkles,
};

const COLORS = [
  "hsl(200, 80%, 55%)",
  "hsl(27, 100%, 50%)",
  "hsl(260, 60%, 60%)",
  "hsl(142, 70%, 45%)",
  "hsl(340, 80%, 60%)",
  "hsl(45, 95%, 55%)",
  "hsl(180, 65%, 45%)",
  "hsl(0, 80%, 60%)",
];

const ICON_KEYS: HabitIconKey[] = ["droplets", "footprints", "moon", "dumbbell", "apple", "heart", "book", "sparkles"];

export type HabitKind = "quantity" | "single";

export interface NewHabit {
  label: string;
  color: string;
  icon: HabitIconKey;
  goal: string;
  kind: HabitKind;
  target?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (h: NewHabit) => void;
}

const CreateHabitDialog = ({ open, onClose, onCreate }: Props) => {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState<HabitIconKey>("sparkles");
  const [kind, setKind] = useState<HabitKind>("quantity");
  const [target, setTarget] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) return;
    const t = parseInt(target, 10);
    onCreate({
      label: name.trim(),
      color,
      icon,
      goal: goal.trim() || (kind === "single" ? "Diário" : "Meta"),
      kind,
      target: kind === "quantity" && !Number.isNaN(t) && t > 0 ? t : undefined,
    });
    setName(""); setGoal(""); setColor(COLORS[0]); setIcon("sparkles");
    setKind("quantity"); setTarget("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-card rounded-3xl w-full max-w-md p-6 shadow-2xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-extrabold text-foreground">Novo Hábito</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tipo</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    onClick={() => setKind("quantity")}
                    className={`flex items-center gap-2 px-3 py-3 rounded-2xl text-sm font-bold transition-all ${
                      kind === "quantity" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Hash size={15} />
                    Quantidade
                  </button>
                  <button
                    onClick={() => setKind("single")}
                    className={`flex items-center gap-2 px-3 py-3 rounded-2xl text-sm font-bold transition-all ${
                      kind === "single" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Check size={15} />
                    Único
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground font-medium mt-1.5 px-1">
                  {kind === "quantity"
                    ? "Registra valores ao longo do dia (ex: passos, sono, copos)."
                    : "Um clique = feito. Ex: meditar, sem porn, sem açúcar."}
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Nome</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Meditação"
                  className="mt-1.5 w-full px-4 py-3 rounded-2xl bg-muted text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {kind === "quantity" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Meta diária</label>
                    <input
                      value={target}
                      onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))}
                      inputMode="numeric"
                      placeholder="Ex: 8000"
                      className="mt-1.5 w-full px-4 py-3 rounded-2xl bg-muted text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Unidade</label>
                    <input
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      placeholder="Ex: passos, min"
                      className="mt-1.5 w-full px-4 py-3 rounded-2xl bg-muted text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Cor</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-9 h-9 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Ícone</label>
                <div className="grid grid-cols-8 gap-2 mt-2">
                  {ICON_KEYS.map((k) => {
                    const I = HABIT_ICONS[k];
                    return (
                      <button
                        key={k}
                        onClick={() => setIcon(k)}
                        className={`aspect-square rounded-xl flex items-center justify-center transition-all ${
                          icon === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <I size={16} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!name.trim()}
                className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-extrabold text-sm uppercase tracking-wider disabled:opacity-40 transition-opacity"
              >
                Criar Hábito
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreateHabitDialog;