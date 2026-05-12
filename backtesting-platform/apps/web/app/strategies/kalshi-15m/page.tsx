"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KalshiMarketCard } from "@/components/kalshi/market-card";
import { createRun } from "@/lib/api-client";

const UNDERLYINGS = ["BTC", "ETH", "SOL", "DOGE", "HYPE"] as const;
type Underlying = (typeof UNDERLYINGS)[number];

const INDEX_BY_UNDERLYING: Record<Underlying, string> = {
  BTC: "BRTI",
  ETH: "ETHUSD_RTI",
  SOL: "SOLUSD_RTI",
  DOGE: "DOGEUSD_RTI",
  HYPE: "ETHUSD_RTI",
};

export default function Page() {
  const router = useRouter();
  const [underlying, setUnderlying] = useState<Underlying>("BTC");
  const [edgeBps, setEdgeBps] = useState(150);
  const [maxConcurrent, setMaxConcurrent] = useState(3);
  const [days, setDays] = useState(70);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const endTs = Math.floor(Date.now() / 1000);
    const startTs = endTs - days * 24 * 60 * 60;
    try {
      const res = await createRun({
        config: {
          strategy: {
            kind: "kalshi_15m",
            underlying,
            edgeBps,
            maxConcurrent,
            takerFeeCentsPerContract: 7,
            decisionLeadSec: 60,
          },
          symbol: `KX${underlying}-15M`,
          timeframe: "15m",
          startTs,
          endTs,
          initialCashUsd: 100_000,
        },
      });
      toast.success(`Run queued: ${res.runId.slice(0, 8)}`);
      router.push(`/runs/${res.runId}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const previews: Array<{ ticker: string; question: string; yes: number; no: number; spot: number; strike: number }> = [
    { ticker: `KX${underlying}-15M-1`, question: `${underlying} above $109,500 in 15 min?`, yes: 62, no: 38, spot: 110_120, strike: 109_500 },
    { ticker: `KX${underlying}-15M-2`, question: `${underlying} above $110,000 in 15 min?`, yes: 51, no: 49, spot: 110_120, strike: 110_000 },
    { ticker: `KX${underlying}-15M-3`, question: `${underlying} above $110,500 in 15 min?`, yes: 34, no: 66, spot: 110_120, strike: 110_500 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Kalshi 15-min crypto</h1>
        <p className="text-sm text-muted-foreground">
          Markets settle at the close of a 15-minute window against the {INDEX_BY_UNDERLYING[underlying]} index.
          Strategy buys YES/NO when the spot-vs-strike drift exceeds the configured edge.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardHeader><CardTitle className="text-sm">Configuration</CardTitle></CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="under">Underlying</Label>
                <select
                  id="under"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={underlying}
                  onChange={(e) => setUnderlying(e.target.value as Underlying)}
                >
                  {UNDERLYINGS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edge">Edge threshold (bps)</Label>
                <Input id="edge" type="number" min={10} max={5000} value={edgeBps} onChange={(e) => setEdgeBps(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max">Max concurrent</Label>
                <Input id="max" type="number" min={1} max={20} value={maxConcurrent} onChange={(e) => setMaxConcurrent(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="days">Window (days)</Label>
                <Input id="days" type="number" min={1} max={70} value={days} onChange={(e) => setDays(Number(e.target.value))} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Queueing…" : "Launch backtest"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live market preview · settles vs {INDEX_BY_UNDERLYING[underlying]}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {previews.map((p) => (
              <KalshiMarketCard
                key={p.ticker}
                ticker={p.ticker}
                question={p.question}
                yesPrice={p.yes}
                noPrice={p.no}
                underlyingPrice={p.spot}
                strike={p.strike}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Static preview — historical Kalshi snapshots and live BRTI/RTI overlays render here once
            the ingest CLIs have been run.
          </p>
        </div>
      </div>
    </div>
  );
}
