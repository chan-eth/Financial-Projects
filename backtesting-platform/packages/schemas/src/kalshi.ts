import { z } from "zod";

export const KalshiSnapshot = z.object({
  id: z.string(),
  marketTicker: z.string(),
  ts: z.number().int(),
  yesBid: z.number().int(),
  yesAsk: z.number().int(),
  noBid: z.number().int(),
  noAsk: z.number().int(),
  volume: z.number().int(),
  underlyingIndexPrice: z.number().nullable(),
});
export type KalshiSnapshot = z.infer<typeof KalshiSnapshot>;

export const KalshiMarket = z.object({
  ticker: z.string(),
  eventTicker: z.string(),
  series: z.enum(["KXBTC", "KXETH", "KXSOL", "KXDOGE", "KXHYPE"]),
  strike: z.number(),
  openTs: z.number().int(),
  closeTs: z.number().int(),
  settlementValue: z.number().nullable(),
});
export type KalshiMarket = z.infer<typeof KalshiMarket>;
