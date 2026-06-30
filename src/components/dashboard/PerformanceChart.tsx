import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

/** 14 days of mocked daily performance scores (0-100) */
const DATA = [
  { d: "01/04", v: 62 },
  { d: "02/04", v: 70 },
  { d: "03/04", v: 58 },
  { d: "04/04", v: 75 },
  { d: "05/04", v: 80 },
  { d: "06/04", v: 72 },
  { d: "07/04", v: 68 },
  { d: "08/04", v: 78 },
  { d: "09/04", v: 84 },
  { d: "10/04", v: 88 },
  { d: "11/04", v: 82 },
  { d: "12/04", v: 90 },
  { d: "13/04", v: 86 },
  { d: "14/04", v: 92 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-md">
      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{label}</p>
      <p className="text-sm font-extrabold text-primary">{payload[0].value} pts</p>
    </div>
  );
};

const PerformanceChart = () => {
  const current = DATA[DATA.length - 1].v;
  const prev = DATA[DATA.length - 2].v;
  const delta = current - prev;
  const trendUp = delta >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bento-card relative overflow-hidden"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Evolução Pessoal
          </p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <h3 className="text-2xl font-extrabold text-foreground">{current}</h3>
            <span className="text-xs font-bold text-muted-foreground">/100</span>
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
        <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center">
          <TrendingUp size={18} className="text-primary" strokeWidth={2.4} />
        </div>
      </div>

      <div className="h-32 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={DATA} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="d"
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval={2}
            />
            <YAxis hide domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }} />
            <Area
              type="monotone"
              dataKey="v"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              fill="url(#perfGradient)"
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

    </motion.div>
  );
};

export default PerformanceChart;