// C7–C9 against the pizza stub site, including a page that never wires consent.
import assert from "node:assert/strict";
import test from "node:test";
import { checkNetwork } from "../src/index.ts";
import { runScriptedTurn } from "../src/harness/turn.ts";
import { pizzaStub } from "./helpers/stub-site.ts";
import { findings, hasStatus } from "./helpers/report.ts";

const NET = "pizza_restaurant_website_assistant";

test("the scripted turn records flags only, never the key", async () => {
  const { site, manifest } = await pizzaStub();
  const turn = await runScriptedTurn({ targetBase: site.base, targetName: NET, targetManifest: manifest, consent: "allow", fetch: site.fetch() });
  assert.equal(turn.error, null);
  assert.equal(turn.peerRan, true);
  assert.ok(!JSON.stringify(turn).includes("sk-conform-canary"));
  assert.deepEqual(turn.requests.filter((r) => r.kind === "target").map((r) => r.path), ["/agent-manifest.json", "/pizza_restaurant_website_assistant.network.json", "/links.json"]);
});

test("C7–C9 pass on the stub site; C9.3 is info when the page cannot be read", async () => {
  const { site } = await pizzaStub();
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch() });
  for (const id of ["C7.1", "C7.2", "C7.3", "C7.4", "C8.1", "C8.2", "C9.1", "C9.2"]) assert.ok(hasStatus(report, id, "pass"), id);
  assert.ok(hasStatus(report, "C9.3", "info"), "no index.html on the stub");
  assert.equal(report.summary.fail, 0);
});

test("C9.3 warns when the page loads a runtime without any consent wiring", async () => {
  const { site } = await pizzaStub();
  site.put("/", '<!doctype html><script type="module" src="./app.js"></script>', { headers: { "content-type": "text/html" } });
  site.put("app.js", "console.log('chat without consent');", { headers: { "content-type": "text/javascript" } });
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch() });
  const c93 = findings(report, "C9.3")[0];
  assert.equal(c93?.status, "warn");
  assert.deepEqual((c93?.evidence as { scannedScripts: string[] }).scannedScripts, ["/app.js"]);
});

test("C9.3 follows a dynamic import one level down", async () => {
  const { site } = await pizzaStub();
  site.put("/", '<!doctype html><script type="module" src="/assets/index.js"></script>', { headers: { "content-type": "text/html" } });
  site.put("assets/index.js", 'const load = () => import("./assistant.js");', { headers: { "content-type": "text/javascript" } });
  site.put("assets/assistant.js", 'const { boot } = await import(new URL("runtime/index.js", base).href); await boot("#app", {});', { headers: { "content-type": "text/javascript" } });
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch() });
  assert.ok(hasStatus(report, "C9.3", "pass"));
});

test("an invalid network makes C7–C9 untestable, never pass", async () => {
  const { site, definition } = await pizzaStub();
  const tools = structuredClone(definition["tools"]) as Array<{ tools?: string[] }>;
  tools[0]?.tools?.push("ghost_specialist");
  site.put(`${NET}.network.json`, { ...definition, tools });
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch() });
  assert.ok(hasStatus(report, "C7.1", "untestable"));
  assert.ok(hasStatus(report, "C8.1", "untestable"));
  assert.ok(!hasStatus(report, "C7.1", "pass"));
});
