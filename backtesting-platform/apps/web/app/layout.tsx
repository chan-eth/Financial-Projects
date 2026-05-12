import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "getdebanked — backtesting",
  description: "Interactive backtester for Hyperliquid + Kalshi 15m crypto markets.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <header className="border-b border-border">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
            <a href="/" className="font-mono text-sm tracking-tight">
              getdebanked.xyz / backtests
            </a>
            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="/strategies/hyperliquid" className="hover:text-foreground">Hyperliquid</a>
              <a href="/strategies/kalshi-15m" className="hover:text-foreground">Kalshi 15m</a>
              <a href="/runs" className="hover:text-foreground">Runs</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
        <Toaster richColors />
      </body>
    </html>
  );
}
