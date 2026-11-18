import { createServer } from "node:net";
import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Ed25519Signer } from "../src/infrastructure/ed25519-signer.ts";
import { loadConfig, type Config } from "../src/main/config.ts";
import { startServer, type ConformServer } from "../src/main/server.ts";
import { FIXTURES } from "../../../packages/core/test/helpers/fixture-server.ts";

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const address = s.address();
      const port = typeof address === "object" && address ? address.port : 0;
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });
}

export async function tempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix));
}

/** A writable copy of one fixture site, so a test can change its files. */
export async function fixtureCopy(name: string): Promise<string> {
  const dir = await tempDir("conform-site-");
  await cp(path.join(FIXTURES, name), dir, { recursive: true });
  return dir;
}

export async function startTestServer(overrides: Partial<Config> = {}): Promise<ConformServer & { config: Config }> {
  process.env["CONFORM_QUIET"] = "1";
  const port = overrides.port ?? (await freePort());
  const config = await loadConfig({}, {
    port,
    host: "127.0.0.1",
    publicOrigin: `http://127.0.0.1:${port}`,
    dataDir: await tempDir("conform-data-"),
    staticDir: null,
    allowPrivate: true,
    reportCacheMs: 0,
    statusCacheMs: 0,
    signer: Ed25519Signer.ephemeral(),
    ...overrides,
  });
  const running = await startServer(config);
  return { ...running, config };
}
