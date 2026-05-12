export function parseArgs(argv: ReadonlyArray<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith("--")) {
      out[key] = "true";
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

export function getNumber(args: Record<string, string>, key: string, def: number): number {
  const v = args[key];
  if (v == null) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function getString(args: Record<string, string>, key: string, def: string): string {
  return args[key] ?? def;
}
