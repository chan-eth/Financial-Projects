import Link from "next/link";
import { BTCPriceChart } from "@/components/BTCPriceChart";
import { fetchCandles } from "@/lib/marketServer";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SYMBOL = "BTC";
const TIMEFRAME = "1h";
const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export default async function HomePage() {
  const endMs = Date.now();
  const startMs = endMs - LOOKBACK_MS;
  let bars: Awaited<ReturnType<typeof fetchCandles>> = [];
  let fetchError: string | null = null;

  try {
    bars = await fetchCandles({ symbol: SYMBOL, tf: TIMEFRAME, startMs, endMs });
  } catch (err) {
    fetchError = String(err);
  }

  const me = await getCurrentUser();

  return (
    <main className="min-h-dvh flex flex-col gap-6 px-6 py-10 max-w-6xl mx-auto">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">HyperView</h1>
          <p className="text-sm text-neutral-400">
            Hyperliquid-native charting and trading · M0 preview
          </p>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          {me ? (
            <Link href="/account" className="text-neutral-300 hover:text-white">
              {me.user.displayName ?? me.user.primaryAddress.slice(0, 8) + "…"}
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-neutral-400 hover:text-white">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-white"
              >
                Create passkey
              </Link>
            </>
          )}
        </nav>
      </header>

      <div className="flex items-baseline justify-end text-sm text-neutral-500">
        <div className="text-right">
          <div className="font-mono uppercase tracking-wider">
            {SYMBOL} · {TIMEFRAME}
          </div>
          <div className="text-xs">last 30 days · polled every 15s</div>
        </div>
      </div>

      {fetchError ? (
        <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
          <div className="font-medium">Could not load candles</div>
          <div className="mt-1 text-red-300/80">{fetchError}</div>
          <div className="mt-2 text-xs text-red-400">
            Check that <code>HYPERVIEW_API</code> points at a reachable worker, or
            unset it to fall back to Hyperliquid testnet directly.
          </div>
        </div>
      ) : (
        <BTCPriceChart initialBars={bars} symbol={SYMBOL} timeframe={TIMEFRAME} />
      )}

      <footer className="text-xs text-neutral-500">
        {bars.length > 0 && (
          <>
            {bars.length} bars · earliest {new Date(bars[0].ts * 1000).toISOString()} ·
            latest {new Date(bars[bars.length - 1].ts * 1000).toISOString()}
          </>
        )}
      </footer>
    </main>
  );
}
