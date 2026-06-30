import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Dumbbell, Apple, Moon } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type Slide = {
  key: string;
  title: string;
  unit: string;
  icon: typeof TrendingUp;
  color: string; // hsl token reference (used in style)
  data: { d: string; v: number }[];
  stats: { label: string; value: number | string }[];
};

const days = ["01/04","02/04","03/04","04/04","05/04","06/04","07/04","08/04","09/04","10/04","11/04","12/04","13/04","14/04"];
const mk = (arr: number[]) => arr.map((v, i) => ({ d: days[i], v }));

const SLIDES: Slide[] = [
  {
    key: "perf",
    title: "Performance Geral",
    unit: "/100",
    icon: TrendingUp,
    color: "hsl(var(--primary))",
    data: mk([62,70,58,75,80,72,68,78,84,88,82,90,86,92]),
    stats: [
      { label: "Treino", value: 88 },
      { label: "Dieta", value: 76 },
      { label: "Sono", value: 92 },
    ],
  },
  {
    key: "treino",
    title: "Treino",
    unit: " sessões",
    icon: Dumbbell,
    color: "hsl(27 100% 50%)",
    data: mk([1,1,0,1,1,1,0,1,1,1,1,0,1,1]),
    stats: [
      { label: "Volume", value: "12.4t" },
      { label: "Adesão", value: "86%" },
      { label: "PRs", value: 3 },
    ],
  },
  {
    key: "dieta",
    title: "Dieta",
    unit: " kcal",
    icon: Apple,
    color: "hsl(142 70% 45%)",
    data: mk([2100,2300,1950,2200,2400,2150,2050,2250,2300,2280,2310,2150,2400,2380]),
    stats: [
      { label: "Proteína", value: "180g" },
      { label: "Carbo", value: "240g" },
      { label: "Gordura", value: "70g" },
    ],
  },
  {
    key: "sono",
    title: "Sono",
    unit: "h",
    icon: Moon,
    color: "hsl(260 60% 60%)",
    data: mk([6.2,7.1,5.8,7.4,8.0,7.2,6.8,7.8,8.2,7.9,7.5,8.1,7.6,8.3]),
    stats: [
      { label: "Média", value: "7.4h" },
      { label: "Profundo", value: "1h52" },
      { label: "REM", value: "1h30" },
    ],
  },
];

const CustomTooltip = ({ active, payload, label, color }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-md">
      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{label}</p>
      <p className="text-sm font-extrabold" style={{ color }}>{payload[0].value}</p>
    </div>
  );
};

const PerformanceCarousel = () => {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const Icon = slide.icon;
  const current = slide.data[slide.data.length - 1].v;
  const prev = slide.data[slide.data.length - 2].v;
  const delta = +(current - prev).toFixed(1);
  const trendUp = delta >= 0;
  const gradId = `grad-${slide.key}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bento-card relative overflow-hidden"
    >
      {/* Tabs */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {SLIDES.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setIndex(i)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${
              i === index
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={slide.key}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.x < -60 && index < SLIDES.length - 1) setIndex(index + 1);
            else if (info.offset.x > 60 && index > 0) setIndex(index - 1);
          }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {slide.title}
              </p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <h3 className="text-2xl font-extrabold text-foreground">{current}</h3>
                <span className="text-xs font-bold text-muted-foreground">{slide.unit}</span>
                <span
                  className={`text-[11px] font-extrabold flex items-center gap-0.5 ${
                    trendUp ? "text-success" : "text-destructive"
                  }`}
                >
                  <TrendingUp size={11} strokeWidth={3} className={trendUp ? "" : "rotate-180"} />
                  {trendUp ? "+" : ""}{delta}
                </span>
              </div>
            </div>
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${slide.color.replace(")", " / 0.12)").replace("hsl(", "hsl(")}` }}
            >
              <Icon size={18} style={{ color: slide.color }} strokeWidth={2.4} />
            </div>
          </div>

          <div className="h-32 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={slide.data} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={slide.color} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={slide.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="d"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval={2}
                />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip content={<CustomTooltip color={slide.color} />} cursor={{ stroke: slide.color, strokeWidth: 1, strokeDasharray: "3 3" }} />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={slide.color}
                  strokeWidth={2.5}
                  fill={`url(#${gradId})`}
                  animationDuration={700}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/50">
            {slide.stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-sm font-extrabold text-foreground">{s.value}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-3">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-5 bg-primary" : "w-1.5 bg-muted"
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default PerformanceCarousel;