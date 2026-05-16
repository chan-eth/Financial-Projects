# @hv/charts

Web charting adapters. Thin layer over Lightweight Charts (Apache 2.0) that:

1. Binds the worker's WebSocket stream (Durable Object fan-out per `(symbol, channel)`) to chart series.
2. Adapts HypeScript indicator outputs to overlay/pane series.
3. Owns chart-level theming and the chart-bottom ad slot lifecycle (premium tier removes it).

Native iOS and Android render charts with custom Metal / Skia code (see `hyperview-ios/`, `hyperview-android/`) — they consume the same indicator outputs via UniFFI but do not depend on this package.

## Status

**M0 scaffolding** — placeholder index. First real adapter (candles + volume bound to BTC perp WS) lands in M0.

## Out-of-scope for this package

- Drawings (trendlines, fib, shapes). Persisted server-side, rendered by Lightweight Charts' drawing primitives but state-managed in `hyperview-web/`.
- Order-ticket UI. Lives in `hyperview-web/` and consumes `@hv/trading` directly.

## Trademark note

We use Lightweight Charts (Apache 2.0). We do not use or paraphrase any third-party trademark, logo, screenshot, or branded visual idiom anywhere in this package or in the web app's marketing.
