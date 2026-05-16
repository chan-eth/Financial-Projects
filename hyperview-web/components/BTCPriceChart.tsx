"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

import type { MarketBar } from "@/lib/schemas";

interface Props {
  initialBars: MarketBar[];
  symbol: string;
  timeframe: string;
}

export function BTCPriceChart({ initialBars, symbol, timeframe }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Build the chart on mount; tear it down on unmount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: "#0a0a0a" },
        textColor: "#cfcfcf",
        fontFamily: "ui-sans-serif, system-ui, -apple-system",
      },
      grid: {
        vertLines: { color: "#1c1c1c" },
        horzLines: { color: "#1c1c1c" },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: "#262626" },
      timeScale: {
        borderColor: "#262626",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    series.setData(
      initialBars.map((b) => ({
        time: b.ts as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [initialBars]);

  // Poll for new bars every 15s to keep the chart roughly live without WS yet.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const series = seriesRef.current;
      if (!series) return;
      try {
        const endMs = Date.now();
        const startMs = endMs - 4 * 60 * 60 * 1000; // last 4 hours
        const params = new URLSearchParams({
          symbol,
          tf: timeframe,
          startMs: String(startMs),
          endMs: String(endMs),
        });
        const res = await fetch(`/api/market/candles?${params}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as { bars?: MarketBar[] };
        if (cancelled || !body.bars) return;
        for (const b of body.bars) {
          series.update({
            time: b.ts as Time,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
          });
        }
      } catch {
        // network blips are non-fatal; the next tick retries.
      }
    };
    const id = window.setInterval(tick, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symbol, timeframe]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[60vh] rounded-lg border border-neutral-800 bg-neutral-950"
    />
  );
}
