import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { RewardIcon, UnlockCondition } from "../types";
import { REWARD_ICONS, REWARD_ICON_KEYS, REWARD_COLORS } from "./icons";

type CondKind = "full_day" | "streak";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    description?: string;
    icon: RewardIcon;
    color: string;
    condition: UnlockCondition;
    cooldownDays: number;
  }) => void;
}

const CreateRewardDialog = ({ open, onClose, onCreate }: Props) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(REWARD_COLORS[0]);
  const [icon, setIcon] = useState<RewardIcon>("gift");
  const [condKind, setCondKind] = useState<CondKind>("full_day");
  const [streakDays, setStreakDays] = useState(7);
  const [cooldown, setCooldown] = useState(0);

  const reset = () => {
    setName(""); setDescription(""); setColor(REWARD_COLORS[0]);
    setIcon("gift"); setCondKind("full_day"); setStreakDays(7); setCooldown(0);
  };

  const submit = () => {
    if (!name.trim()) return;
    const condition: UnlockCondition =
      condKind === "full_day" ? { kind: "full_day" } : { kind: "streak", days: streakDays };
    onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      icon, color, condition, cooldownDays: cooldown,
    });
    reset();
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
            className="bg-card rounded-3xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-extrabold text-foreground">Nova recompensa</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Nome</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: 2h de videogame"
                  className="mt-1.5 w-full px-4 py-3 rounded-2xl bg-muted text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Descrição (opcional)</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Sem culpa, você merece."
                  className="mt-1.5 w-full px-4 py-3 rounded-2xl bg-muted text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Quando desbloquear?
                </label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setCondKind("full_day")}
                    className={`p-3 rounded-2xl text-left transition-colors ${
                      condKind === "full_day"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="text-xs font-extrabold">Bater o dia</p>
                    <p className="text-[10px] font-bold opacity-80 mt-0.5">100% dos hábitos</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCondKind("streak")}
                    className={`p-3 rounded-2xl text-left transition-colors ${
                      condKind === "streak"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="text-xs font-extrabold">Dias seguidos</p>
                    <p className="text-[10px] font-bold opacity-80 mt-0.5">Manter chama N dias</p>
                  </button>
                </div>
                {condKind === "streak" && (
                  <div className="mt-3">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Meta: <span className="text-primary">{streakDays} dia(s)</span>
                    </label>
                    <input
                      type="range" min={3} max={30} step={1}
                      value={streakDays}
                      onChange={(e) => setStreakDays(Number(e.target.value))}
                      className="mt-2 w-full accent-primary"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Cooldown: <span className="text-primary">{cooldown === 0 ? "sem limite" : `${cooldown} dia(s)`}</span>
                </label>
                <input
                  type="range" min={0} max={30} step={1}
                  value={cooldown}
                  onChange={(e) => setCooldown(Number(e.target.value))}
                  className="mt-2 w-full accent-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Cor</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {REWARD_COLORS.map((c) => (
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
                  {REWARD_ICON_KEYS.map((k) => {
                    const I = REWARD_ICONS[k];
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
                onClick={submit}
                disabled={!name.trim()}
                className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-extrabold text-sm uppercase tracking-wider disabled:opacity-40 transition-opacity"
              >
                Criar recompensa
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreateRewardDialog;
