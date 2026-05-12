"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRun } from "@/lib/api-client";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

export default function Page() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("BTC");
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>("1h");
  const [fastEma, setFastEma] = useState(12);
  const [slowEma, setSlowEma] = useState(48);
  const [riskBps, setRiskBps] = useState(50);
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
            kind: "hyperliquid",
            symbol,
            timeframe,
            fastEma,
            slowEma,
            riskPerTradeBps: riskBps,
            takerFeeBps: 4,
            makerFeeBps: 1,
            slippageBps: 2,
          },
          symbol,
          timeframe,
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

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hyperliquid backtest</h1>
        <p className="text-sm text-muted-foreground">
          EMA crossover baseline over perps. Sized by risk-per-trade in bps of equity.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Configuration</CardTitle></CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input id="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tf">Timeframe</Label>
              <select
                id="tf"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as (typeof TIMEFRAMES)[number])}
              >
                {TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fast">Fast EMA</Label>
              <Input id="fast" type="number" min={2} max={500} value={fastEma} onChange={(e) => setFastEma(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slow">Slow EMA</Label>
              <Input id="slow" type="number" min={5} max={1000} value={slowEma} onChange={(e) => setSlowEma(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="risk">Risk per trade (bps)</Label>
              <Input id="risk" type="number" min={1} max={2000} value={riskBps} onChange={(e) => setRiskBps(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="days">Window (days)</Label>
              <Input id="days" type="number" min={1} max={70} value={days} onChange={(e) => setDays(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">Phase 1 stores 70 days of history.</p>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Queueing…" : "Launch backtest"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
