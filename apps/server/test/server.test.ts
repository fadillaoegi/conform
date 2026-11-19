// The Conform service end to end, against the committee's examples served by serve_site.mjs.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { after, before, test } from "node:test";
import { McpClient } from "@conform/reference-runtime/runtime/mcp.js";
import { checkNetwork } from "@conform/core";
import { verifyBadge as verifyInBrowser } from "../../web/src/verify.ts";
import { startFixture, type FixtureServer } from "../../../packages/core/test/helpers/fixture-server.ts";
import { fixtureCopy, freePort, startTestServer } from "./helpers.ts";
import { spawn } from "node:child_process";

const exec = promisify(execFile);
const WEB = fileURLToPath(new URL("../../web/", import.meta.url));
const SERVE = fileURLToPath(new URL("../../../fixtures/upstream/serve_site.mjs", import.meta.url));

let guesthouse: FixtureServer;
let service: Awaited<ReturnType<typeof startTestServer>>;

before(async () => {
  guesthouse = await startFixture("guesthouse_agentified");
  service = await startTestServer();
});
after(async () => {
  await service.close();
  await guesthouse.stop();
});

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${service.url}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

async function serveFolder(folder: string): Promise<{ base: string; stop: () => void }> {
  const child = spawn(process.execPath, [SERVE, folder, "--port", "0"], { stdio: ["ignore", "pipe", "pipe"] });
  const base = await new Promise<string>((resolve, reject) => {
    let out = "";
    child.stdout.on("data", (d: Buffer) => {
      out += d.toString();
      const m = out.match(/Open (http:\/\/[^\s/]+)\//);
      if (m) resolve(m[1] as string);
    });
    child.on("exit", (c) => reject(new Error(`serve_site exited ${c}`)));
  });
  return { base, stop: () => child.kill("SIGTERM") };
}

test("health and the public key are open to every origin", async () => {
  const health = await fetch(`${service.url}/api/health`);
  assert.equal(health.status, 200);
  assert.equal(((await health.json()) as { ok: boolean }).ok, true);
  const key = await fetch(`${service.url}/.well-known/conform-badge-key.json`, { headers: { origin: "https://elsewhere.example" } });
  assert.equal(key.headers.get("access-control-allow-origin"), "*");
  const set = (await key.json()) as { keys: Array<{ kty: string; crv: string; kid: string }> };
  assert.equal(set.keys[0]?.crv, "Ed25519");
  const preflight = await fetch(`${service.url}/mcp`, { method: "OPTIONS" });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /mcp-protocol-version/);
});

test("a conforming site gets a signed badge that verifies in the browser code, an SVG and a directory entry", async () => {
  const url = `${guesthouse.base}/tidewhistle_guesthouse`;
  const response = await post("/api/badges", { url });
  assert.equal(response.status, 201);
  const badge = (await response.json()) as Parameters<typeof verifyInBrowser>[0] & { state: string; links: { svg: string } };
  assert.equal(badge.state, "valid");
  assert.equal(badge.payload.result, "pass");
  assert.deepEqual(Object.values(badge.payload.checks), Array(9).fill("pass"));
  const keys = (await (await fetch(`${service.url}/.well-known/conform-badge-key.json`)).json()) as Parameters<typeof verifyInBrowser>[1];
  const steps = await verifyInBrowser(badge, keys, service.config.publicOrigin);
  assert.deepEqual(steps.filter((s) => s.status !== "pass"), [], JSON.stringify(steps));
  const svg = await (await fetch(new URL(badge.links.svg).pathname.replace(/^/, service.url))).text();
  assert.match(svg, /MVP 0\.2 PASS/);
  const directory = (await (await fetch(`${service.url}/api/directory`)).json()) as { sites: Array<{ network: string; brand: string }> };
  assert.ok(directory.sites.some((s) => s.network === url && s.brand === "Tidewhistle Guesthouse Assistant"));
});

test("a badge turns stale when the site's network file changes", async () => {
  const dir = await fixtureCopy("pizza_restaurant_agentified");
  const site = await serveFolder(dir);
  try {
    const response = await post("/api/badges", { url: `${site.base}/pizza_restaurant_website_assistant` });
    assert.equal(response.status, 201);
    const badge = (await response.json()) as { id: string; payload: { result: string } };
    assert.equal(badge.payload.result, "warn", "the pizza example warns about its missing actions.bridge");
    const file = path.join(dir, "pizza_restaurant_website_assistant.network.json");
    const definition = JSON.parse(await readFile(file, "utf8"));
    definition.metadata.description = "changed after the badge";
    await writeFile(file, JSON.stringify(definition));
    const view = (await (await fetch(`${service.url}/api/badges/${badge.id}`)).json()) as { state: string };
    assert.equal(view.state, "stale");
    assert.match(await (await fetch(`${service.url}/badges/${badge.id}.svg`)).text(), /STALE/);
  } finally {
    site.stop();
  }
});

test("a failing site gets no badge, with the reason", async () => {
  const response = await post("/api/badges", { url: `${guesthouse.base}/no_such_network` });
  assert.equal(response.status, 422);
  const body = (await response.json()) as { refused: string; report: { result: string } };
  assert.match(body.refused, /failing finding/);
  assert.equal(body.report.result, "fail");
});

test("other sites' runtimes can call the MCP endpoint (reference runtime MCP client)", async () => {
  const client = new McpClient({ url: `${service.url}/mcp` });
  const tools = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name), ["check_site", "badge_status", "explain_check"]);
  const url = `${guesthouse.base}/tidewhistle_guesthouse`;
  const check = await client.callTool("check_site", { url });
  assert.match(check, /Conform result for .*tidewhistle_guesthouse: PASS/);
  const status = await client.callTool("badge_status", { url });
  assert.match(status, /PASS, state valid/);
  assert.match(await client.callTool("explain_check", { id: "C7.1" }), /^C7 Key never leaves \(automated/);
  assert.match(await client.callTool("explain_check", { id: "C2.4" }), /C2\.4 fails when: .*first entry in tools\[\].* Fix: .*first in tools\[\]/s);
  assert.match(await client.callTool("check_site", { url: "not a url" }), /^MCP tool error: /);
});

test("the public mode refuses private and plain-http targets (SSRF guard)", async () => {
  const strict = await startTestServer({ allowPrivate: false });
  try {
    const response = await fetch(`${strict.url}/api/check`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: `${guesthouse.base}/tidewhistle_guesthouse` }) });
    assert.equal(response.status, 400);
    assert.match(((await response.json()) as { error: string }).error, /HTTPS sites only/);
    for (const url of ["https://169.254.169.254/latest/meta-data", "https://localhost/agents/x", "https://10.0.0.5/x"]) {
      const r = await fetch(`${strict.url}/api/check`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      assert.equal(r.status, 400, url);
    }
    const mcp = await new McpClient({ url: `${strict.url}/mcp` }).callTool("check_site", { url: "https://127.0.0.1/x" });
    assert.match(mcp, /^MCP tool error: That address is private or reserved/);
  } finally {
    await strict.close();
  }
});

test("badge requests are rate limited per client", async () => {
  const limited = await startTestServer();
  try {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const r = await fetch(`${limited.url}/api/badges`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "ftp://x" }) });
      statuses.push(r.status);
    }
    assert.deepEqual(statuses, [400, 400, 400, 400, 429]);
  } finally {
    await limited.close();
  }
});

test("Conform's own site, served by this server, passes both of its networks (conform_check calls this /mcp)", { timeout: 240_000 }, async () => {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  await exec("pnpm", ["run", "build"], { cwd: WEB, env: { ...process.env, CONFORM_PUBLIC_ORIGIN: origin } });
  const site = await startTestServer({ port, publicOrigin: origin, staticDir: path.join(WEB, "dist") });
  try {
    const page = await fetch(`${origin}/`);
    assert.match(page.headers.get("content-security-policy") ?? "", /connect-src 'self' https:/);
    for (const network of ["conform", "conform_check"]) {
      const report = await checkNetwork(`${origin}/${network}`);
      const problems = report.checks.flatMap((c) => c.findings.filter((f) => f.status === "fail" || f.status === "warn" || f.status === "untestable").map((f) => `${f.id}: ${f.message}`));
      assert.deepEqual(problems, [], network);
      assert.equal(report.checks.length, 9);
    }
  } finally {
    await site.close();
  }
});
