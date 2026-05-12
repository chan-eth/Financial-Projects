import { z } from "zod";

export const TradeSide = z.enum(["long", "short", "yes", "no"]);
export type TradeSide = z.infer<typeof TradeSide>;

export const Trade = z.object({
  id: z.string(),
  runId: z.string(),
  ts: z.number().int(),
  side: TradeSide,
  qty: z.number(),
  price: z.number(),
  fee: z.number(),
  pnl: z.number(),
  reason: z.string().nullable(),
});
export type Trade = z.infer<typeof Trade>;
