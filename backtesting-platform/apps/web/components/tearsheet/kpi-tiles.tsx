import type { RunMetrics } from "@bt/schemas";
import { Card, CardContent } from "@/components/ui/card";

export function KpiTiles({ metrics }: { metrics: RunMetrics }) {
  const tiles: Array<{ label: string; value: string; tone?: "pos" | "neg" }> = [
    { label: "Total return", value: fmtPct(metrics.totalReturnPct), tone: metrics.totalReturnPct >= 0 ? "pos" : "neg" },
    { label: "CAGR", value: fmtPct(metrics.cagrPct) },
    { label: "Sharpe", value: metrics.sharpe.toFixed(2) },
    { label: "Sortino", value: metrics.sortino.toFixed(2) },
    { label: "Max DD", value: fmtPct(metrics.maxDrawdownPct), tone: "neg" },
    { label: "Calmar", value: metrics.calmar.toFixed(2) },
    { label: "Win rate", value: fmtPct(metrics.winRatePct) },
    { label: "Profit factor", value: Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : "∞" },
    { label: "Trades", value: String(metrics.tradeCount) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-9">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardContent className="px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.label}</div>
            <div
              className={`mt-1 text-lg font-mono ${
                t.tone === "pos" ? "text-emerald-500" : t.tone === "neg" ? "text-red-500" : ""
              }`}
            >
              {t.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}
