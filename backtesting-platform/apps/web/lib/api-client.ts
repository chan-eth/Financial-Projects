import type { CreateRunRequest, Run, TearsheetPayload } from "@bt/schemas";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api/proxy";

export interface RunListItem {
  id: string;
  strategyKind: string;
  symbol: string;
  timeframe: string;
  status: string;
  totalReturnPct: number | null;
  sharpe: number | null;
  maxDrawdownPct: number | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export async function listRuns(): Promise<RunListItem[]> {
  const r = await fetch(`${API_BASE}/runs`, { cache: "no-store" });
  if (!r.ok) throw new Error(`listRuns ${r.status}`);
  const { runs } = (await r.json()) as { runs: RunListItem[] };
  return runs;
}

export async function getRun(id: string): Promise<Run> {
  const r = await fetch(`${API_BASE}/runs/${id}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`getRun ${r.status}`);
  const { run } = (await r.json()) as { run: Run };
  return run;
}

export async function getTearsheet(id: string): Promise<TearsheetPayload> {
  const r = await fetch(`${API_BASE}/runs/${id}/tearsheet`, { cache: "no-store" });
  if (!r.ok) throw new Error(`getTearsheet ${r.status}`);
  return (await r.json()) as TearsheetPayload;
}

export async function createRun(body: CreateRunRequest): Promise<{ runId: string; status: string }> {
  const r = await fetch(`${API_BASE}/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`createRun ${r.status}: ${await r.text()}`);
  return (await r.json()) as { runId: string; status: string };
}
