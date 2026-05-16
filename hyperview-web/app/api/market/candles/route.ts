import { z } from "zod";
import { NextResponse } from "next/server";
import { fetchCandles } from "@/lib/marketServer";
import { Timeframe } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  symbol: z.string().regex(/^[A-Z0-9._-]{1,32}$/),
  tf: Timeframe,
  startMs: z.coerce.number().int().nonnegative(),
  endMs: z.coerce.number().int().positive(),
});

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const bars = await fetchCandles(parsed.data);
    return NextResponse.json({ bars }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "upstream candles fetch failed", cause: String(err) },
      { status: 502 },
    );
  }
}
