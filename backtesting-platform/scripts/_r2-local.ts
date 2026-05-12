import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Local R2 stand-in for the ingest CLIs. Writes to ./.local-r2/<key> so the
 * Node-side CLIs and the Worker (via `wrangler dev --local`) can share a flat
 * key space. Replace with the @cloudflare/r2 client (or wrangler r2 object put)
 * to push the same payloads to remote R2.
 */
export class LocalR2 {
  constructor(private readonly root = ".local-r2") {}

  async put(key: string, body: string): Promise<void> {
    const path = join(this.root, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, "utf8");
  }

  async get(key: string): Promise<string | null> {
    try {
      return await readFile(join(this.root, key), "utf8");
    } catch {
      return null;
    }
  }
}
