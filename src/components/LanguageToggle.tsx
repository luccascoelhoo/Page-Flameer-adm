import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, Check } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";

const LanguageToggle = () => {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/60 shadow-sm text-sm font-semibold text-foreground"
      >
        <Flag size={14} className="text-foreground" />
        {lang.toUpperCase()}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 z-50 w-32 rounded-2xl bg-card border border-border/60 shadow-xl overflow-hidden"
            >
              {(["pt", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    setLang(l);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-secondary transition-colors"
                >
                  {l.toUpperCase()}
                  {lang === l && <Check size={14} className="text-primary" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageToggle;