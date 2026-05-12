import type { MonthlyReturn } from "@bt/schemas";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthlyHeatmap({ points }: { points: ReadonlyArray<MonthlyReturn> }) {
  if (points.length === 0) {
    return <div className="text-sm text-muted-foreground">No monthly history yet.</div>;
  }
  const years = Array.from(new Set(points.map((p) => p.year))).sort();
  const lookup = new Map<string, number>();
  let max = 0;
  for (const p of points) {
    lookup.set(`${p.year}-${p.month}`, p.returnPct);
    max = Math.max(max, Math.abs(p.returnPct));
  }
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          <th className="px-2 py-1 text-left text-muted-foreground">Year</th>
          {MONTHS.map((m) => (
            <th key={m} className="px-2 py-1 text-right text-muted-foreground">{m}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {years.map((y) => (
          <tr key={y}>
            <td className="px-2 py-1 font-mono text-muted-foreground">{y}</td>
            {MONTHS.map((_, mi) => {
              const v = lookup.get(`${y}-${mi + 1}`);
              return (
                <td
                  key={mi}
                  className="px-2 py-1 text-right font-mono tabular-nums"
                  style={v == null ? undefined : { background: tint(v, max) }}
                  title={v == null ? "" : `${(v * 100).toFixed(2)}%`}
                >
                  {v == null ? "" : `${(v * 100).toFixed(1)}%`}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function tint(v: number, max: number): string {
  if (max === 0) return "transparent";
  const intensity = Math.min(1, Math.abs(v) / max);
  const alpha = 0.15 + 0.5 * intensity;
  return v >= 0 ? `rgba(16, 185, 129, ${alpha})` : `rgba(239, 68, 68, ${alpha})`;
}
