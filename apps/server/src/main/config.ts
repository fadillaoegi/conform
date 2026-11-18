// Composition root: configuration from the environment. Production refuses to start without a signing key file and
// never allows private addresses; development makes an ephemeral key and allows loopback sites.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BadgeSigner } from "../application/ports.ts";
import { Ed25519Signer } from "../infrastructure/ed25519-signer.ts";

export interface Config {
  env: "production" | "development";
  host: string;
  port: number;
  publicOrigin: string;
  dataDir: string;
  staticDir: string | null;
  allowPrivate: boolean;
  trustProxy: boolean;
  reportCacheMs: number;
  statusCacheMs: number;
  signer: BadgeSigner;
  signerSource: string;
}

const REPO = path.resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

function number(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function loadConfig(env: Record<string, string | undefined>, overrides: Partial<Config> = {}): Promise<Config> {
  const mode = env["CONFORM_ENV"] === "production" ? "production" : "development";
  const port = overrides.port ?? number(env["CONFORM_PORT"], 8787);
  const host = overrides.host ?? env["CONFORM_HOST"] ?? "127.0.0.1";
  const publicOrigin = (overrides.publicOrigin ?? env["CONFORM_PUBLIC_ORIGIN"] ?? `http://127.0.0.1:${port}`).replace(/\/$/, "");
  if (mode === "production" && !publicOrigin.startsWith("https://")) throw new Error("CONFORM_PUBLIC_ORIGIN must be the site's https origin in production.");
  let signer: BadgeSigner;
  let signerSource: string;
  const keyFile = env["CONFORM_SIGNING_KEY_FILE"];
  if (overrides.signer) {
    signer = overrides.signer;
    signerSource = "provided";
  } else if (keyFile) {
    const resolved = path.resolve(keyFile);
    if (resolved.startsWith(`${REPO}${path.sep}`)) throw new Error("The signing key must be stored outside the repository.");
    signer = Ed25519Signer.fromPem(await readFile(resolved, "utf8"));
    signerSource = resolved;
  } else if (mode === "production") {
    throw new Error("Set CONFORM_SIGNING_KEY_FILE to the Ed25519 private key (create one with: pnpm --filter @conform/server gen-key <path outside the repo>).");
  } else {
    signer = Ed25519Signer.ephemeral();
    signerSource = "ephemeral (development only; badges will not verify after a restart)";
  }
  return {
    env: mode,
    host,
    port,
    publicOrigin,
    dataDir: overrides.dataDir ?? path.resolve(env["CONFORM_DATA_DIR"] ?? path.join(REPO, "apps/server/data")),
    staticDir: overrides.staticDir !== undefined ? overrides.staticDir : env["CONFORM_STATIC_DIR"] ? path.resolve(env["CONFORM_STATIC_DIR"]) : null,
    allowPrivate: mode === "production" ? false : overrides.allowPrivate ?? env["CONFORM_ALLOW_PRIVATE"] !== "0",
    trustProxy: overrides.trustProxy ?? env["CONFORM_TRUST_PROXY"] === "1",
    reportCacheMs: overrides.reportCacheMs ?? number(env["CONFORM_REPORT_CACHE_MS"], 600_000),
    statusCacheMs: overrides.statusCacheMs ?? number(env["CONFORM_STATUS_CACHE_MS"], 600_000),
    signer,
    signerSource,
  };
}
