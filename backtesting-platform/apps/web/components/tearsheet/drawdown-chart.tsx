"use client";

import type { TearsheetEquityPoint } from "@bt/schemas";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function DrawdownChart({ points }: { points: ReadonlyArray<TearsheetEquityPoint> }) {
  const data = points.map((p) => ({ ts: p.ts * 1000, dd: p.drawdown }));
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 0, right: 12, left: 12, bottom: 0 }}>
          <CartesianGrid strokeOpacity={0.1} />
          <XAxis dataKey="ts" type="number" domain={["auto", "auto"]} tickFormatter={(v) => new Date(Number(v)).toLocaleDateString(undefined, { month: "short", day: "numeric" })} fontSize={11} />
          <YAxis tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`} fontSize={11} domain={["auto", 0]} />
          <Tooltip
            labelFormatter={(v) => new Date(Number(v)).toLocaleString()}
            formatter={(v: number) => `${(Number(v) * 100).toFixed(2)}%`}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }}
          />
          <Area dataKey="dd" stroke="hsl(0 75% 55%)" fill="hsl(0 75% 55% / 0.25)" strokeWidth={1} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
