import { z } from "zod";

export const EquityPoint = z.object({
  runId: z.string(),
  ts: z.number().int(),
  equity: z.number(),
  drawdown: z.number(),
});
export type EquityPoint = z.infer<typeof EquityPoint>;
