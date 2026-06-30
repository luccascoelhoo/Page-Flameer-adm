import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface Props {
  open: boolean;
  onClose: () => void;
}

const steps = [
  {
    id: "sleep",
    question: "Como foi seu sono?",
    options: [
      { emoji: "😴", label: "Péssimo", value: 1 },
      { emoji: "😐", label: "Ok", value: 2 },
      { emoji: "😊", label: "Bom", value: 3 },
      { emoji: "🤩", label: "Incrível", value: 4 },
    ],
  },
  {
    id: "energy",
    question: "Nível de energia agora?",
    options: [
      { emoji: "🪫", label: "Zero", value: 1 },
      { emoji: "🔋", label: "Baixa", value: 2 },
      { emoji: "⚡", label: "Boa", value: 3 },
      { emoji: "🚀", label: "Máxima", value: 4 },
    ],
  },
  {
    id: "stress",
    question: "Como está o estresse?",
    options: [
      { emoji: "🧘", label: "Zen", value: 1 },
      { emoji: "😌", label: "Tranquilo", value: 2 },
      { emoji: "😤", label: "Tenso", value: 3 },
      { emoji: "🤯", label: "Explodindo", value: 4 },
    ],
  },
];

const DailyCheckIn = ({ open, onClose }: Props) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [sleepHours, setSleepHours] = useState([7]);
  const [done, setDone] = useState(false);

  const handleSelect = (value: number) => {
    const current = steps[step];
    const newAnswers = { ...answers, [current.id]: value };
    setAnswers(newAnswers);

    if (step < steps.length - 1) {
      setTimeout(() => setStep(step + 1), 300);
    } else {
      setTimeout(() => setDone(true), 300);
    }
  };

  const handleClose = () => {
    setStep(0);
    setAnswers({});
    setDone(false);
    onClose();
  };

  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[60] bg-black/60 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleClose}
    >
      <motion.div
        className="bg-card w-full max-w-lg rounded-t-3xl p-6 pb-10 space-y-6"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Check-in Diário</h2>
          <button onClick={handleClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-3 py-8"
            >
              <span className="text-5xl">✅</span>
              <p className="text-xl font-bold text-foreground">Check-in completo!</p>
              <p className="text-sm text-muted-foreground">
                Sono: {sleepHours[0]}h · Energia: {answers.energy}/4 · Estresse: {answers.stress}/4
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleClose}
                className="mt-4 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold uppercase text-sm"
              >
                Fechar
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= step ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>

              <p className="text-lg font-bold text-foreground">{steps[step].question}</p>

              {step === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Horas de sono: <span className="font-bold text-foreground">{sleepHours[0]}h</span></p>
                  <Slider
                    value={sleepHours}
                    onValueChange={setSleepHours}
                    min={3}
                    max={12}
                    step={0.5}
                    className="w-full"
                  />
                </div>
              )}

              <div className="grid grid-cols-4 gap-3">
                {steps[step].options.map((opt) => (
                  <motion.button
                    key={opt.value}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleSelect(opt.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors ${
                      answers[steps[step].id] === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-transparent bg-secondary"
                    }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className="text-[10px] font-semibold text-foreground">{opt.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default DailyCheckIn;
