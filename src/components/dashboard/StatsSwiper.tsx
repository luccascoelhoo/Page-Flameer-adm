import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PerformanceChart from "./PerformanceChart";
import VictoryCard from "./VictoryCard";
import DashboardHero from "./DashboardHero";

interface StatsSwiperProps {
  hero?: React.ComponentProps<typeof DashboardHero>;
}

const StatsSwiper = ({ hero }: StatsSwiperProps) => {
  const [index, setIndex] = useState(0);
  const SLIDES = [
    { key: "hero", node: <DashboardHero {...(hero ?? {})} /> },
    { key: "perf", node: <PerformanceChart /> },
    { key: "victory", node: <VictoryCard /> },
  ];

  const goTo = (i: number) => setIndex(Math.max(0, Math.min(SLIDES.length - 1, i)));

  return (
    <div className="space-y-2">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={SLIDES[index].key}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.x < -60) goTo(index + 1);
            else if (info.offset.x > 60) goTo(index - 1);
          }}
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0 }}
          className="h-[210px] [&>*]:h-full [&>*]:flex [&>*]:flex-col"
        >
          {SLIDES[index].node}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-center gap-1.5 pt-1">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-5 bg-primary" : "w-1.5 bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default StatsSwiper;