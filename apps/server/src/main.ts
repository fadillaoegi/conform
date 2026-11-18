// Start the Conform service. See apps/web/deploy/README.md for production settings.
//   node --conditions=conform-source apps/server/src/main.ts [--static apps/web/dist] [--port 8787]
import path from "node:path";
import { loadConfig } from "./main/config.ts";
import { startServer } from "./main/server.ts";

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const overrides: Parameters<typeof loadConfig>[1] = {};
const staticDir = option("--static");
if (staticDir) overrides.staticDir = path.resolve(staticDir);
const port = option("--port");
if (port) overrides.port = Number(port);

try {
  const config = await loadConfig(process.env, overrides);
  const running = await startServer(config);
  console.log(`Conform server (${config.env}) on ${running.url}, public origin ${config.publicOrigin}`);
  console.log(`Signing key: ${config.signerSource} (kid ${config.signer.kid}); data in ${config.dataDir}${config.staticDir ? `; serving ${config.staticDir}` : ""}`);
  if (config.allowPrivate) console.log("Private and loopback sites are allowed (development).");
  const stop = (): void => {
    void running.close().then(() => process.exit(0));
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
} catch (error) {
  console.error(`Cannot start: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
