import type { Trade } from "@bt/schemas";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function TradeTable({ trades }: { trades: ReadonlyArray<Trade> }) {
  if (trades.length === 0) {
    return <div className="text-sm text-muted-foreground">No trades.</div>;
  }
  return (
    <div className="max-h-96 overflow-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Side</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Fee</TableHead>
            <TableHead className="text-right">PnL</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-mono text-xs">{new Date(t.ts * 1000).toLocaleString()}</TableCell>
              <TableCell className="uppercase">{t.side}</TableCell>
              <TableCell className="text-right font-mono">{t.qty.toFixed(4)}</TableCell>
              <TableCell className="text-right font-mono">{t.price.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono">{t.fee.toFixed(2)}</TableCell>
              <TableCell className={`text-right font-mono ${t.pnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {t.pnl.toFixed(2)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{t.reason ?? ""}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
