"use client";

import type { RollingSharpePoint } from "@bt/schemas";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function RollingSharpeChart({ points }: { points: ReadonlyArray<RollingSharpePoint> }) {
  const data = points.map((p) => ({ ts: p.ts * 1000, sharpe: p.sharpe }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
          <CartesianGrid strokeOpacity={0.1} />
          <XAxis dataKey="ts" type="number" domain={["auto", "auto"]} tickFormatter={(v) => new Date(Number(v)).toLocaleDateString(undefined, { month: "short", day: "numeric" })} fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip
            labelFormatter={(v) => new Date(Number(v)).toLocaleDateString()}
            formatter={(v: number) => Number(v).toFixed(2)}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }}
          />
          <Line type="monotone" dataKey="sharpe" stroke="var(--accent)" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
