// A synthetic caller site for the harness checks. The pinned reference runtime (Engine) is loaded in
// this process with a stub global fetch: the caller's own artifacts come from memory, the target
// site's artifacts pass through to the real fetch (recorded), and nothing else is reachable.
// No model is ever called: the caller publishes the runtime's deterministic mock router and the
// checks exercise resolution, policy and limits, which happen before any model request.

import { Engine } from "@conform/reference-runtime/runtime/engine.js";
import type { FetchLike } from "../fetcher.ts";
import type { JsonObject } from "../types.ts";

export const CALLER_ORIGIN = "https://conform-caller.invalid";
export const CALLER_NETWORK = "conform_caller";

export interface RecordedRequest {
  url: string;
  method: string;
  origin: string;
  hasAuthorization: boolean;
  hasCookie: boolean;
  /** "caller" for in-memory answers, "target" for the target origin, "other" for any other origin (passed through and reported). */
  served: "caller" | "target" | "other";
}

export interface CallerPolicy {
  mode: "open" | "closed";
  allowedPeers: string[];
  denyOrigins?: string[];
}

export interface HarnessOptions {
  /** The target site base (folder holding agent-manifest.json) and network name. */
  targetBase: string;
  targetName: string;
  /** The target's manifest as fetched; `actions` is stripped so no bridge frame is needed. */
  targetManifest: JsonObject;
  policy: CallerPolicy;
  fetch?: FetchLike;
}

export interface Harness {
  engine: Engine;
  callerManifest: JsonObject;
  callerKey: string;
  requests: RecordedRequest[];
  /** Requests recorded since the last mark(). */
  since(mark: number): RecordedRequest[];
  mark(): number;
  restore(): void;
}

function callerManifestFor(policy: CallerPolicy, targetUrl: string): JsonObject {
  return {
    brand: "Conform harness caller",
    networks: [{ name: CALLER_NETWORK, front_man: CALLER_NETWORK, hocon: `./${CALLER_NETWORK}.network.json` }],
    llm_router: { base_url: "browser://mock", mock: true },
    allowed_peers: policy.allowedPeers,
    peer_policy: { mode: policy.mode, deny_origins: policy.denyOrigins ?? [] },
    deployment: { mode: "static" },
    conform: { note: `synthetic caller for ${targetUrl}` },
  };
}

function callerNetworkFor(targetUrl: string): JsonObject {
  return {
    metadata: { description: "Conform harness caller network" },
    tools: [
      {
        name: CALLER_NETWORK,
        function: { description: "Asks the target network on behalf of Conform." },
        instructions: "You are a test caller. Hand every request to the target network.",
        tools: [targetUrl],
      },
    ],
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function hasHeader(init: RequestInit | undefined, name: string): boolean {
  const headers = init?.headers;
  if (!headers) return false;
  if (headers instanceof Headers) return headers.has(name);
  if (Array.isArray(headers)) return headers.some(([k]) => k.toLowerCase() === name.toLowerCase());
  return Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase());
}

/**
 * Install the stub fetch, load the caller's own network into a fresh Engine, and return the harness.
 * Always call restore() when done (withHarness does).
 */
export async function startHarness(options: HarnessOptions): Promise<Harness> {
  const realFetch = options.fetch ?? fetch;
  const targetUrl = `${options.targetBase}/${options.targetName}`;
  const targetOrigin = new URL(options.targetBase).origin;
  const callerManifest = callerManifestFor(options.policy, targetUrl);
  const callerNetwork = callerNetworkFor(targetUrl);
  const strippedManifest: JsonObject = { ...options.targetManifest };
  delete strippedManifest["actions"];
  const requests: RecordedRequest[] = [];

  const stub: FetchLike = async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    // Record the URL as a browser sends it ("./" segments resolved).
    const url = new URL(raw).href;
    const method = init?.method ?? "GET";
    const origin = new URL(url).origin;
    const record: RecordedRequest = {
      url,
      method,
      origin,
      hasAuthorization: hasHeader(init, "authorization"),
      hasCookie: hasHeader(init, "cookie"),
      served: "other",
    };
    requests.push(record);
    if (origin === CALLER_ORIGIN) {
      record.served = "caller";
      const path = new URL(url).pathname;
      if (path === "/agent-manifest.json") return jsonResponse(callerManifest);
      if (path === `/${CALLER_NETWORK}.network.json`) return jsonResponse(callerNetwork);
      return new Response("Not found", { status: 404 });
    }
    if (origin === targetOrigin) {
      record.served = "target";
      if (url === `${options.targetBase}/agent-manifest.json`) return jsonResponse(strippedManifest);
      return realFetch(url, { ...init, credentials: "omit" });
    }
    // Another origin: a definition hosted elsewhere (allowed by §3.2.6), or an unrelated request from the
    // page while a check runs in a browser. Pass it through and report it.
    return realFetch(input, init);
  };

  const g = globalThis as { fetch: FetchLike };
  const previous = g.fetch;
  g.fetch = stub;
  const engine = new Engine({ originUrl: CALLER_ORIGIN });
  try {
    await engine.loadTop();
  } catch (error) {
    g.fetch = previous;
    throw error;
  }
  return {
    engine,
    callerManifest,
    callerKey: `${CALLER_ORIGIN}::${CALLER_NETWORK}`,
    requests,
    mark: () => requests.length,
    since: (mark: number) => requests.slice(mark),
    restore: () => {
      g.fetch = previous;
    },
  };
}

export async function withHarness<T>(options: HarnessOptions, run: (harness: Harness) => Promise<T>): Promise<T> {
  const harness = await startHarness(options);
  try {
    return await run(harness);
  } finally {
    harness.restore();
  }
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function errorCode(error: unknown): string | null {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" ? code : null;
}
