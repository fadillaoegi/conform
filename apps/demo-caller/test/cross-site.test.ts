// End to end, across three sites: Waypoint Desk (served by serve_site.mjs) asks Conform (its own server
// process) through the conform_check network, whose agent calls Conform's MCP endpoint, which really checks
// the committee's guesthouse; then Waypoint Desk hands off to the guesthouse. One visitor turn in the pinned
// reference runtime, with a scripted router. Requests are recorded as flags; the key is never stored.
import assert from "node:assert/strict";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { after, before, test } from "node:test";
import { Engine } from "@conform/reference-runtime/runtime/engine.js";
import { startFixture, type FixtureServer } from "../../../packages/core/test/helpers/fixture-server.ts";
import { freePort } from "../../server/test/helpers.ts";

const exec = promisify(execFile);
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SERVE = path.join(ROOT, "fixtures/upstream/serve_site.mjs");
const KEY = `sk-conform-demo-canary-${crypto.randomUUID()}`;
const ROUTER_ORIGIN = "https://router.demo-test.invalid";
const ROUTER = `${ROUTER_ORIGIN}/v1`;

let guesthouse: FixtureServer;
let conform: { origin: string; child: ChildProcess };
let desk: { base: string; child: ChildProcess };
let partnerUrl: string;

function waitForLine(child: ChildProcess, pattern: RegExp): Promise<RegExpMatchArray> {
  return new Promise((resolve, reject) => {
    let out = "";
    const onData = (d: Buffer) => {
      out += d.toString();
      const m = out.match(pattern);
      if (m) resolve(m);
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("exit", (code) => reject(new Error(`exited ${code}: ${out}`)));
  });
}

before(async () => {
  guesthouse = await startFixture("guesthouse_agentified");
  partnerUrl = `${guesthouse.base}/tidewhistle_guesthouse`;
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  await exec("pnpm", ["run", "build"], { cwd: path.join(ROOT, "apps/web"), env: { ...process.env, CONFORM_PUBLIC_ORIGIN: origin } });
  const child = spawn(process.execPath, ["--conditions=conform-source", path.join(ROOT, "apps/server/src/main.ts"), "--static", path.join(ROOT, "apps/web/dist"), "--port", String(port)], {
    env: { ...process.env, CONFORM_PUBLIC_ORIGIN: origin, CONFORM_DATA_DIR: await mkdtemp(path.join(tmpdir(), "conform-demo-data-")), CONFORM_QUIET: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForLine(child, /Conform server/);
  conform = { origin, child };
  const out = await mkdtemp(path.join(tmpdir(), "waypoint-desk-"));
  await exec(process.execPath, [path.join(ROOT, "apps/demo-caller/scripts/build.mjs"), "--out", out], { env: { ...process.env, CONFORM_PUBLIC_ORIGIN: origin, DEMO_PARTNER_URL: partnerUrl } });
  const deskChild = spawn(process.execPath, [SERVE, out, "--port", "0"], { stdio: ["ignore", "pipe", "pipe"] });
  const m = await waitForLine(deskChild, /Open (http:\/\/[^\s/]+)\//);
  desk = { base: m[1] as string, child: deskChild };
});

after(async () => {
  desk?.child.kill("SIGTERM");
  conform?.child.kill("SIGTERM");
  await guesthouse?.stop();
  // The web build above used a test origin; rebuild with the default so apps/web/dist is as it was.
  await exec("pnpm", ["run", "build"], { cwd: path.join(ROOT, "apps/web") });
});

interface Recorded {
  origin: string;
  path: string;
  method: string;
  auth: boolean;
  keyElsewhere: boolean;
  mcp?: string;
}

interface ChatBody {
  messages?: Array<{ role: string; content?: unknown }>;
}

function sse(delta: Record<string, unknown>, finish: string): Response {
  const chunk = { id: "c", object: "chat.completion.chunk", model: "scripted", choices: [{ index: 0, delta, finish_reason: finish }] };
  return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, { status: 200, headers: { "content-type": "text/event-stream" } });
}
const call = (name: string, args: Record<string, unknown>) => sse({ role: "assistant", tool_calls: [{ index: 0, id: `call_${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, "tool_calls");
const say = (text: string) => sse({ role: "assistant", content: text }, "stop");

/** Who is asking, from the system prompt, and what to answer. */
function scripted(body: ChatBody): Response {
  const messages = body.messages ?? [];
  const system = messages.filter((m) => m.role === "system").map((m) => String(m.content ?? "")).join("\n");
  const tools = messages.filter((m) => m.role === "tool").map((m) => String(m.content ?? ""));
  if (system.includes("You are Conform's assistant for other agentic websites")) {
    if (tools.length === 0) {
      const user = [...messages].reverse().find((m) => m.role === "user");
      const url = String(user?.content ?? "").match(/https?:\/\/[^\s?"]+/)?.[0] ?? "";
      return call("mcp_check_site", { url });
    }
    return say(`CONFORM_SAYS: ${tools[0]!.split("\n")[0]}`);
  }
  if (system.includes("You are the assistant on the Waypoint Desk website")) {
    if (tools.length === 0) return call("conform_check", { request: `Is ${partnerUrl} conformant?` });
    if (tools[0]!.includes("The user declined")) return say(`DEMO_FINAL declined | ${tools[0]!.slice(0, 120)}`);
    if (tools.length === 1) return call("tidewhistle_guesthouse", { request: "What rooms do you offer?" });
    return say(`DEMO_FINAL | ${tools.map((t) => t.slice(0, 300)).join(" || ")}`);
  }
  return say("GUESTHOUSE_ANSWER: we offer sea-view rooms; see our page for availability.");
}

async function visitorTurn(consentFor: (origin: string) => "allow" | "decline") {
  const requests: Recorded[] = [];
  const consents: Array<{ peerOrigin: string; peerLabel: string; requestText: string; seenBefore: number }> = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const headers = Object.entries((init?.headers ?? {}) as Record<string, string>);
    const body = typeof init?.body === "string" ? init.body : "";
    const rec: Recorded = {
      origin: url.origin, path: url.pathname, method: init?.method ?? "GET",
      auth: headers.some(([k]) => k.toLowerCase() === "authorization"),
      keyElsewhere: url.href.includes(KEY) || body.includes(KEY) || headers.some(([k, v]) => k.toLowerCase() !== "authorization" && String(v).includes(KEY)),
    };
    if (url.pathname === "/mcp") {
      try {
        const rpc = JSON.parse(body) as { method?: string; params?: { name?: string } };
        rec.mcp = rpc.method === "tools/call" ? `tools/call ${rpc.params?.name}` : String(rpc.method);
      } catch { /* not JSON */ }
    }
    requests.push(rec);
    if (url.origin === ROUTER_ORIGIN) {
      return url.pathname === "/v1/chat/completions" ? scripted(JSON.parse(body) as ChatBody) : new Response("Not found", { status: 404 });
    }
    const response = await real(input, init);
    // Node cannot load action modules or bridge frames: serve every manifest without "actions", as the
    // upstream linking tests do. Browsers load the bridges (covered by the upstream Chrome checks).
    if (url.pathname.endsWith("/agent-manifest.json") && response.ok) {
      const manifest = (await response.json()) as Record<string, unknown>;
      delete manifest["actions"];
      return new Response(JSON.stringify(manifest), { status: 200, headers: { "content-type": "application/json" } });
    }
    return response;
  }) as typeof fetch;
  try {
    const engine = new Engine({ originUrl: desk.base, byokKey: KEY, routerOverride: ROUTER, modelOverride: "scripted-model" });
    engine.onConsent = async (info) => {
      const peerOrigin = String(info["peerOrigin"]);
      consents.push({ peerOrigin, peerLabel: String(info["peerLabel"]), requestText: String(info["requestText"]), seenBefore: requests.filter((r) => new URL(r.origin).host === peerOrigin).length });
      return consentFor(peerOrigin);
    };
    const result = await (engine as unknown as { runTurn(t: string): Promise<{ text: string }> }).runTurn("Is Tidewhistle Guesthouse safe to call? Check it first, then ask what rooms it offers.");
    return { text: result.text, requests, consents };
  } finally {
    globalThis.fetch = real;
  }
}

test("Waypoint Desk checks the partner with Conform (MCP, real check), then hands off; consent before each contact; the key stays with the router", { timeout: 120_000 }, async () => {
  const { text, requests, consents } = await visitorTurn(() => "allow");
  const conformHost = new URL(conform.origin).host;
  const partnerHost = new URL(partnerUrl).host;
  assert.deepEqual(consents.map((c) => [c.peerOrigin, c.peerLabel]), [[conformHost, "Conform"], [partnerHost, "Tidewhistle Guesthouse"]]);
  assert.equal(consents[0]!.seenBefore, 0, "nothing reached Conform before the visitor agreed");
  assert.equal(consents[1]!.seenBefore, 0, "nothing reached the guesthouse before the visitor agreed");
  assert.match(consents[0]!.requestText, /conformant\?$/);
  const mcp = requests.filter((r) => r.mcp).map((r) => r.mcp);
  assert.ok(mcp.includes("tools/list") && mcp.includes("tools/call check_site"), JSON.stringify(mcp));
  assert.match(text, /CONFORM_SAYS: Conform result for .*tidewhistle_guesthouse: PASS/);
  assert.match(text, /GUESTHOUSE_ANSWER/);
  const outside = requests.filter((r) => r.origin !== ROUTER_ORIGIN);
  assert.equal(outside.filter((r) => r.auth).length, 0, "no site received an Authorization header");
  assert.equal(requests.filter((r) => r.keyElsewhere).length, 0, "the key appears in no URL, other header or body");
  assert.ok(requests.filter((r) => r.origin === ROUTER_ORIGIN && r.method === "POST").every((r) => r.auth), "every model call went to the router with the key");
});

test("declining the Conform card sends nothing to Conform or the partner", { timeout: 60_000 }, async () => {
  const conformHost = new URL(conform.origin).host;
  const { text, requests, consents } = await visitorTurn((origin) => (origin === conformHost ? "decline" : "allow"));
  assert.equal(consents.length, 1);
  assert.equal(requests.filter((r) => r.origin === conform.origin).length, 0);
  assert.equal(requests.filter((r) => r.origin === new URL(partnerUrl).origin).length, 0);
  assert.match(text, /DEMO_FINAL declined \| The user declined to contact/);
});
