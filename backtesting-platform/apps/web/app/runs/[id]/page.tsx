import { getRun, getTearsheet } from "@/lib/api-client";
import { KpiTiles } from "@/components/tearsheet/kpi-tiles";
import { EquityChart } from "@/components/tearsheet/equity-chart";
import { DrawdownChart } from "@/components/tearsheet/drawdown-chart";
import { RollingSharpeChart } from "@/components/tearsheet/rolling-sharpe-chart";
import { MonthlyHeatmap } from "@/components/tearsheet/monthly-heatmap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <div className="font-mono text-xs text-muted-foreground">run / {run.id}</div>
        <h1 className="text-2xl font-semibold">
          {run.configJson.strategy.kind} · {run.configJson.symbol} · {run.timeframe}
        </h1>
        <div className="text-sm text-muted-foreground">
          {new Date(run.startTs * 1000).toLocaleDateString()} → {new Date(run.endTs * 1000).toLocaleDateString()} ·
          status: <span className="font-mono">{run.status}</span>
        </div>
      </header>

      {run.status === "succeeded" ? (
        <SucceededView id={id} run={run} />
      ) : (
        <PendingView status={run.status} />
      )}

      <section>
        <Card>
          <CardHeader><CardTitle className="text-sm">Config</CardTitle></CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md bg-muted p-4 text-xs">
              {JSON.stringify(run.configJson, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

async function SucceededView({ id, run }: { id: string; run: Awaited<ReturnType<typeof getRun>> }) {
  const ts = await getTearsheet(id);
  void run;
  return (
    <>
      <KpiTiles metrics={ts.metrics} />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Equity</h2>
        <Card>
          <CardContent className="pt-4">
            <EquityChart points={ts.equity} />
            <Separator className="my-3" />
            <DrawdownChart points={ts.equity} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Rolling 30-bar Sharpe</CardTitle></CardHeader>
          <CardContent><RollingSharpeChart points={ts.rollingSharpe} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Monthly returns</CardTitle></CardHeader>
          <CardContent><MonthlyHeatmap points={ts.monthlyReturns} /></CardContent>
        </Card>
      </section>
    </>
  );
}

function PendingView({ status }: { status: string }) {
  const tone =
    status === "failed" || status === "canceled"
      ? "border-destructive/40 bg-destructive/5 text-destructive"
      : "border-border bg-card text-muted-foreground";
  const message =
    status === "queued"
      ? "Queued. The Worker hasn't picked this run up yet — refresh in a few seconds."
      : status === "running"
        ? "Running. The tearsheet will appear here once the engine finishes the last bar."
        : status === "failed"
          ? "Run failed. Check the configured strategy + symbol; the Worker logs have details."
          : status === "canceled"
            ? "Run was canceled before completion."
            : "No tearsheet available yet.";
  return (
    <div className={`rounded-md border p-8 text-center text-sm ${tone}`}>{message}</div>
  );
}
