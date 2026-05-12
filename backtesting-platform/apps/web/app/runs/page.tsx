import Link from "next/link";
import { listRuns } from "@/lib/api-client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function Page() {
  let runs: Awaited<ReturnType<typeof listRuns>> = [];
  let error: string | null = null;
  try {
    runs = await listRuns();
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Runs</h1>
          <p className="text-sm text-muted-foreground">
            Completed and in-flight backtests. Sort by Sharpe, total return, or drawdown.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load runs: {error}
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No runs yet. Configure a strategy on the{" "}
          <Link href="/strategies/hyperliquid" className="underline">Hyperliquid</Link> or{" "}
          <Link href="/strategies/kalshi-15m" className="underline">Kalshi 15m</Link> page to launch one.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run</TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>TF</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Return</TableHead>
              <TableHead className="text-right">Sharpe</TableHead>
              <TableHead className="text-right">Max DD</TableHead>
              <TableHead>Finished</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/runs/${r.id}`} className="underline">{r.id.slice(0, 8)}</Link>
                </TableCell>
                <TableCell>{r.strategyKind}</TableCell>
                <TableCell>{r.symbol}</TableCell>
                <TableCell>{r.timeframe}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "succeeded" ? "default" : "secondary"}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-right">{fmtPct(r.totalReturnPct)}</TableCell>
                <TableCell className="text-right">{fmtNum(r.sharpe)}</TableCell>
                <TableCell className="text-right">{fmtPct(r.maxDrawdownPct)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.finishedAt ? new Date(r.finishedAt).toLocaleString() : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

function fmtNum(n: number | null): string {
  if (n == null) return "—";
  return n.toFixed(2);
}
