"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  Pie,
  PieChart,
} from "recharts";

export function AccuracyChart({
  data,
}: {
  data: { date: string; accuracy: number; reviews: number }[];
}) {
  if (data.length < 2) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Complete a few more reviews to see your accuracy trend.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="acc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(158 64% 42%)" stopOpacity={0.5} />
            <stop offset="95%" stopColor="hsl(158 64% 42%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number, name) =>
            name === "accuracy" ? [`${v}%`, "Accuracy"] : [v, "Reviews"]
          }
        />
        <Area
          type="monotone"
          dataKey="accuracy"
          stroke="hsl(158 64% 42%)"
          strokeWidth={2}
          fill="url(#acc)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const STATUS_COLORS: Record<string, string> = {
  New: "hsl(217 91% 60%)",
  Learning: "hsl(239 84% 67%)",
  Review: "hsl(38 92% 50%)",
  Weak: "hsl(0 72% 51%)",
  Mastered: "hsl(158 64% 42%)",
};

export function StatusPie({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No vocabulary yet.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={filtered}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {filtered.map((entry) => (
            <Cell
              key={entry.name}
              fill={STATUS_COLORS[entry.name] ?? "hsl(var(--muted))"}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
