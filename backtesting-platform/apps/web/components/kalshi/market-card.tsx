import { Card, CardContent } from "@/components/ui/card";

export interface KalshiMarketCardProps {
  ticker: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  underlyingPrice?: number;
  strike?: number;
}

export function KalshiMarketCard({ ticker, question, yesPrice, noPrice, underlyingPrice, strike }: KalshiMarketCardProps) {
  const yesPct = clampCents(yesPrice);
  const noPct = clampCents(noPrice);
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-4">
        <div className="space-y-0.5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{ticker}</div>
          <div className="text-sm font-medium leading-tight">{question}</div>
        </div>
        {underlyingPrice != null && strike != null ? (
          <div className="font-mono text-xs text-muted-foreground">
            spot ${underlyingPrice.toFixed(2)} · strike ${strike.toFixed(2)} · drift{" "}
            <span className={underlyingPrice >= strike ? "text-emerald-500" : "text-red-500"}>
              {(((underlyingPrice - strike) / strike) * 100).toFixed(2)}%
            </span>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <ProbabilityChip label="YES" cents={yesPct} tone="emerald" />
          <ProbabilityChip label="NO" cents={noPct} tone="red" />
        </div>
      </CardContent>
    </Card>
  );
}

function ProbabilityChip({ label, cents, tone }: { label: string; cents: number; tone: "emerald" | "red" }) {
  const bg = tone === "emerald" ? "bg-emerald-500/10" : "bg-red-500/10";
  const fg = tone === "emerald" ? "text-emerald-500" : "text-red-500";
  return (
    <div className={`rounded-md border border-border/60 ${bg} px-3 py-2`}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className={`font-mono ${fg}`}>{cents}¢</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={tone === "emerald" ? "h-full bg-emerald-500" : "h-full bg-red-500"} style={{ width: `${cents}%` }} />
      </div>
    </div>
  );
}

function clampCents(n: number): number {
  return Math.max(0, Math.min(99, Math.round(n)));
}
