import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Page() {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Backtesting Platform</h1>
        <p className="max-w-2xl text-muted-foreground">
          Two trading bots, one tearsheet UI. Configure a strategy, queue a run, and inspect the
          equity curve, drawdown, rolling Sharpe and trade log against historical data.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <BotCard
          href="/strategies/hyperliquid"
          title="Hyperliquid"
          tagline="Perps + spot · every timeframe × every ticker"
          tags={["EMA cross baseline", "Slippage + fees", "L2 book aware"]}
        />
        <BotCard
          href="/strategies/kalshi-15m"
          title="Kalshi 15-min crypto"
          tagline="BTC · ETH · SOL · DOGE · HYPE — settle vs CF Benchmarks indices"
          tags={["BRTI / RTI overlays", "Yes/No edge model", "Per-market trade log"]}
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Data window
        </h2>
        <p className="mt-2 text-sm">
          Phase 1 ingests the most recent 70 days of data — Kalshi crypto markets haven&apos;t been
          live longer than that, and this keeps the BRTI / RTI reconstruction tractable from public
          constituent-exchange endpoints.
        </p>
      </section>
    </div>
  );
}

function BotCard({ href, title, tagline, tags }: { href: string; title: string; tagline: string; tags: string[] }) {
  return (
    <Link href={href} className="block">
      <Card className="transition hover:border-foreground/40">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{tagline}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <Badge key={t} variant="secondary">{t}</Badge>
          ))}
        </CardContent>
      </Card>
    </Link>
  );
}
