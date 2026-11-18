// A scripted conversation turn for checks C7–C9. A synthetic caller site, with a random canary key
// and private-context value, runs one visitor message in the pinned reference runtime. Its scripted
// router (an OpenAI-compatible SSE stub) makes the caller hand off to the target network; the target's
// network then runs in the caller's runtime and answers. Every request is recorded with flags only:
// the canary key is never stored in a record, a finding or a report.

import { Engine } from "@conform/reference-runtime/runtime/engine.js";
import type { FetchLike } from "../fetcher.ts";
import type { JsonObject } from "../types.ts";
import { CALLER_NETWORK, CALLER_ORIGIN } from "./caller.ts";

export const ROUTER_ORIGIN = "https://router.conform-harness.invalid";
export const ROUTER = `${ROUTER_ORIGIN}/v1`;
export const PEER_ROUTER_ORIGIN = "https://peer-router.conform-harness.invalid";
export const CALLER_MARKER = "CONFORM-HARNESS-CALLER";
export const PEER_ANSWER = "PEER_ANSWER: the target network ran in the caller's browser.";
export const ALLOWED_FIELD = "conform_allowed_field";
const MODEL = "conform-scripted-model";
const TURN_TIMEOUT_MS = 30_000;

export type RequestKind = "caller" | "router" | "target" | "peer-router" | "other";

export interface TurnRequest {
  kind: RequestKind;
  origin: string;
  method: string;
  /** The path only, so a key placed in a query string never reaches a report. */
  path: string;
  hasAuthorization: boolean;
  keyInAuthorization: boolean;
  hasCookie: boolean;
  keyInUrl: boolean;
  keyInOtherHeaders: boolean;
  keyInBody: boolean;
  privateInBody: boolean;
  /** For router requests: who the scripted router decided was asking. */
  role?: "caller" | "peer";
}

export interface ConsentRecord {
  kind: string;
  peerOrigin: string;
  peerLabel: string;
  requestText: string;
  targetRequestsBefore: number;
}

export interface TurnResult {
  requests: TurnRequest[];
  consents: ConsentRecord[];
  answer: string | null;
  error: string | null;
  keyInTrace: boolean;
  privateInTrace: boolean;
  /** For each remote_call span: the private-context field names sent to the peer. */
  remotePayloadKeys: string[][];
  /** The caller's final model request saw this tool result from the peer, or null. */
  peerToolResult: string | null;
  peerRan: boolean;
}

export interface TurnOptions {
  targetBase: string;
  targetName: string;
  targetManifest: JsonObject;
  consent: "allow" | "decline";
  /** Give the caller's front agent an allow rule for ALLOWED_FIELD. */
  allowField?: boolean;
  /** Serve the target's manifest with llm_router pointing at PEER_ROUTER_ORIGIN. */
  peerRouterOverride?: boolean;
  fetch?: FetchLike;
}

function randomToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function headerEntries(init: RequestInit | undefined): Array<[string, string]> {
  const headers = init?.headers;
  if (!headers) return [];
  if (headers instanceof Headers) return [...headers.entries()];
  if (Array.isArray(headers)) return headers.map(([k, v]) => [String(k), String(v)]);
  return Object.entries(headers).map(([k, v]) => [k, String(v)]);
}

function sse(model: string, delta: Record<string, unknown>, finish: string): Response {
  const chunk = { id: "chatcmpl-conform", object: "chat.completion.chunk", model, choices: [{ index: 0, delta, finish_reason: finish }] };
  const usage = { id: "chatcmpl-conform", object: "chat.completion.chunk", model, choices: [], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
  const text = `data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(usage)}\n\ndata: [DONE]\n\n`;
  return new Response(text, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

interface ChatBody {
  model?: string;
  messages?: Array<{ role: string; content?: unknown }>;
  tools?: Array<{ function?: { name?: string; description?: string } }>;
}

/** Run one scripted visitor message. Never throws for the target's behavior; errors land in result.error. */
export async function runScriptedTurn(options: TurnOptions): Promise<TurnResult> {
  const key = `sk-conform-canary-${randomToken()}`;
  const privateValue = `conform-private-${randomToken()}`;
  const realFetch = options.fetch ?? fetch;
  const targetUrl = `${options.targetBase}/${options.targetName}`;
  const targetOrigin = new URL(options.targetBase).origin;
  const result: TurnResult = {
    requests: [], consents: [], answer: null, error: null, keyInTrace: false, privateInTrace: false,
    remotePayloadKeys: [], peerToolResult: null, peerRan: false,
  };

  const callerAgent: JsonObject = {
    name: CALLER_NETWORK,
    function: { description: "Asks the target network on behalf of Conform." },
    instructions: `${CALLER_MARKER}. You are a test caller. Hand every request to the target network.`,
    tools: [targetUrl],
  };
  if (options.allowField) callerAgent["allow"] = { to_downstream: { sly_data: [ALLOWED_FIELD] } };
  const callerNetwork = { metadata: { description: "Conform harness caller" }, tools: [callerAgent] };
  const callerManifest = {
    brand: "Conform harness caller",
    networks: [{ name: CALLER_NETWORK, front_man: CALLER_NETWORK, hocon: `./${CALLER_NETWORK}.network.json` }],
    llm_router: { base_url: ROUTER, mock: false, byok_router: ROUTER },
    allowed_peers: [targetOrigin],
    peer_policy: { mode: "closed", deny_origins: [] },
    deployment: { mode: "static" },
  };
  const servedTarget: JsonObject = { ...options.targetManifest };
  delete servedTarget["actions"];
  if (options.peerRouterOverride) {
    servedTarget["llm_router"] = { base_url: `${PEER_ROUTER_ORIGIN}/v1`, mock: false, byok_router: `${PEER_ROUTER_ORIGIN}/v1` };
  }

  const router = (body: ChatBody): { role: "caller" | "peer"; response: Response } => {
    const model = body.model ?? MODEL;
    const messages = body.messages ?? [];
    const system = messages.filter((m) => m.role === "system").map((m) => String(m.content ?? "")).join("\n");
    if (!system.includes(CALLER_MARKER)) {
      result.peerRan = true;
      return { role: "peer", response: sse(model, { role: "assistant", content: PEER_ANSWER }, "stop") };
    }
    const toolMessage = [...messages].reverse().find((m) => m.role === "tool");
    if (toolMessage) {
      result.peerToolResult = String(toolMessage.content ?? "").slice(0, 2000);
      return { role: "caller", response: sse(model, { role: "assistant", content: `CALLER_FINAL: ${result.peerToolResult.slice(0, 200)}` }, "stop") };
    }
    const handoff = (body.tools ?? []).map((t) => t.function).find((f) => f?.description?.startsWith("Hand off to the"));
    if (!handoff?.name) {
      return { role: "caller", response: sse(model, { role: "assistant", content: "CALLER_FINAL: no hand-off tool was offered." }, "stop") };
    }
    const call = { index: 0, id: "call_conform_1", type: "function", function: { name: handoff.name, arguments: JSON.stringify({ request: "What does this site offer? (Conform conformance check)" }) } };
    return { role: "caller", response: sse(model, { role: "assistant", tool_calls: [call] }, "tool_calls") };
  };

  const stub: FetchLike = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const parsed = new URL(url);
    const headers = headerEntries(init);
    const authorization = headers.find(([k]) => k.toLowerCase() === "authorization")?.[1] ?? null;
    const body = typeof init?.body === "string" ? init.body : "";
    const record: TurnRequest = {
      kind: "other",
      origin: parsed.origin,
      method: init?.method ?? "GET",
      path: parsed.pathname,
      hasAuthorization: authorization !== null,
      keyInAuthorization: authorization !== null && authorization.includes(key),
      hasCookie: headers.some(([k]) => k.toLowerCase() === "cookie"),
      keyInUrl: url.includes(key),
      keyInOtherHeaders: headers.some(([k, v]) => k.toLowerCase() !== "authorization" && v.includes(key)),
      keyInBody: body.includes(key),
      privateInBody: body.includes(privateValue),
    };
    result.requests.push(record);
    if (parsed.origin === CALLER_ORIGIN) {
      record.kind = "caller";
      if (parsed.pathname === "/agent-manifest.json") return json(callerManifest);
      if (parsed.pathname === `/${CALLER_NETWORK}.network.json`) return json(callerNetwork);
      return new Response("Not found", { status: 404 });
    }
    if (parsed.origin === ROUTER_ORIGIN) {
      record.kind = "router";
      if (record.method === "POST" && parsed.pathname === "/v1/chat/completions") {
        let parsedBody: ChatBody = {};
        try {
          parsedBody = JSON.parse(body) as ChatBody;
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const answer = router(parsedBody);
        record.role = answer.role;
        return answer.response;
      }
      return new Response("Not found", { status: 404 });
    }
    if (parsed.origin === PEER_ROUTER_ORIGIN) {
      record.kind = "peer-router";
      return new Response("The peer's router must never be used", { status: 502 });
    }
    if (parsed.origin === targetOrigin) {
      record.kind = "target";
      if (url === `${options.targetBase}/agent-manifest.json`) return json(servedTarget);
      // Pass the request through as the runtime made it (a peer network may call an MCP server on its own origin).
      const forwarded: RequestInit = { method: record.method, credentials: "omit", cache: "no-store" };
      if (init?.headers) forwarded.headers = init.headers;
      if (init?.body !== undefined && init.body !== null) forwarded.body = init.body;
      return realFetch(url, forwarded);
    }
    // Any other origin is outside this test: refuse it rather than contact it with a canary in flight.
    return new Response("Blocked by the Conform harness", { status: 502 });
  };

  const g = globalThis as { fetch: FetchLike };
  const previous = g.fetch;
  g.fetch = stub;
  const engine = new Engine({ originUrl: CALLER_ORIGIN, byokKey: key, routerOverride: ROUTER, modelOverride: MODEL });
  engine.onConsent = async (info) => {
    result.consents.push({
      kind: String(info["kind"] ?? ""),
      peerOrigin: String(info["peerOrigin"] ?? ""),
      peerLabel: String(info["peerLabel"] ?? ""),
      requestText: String(info["requestText"] ?? ""),
      targetRequestsBefore: result.requests.filter((r) => r.kind === "target").length,
    });
    return options.consent;
  };
  const slyData: Record<string, string> = { conform_private_canary: privateValue };
  if (options.allowField) slyData[ALLOWED_FIELD] = "allowed-value";
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`the turn did not finish within ${TURN_TIMEOUT_MS / 1000} s`)), TURN_TIMEOUT_MS);
    });
    try {
      const turn = (engine as unknown as { runTurn(text: string, o: { slyData: Record<string, string> }): Promise<{ text: string }> })
        .runTurn("Ask the target network what it offers.", { slyData });
      const answer = await Promise.race([turn, timeout]);
      result.answer = answer.text;
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    g.fetch = previous;
  }
  const events = engine.trace.events;
  let traceText = "";
  try {
    traceText = JSON.stringify(events);
  } catch {
    traceText = "";
  }
  result.keyInTrace = traceText.includes(key);
  result.privateInTrace = traceText.includes(privateValue);
  for (const event of events) {
    if (event["kind"] === "remote_call") {
      const payload = event["requestPayload"] as { sly_data?: Record<string, unknown> } | undefined;
      result.remotePayloadKeys.push(Object.keys(payload?.sly_data ?? {}));
    }
  }
  return result;
}
