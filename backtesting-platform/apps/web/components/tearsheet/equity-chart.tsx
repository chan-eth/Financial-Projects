"use client";

import type { TearsheetEquityPoint } from "@bt/schemas";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function EquityChart({ points }: { points: ReadonlyArray<TearsheetEquityPoint> }) {
  const data = points.map((p) => ({
    ts: p.ts * 1000,
    equity: p.equity,
    benchmark: p.benchmark ?? null,
  }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
          <defs>
            <linearGradient id="equity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeOpacity={0.1} />
          <XAxis dataKey="ts" type="number" domain={["auto", "auto"]} tickFormatter={fmtDate} fontSize={11} />
          <YAxis tickFormatter={(v) => Math.round(Number(v) / 1000) + "k"} fontSize={11} domain={["auto", "auto"]} />
          <Tooltip
            labelFormatter={(v) => fmtDate(Number(v))}
            formatter={(v: number) => `$${Number(v).toLocaleString()}`}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }}
          />
          <Area type="monotone" dataKey="equity" stroke="var(--accent)" fill="url(#equity)" strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
