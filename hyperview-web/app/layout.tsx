import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HyperView",
  description: "Hyperliquid-native charting and trading. M0 preview.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
