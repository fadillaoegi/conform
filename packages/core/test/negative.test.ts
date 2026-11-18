// Mutated copies of the pizza site, served from memory, must produce the specific failing findings.
import assert from "node:assert/strict";
import test from "node:test";
import { checkNetwork } from "../src/index.ts";
import { pizzaStub, StubSite } from "./helpers/stub-site.ts";
import { findings, hasStatus } from "./helpers/report.ts";

const NET = "pizza_restaurant_website_assistant";

test("baseline stub site passes with no failing finding", async () => {
  const { site } = await pizzaStub();
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch() });
  assert.equal(report.summary.fail, 0, JSON.stringify(findings(report, "C4.2")));
  assert.ok(hasStatus(report, "C1.4", "pass"), "https base");
  assert.ok(hasStatus(report, "C4.2", "pass"));
  assert.ok(hasStatus(report, "C6.1", "pass"));
});

test("C1.1: a missing manifest fails and nothing else runs", async () => {
  const site = new StubSite("https://empty.example");
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch() });
  assert.ok(hasStatus(report, "C1.1", "fail"));
  assert.equal(report.checks.length, 1);
});

test("C1.1: invalid JSON fails", async () => {
  const { site } = await pizzaStub();
  site.put("agent-manifest.json", "{ not json");
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch() });
  assert.ok(hasStatus(report, "C1.1", "fail"));
});

test("C1.2: a manifest without a CORS header fails for other origins", async () => {
  const { site } = await pizzaStub();
  site.strip("agent-manifest.json", "access-control-allow-origin");
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch(), staticOnly: true });
  assert.ok(hasStatus(report, "C1.2", "fail"));
  assert.ok(hasStatus(report, "C2.3", "pass"), "the definition still has its header");
});

test("C1.2: a CORS header that names another origin fails", async () => {
  const { site } = await pizzaStub();
  site.put("agent-manifest.json", (await pizzaStub()).manifest, { headers: { "access-control-allow-origin": "https://someone-else.example" } });
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch(), staticOnly: true });
  assert.ok(hasStatus(report, "C1.2", "fail"));
});

test("C1.3: missing llm_router and peer policy fail", async () => {
  const { site, manifest } = await pizzaStub();
  const broken = { ...manifest };
  delete broken["llm_router"];
  delete broken["peer_policy"];
  delete broken["allowed_peers"];
  site.put("agent-manifest.json", broken);
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch(), staticOnly: true });
  const messages = findings(report, "C1.3").filter((f) => f.status === "fail").map((f) => f.message);
  assert.ok(messages.some((m) => m.includes("llm_router")));
  assert.ok(messages.some((m) => m.includes("peer policy")));
});

test("C1.4: a plain-http site on a public host fails", async () => {
  const { site } = await pizzaStub("http://pizza.example");
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch(), staticOnly: true });
  assert.ok(hasStatus(report, "C1.4", "fail"));
});

test("C1.5: a manifest that redirects to another origin fails", async () => {
  const { site } = await pizzaStub();
  site.redirect("agent-manifest.json", "https://elsewhere.example/agent-manifest.json");
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch() });
  assert.ok(hasStatus(report, "C1.5", "fail"));
  assert.equal(report.checks.length, 1);
});

test("C2.1: an unpublished network name fails closed", async () => {
  const { site } = await pizzaStub();
  const report = await checkNetwork(`${site.base}/Pizza_Restaurant_Website_Assistant`, { fetch: site.fetch() });
  assert.ok(hasStatus(report, "C2.1", "fail"), "case must match exactly");
  assert.equal(report.checks.length, 2);
});

test("C2.2: a definition that does not parse fails", async () => {
  const { site } = await pizzaStub();
  site.put(`${NET}.network.json`, "{ tools: [ {");
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch() });
  assert.ok(hasStatus(report, "C2.2", "fail"));
});

test("C2.4: a front_man the runtime would not run fails", async () => {
  const { site, manifest } = await pizzaStub();
  const networks = manifest["networks"] as Array<Record<string, unknown>>;
  site.put("agent-manifest.json", { ...manifest, networks: [{ ...networks[0], front_man: "menu_specialist" }] });
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch(), staticOnly: true });
  const fm = findings(report, "C2.4");
  assert.equal(fm[0]?.status, "fail");
  assert.match(fm[0]?.message ?? "", /front_desk_coordinator/);
});

test("C2.6: links.json without CORS fails", async () => {
  const { site } = await pizzaStub();
  site.strip("links.json", "access-control-allow-origin");
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch(), staticOnly: true });
  assert.ok(hasStatus(report, "C2.6", "fail"));
});

test("C3.3 and C4.2: a missing tool reference fails statically and the caller's runtime refuses it", async () => {
  const { site, definition } = await pizzaStub();
  const tools = structuredClone(definition["tools"]) as Array<Record<string, unknown>>;
  (tools[0] as { tools: string[] }).tools.push("ghost_specialist");
  site.put(`${NET}.network.json`, { ...definition, tools });
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch() });
  assert.ok(hasStatus(report, "C3.3", "fail"));
  assert.ok(hasStatus(report, "C4.2", "fail"));
  assert.match(findings(report, "C4.2")[0]?.message ?? "", /failed validation/);
  assert.ok(hasStatus(report, "C4.1", "pass"), "the missing-name path still fails closed");
});

test("C3.1: duplicate agent names fail", async () => {
  const { site, definition } = await pizzaStub();
  const tools = structuredClone(definition["tools"]) as Array<Record<string, unknown>>;
  tools.push({ ...tools[1] });
  site.put(`${NET}.network.json`, { ...definition, tools });
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch(), staticOnly: true });
  assert.ok(hasStatus(report, "C3.1", "fail"));
});

test("C3.5: an environment substitution in the published definition fails", async () => {
  const { site, definition } = await pizzaStub();
  site.put(`${NET}.network.json`, { ...definition, instructions_prefix: "Use the API at ${API_URL} for orders." });
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch(), staticOnly: true });
  assert.ok(hasStatus(report, "C3.5", "fail"));
});

test("C3.5: a HOCON include directive fails", async () => {
  const { site } = await pizzaStub();
  site.put(`${NET}.network.json`, 'include "aaosa.hocon"\n{ "tools": [ { "name": "a", "instructions": "x", "function": { "description": "d" } } ] }');
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch(), staticOnly: true });
  // The reference parser rejects the directive, so C2.2 fails; or, if parsed, C3.5 must.
  assert.ok(hasStatus(report, "C2.2", "fail") || hasStatus(report, "C3.5", "fail"));
});

test("C3.8: a credential in a public artifact fails and is masked", async () => {
  const { site, manifest } = await pizzaStub();
  const leaked = "sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  site.put("agent-manifest.json", { ...manifest, llm_router: { ...(manifest["llm_router"] as object), api_key: leaked } });
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch(), staticOnly: true });
  const hits = findings(report, "C3.8").filter((f) => f.status === "fail");
  assert.ok(hits.length >= 1);
  assert.ok(!JSON.stringify(report).includes(leaked), "the report must never contain the secret");
});

test("C6.3: a peer reference outside the site's own allowed_peers fails", async () => {
  const { site, definition } = await pizzaStub();
  const tools = structuredClone(definition["tools"]) as Array<Record<string, unknown>>;
  (tools[0] as { tools: string[] }).tools.push("https://partner.example/partner_network");
  site.put(`${NET}.network.json`, { ...definition, tools });
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch() });
  assert.ok(hasStatus(report, "C6.3", "fail"));
  assert.ok(hasStatus(report, "C4.2", "pass"), "the network itself still loads");
});

test("C6.3: a peer reference listed in allowed_peers passes", async () => {
  const { site, manifest, definition } = await pizzaStub();
  const tools = structuredClone(definition["tools"]) as Array<Record<string, unknown>>;
  (tools[0] as { tools: string[] }).tools.push("https://partner.example/partner_network");
  site.put(`${NET}.network.json`, { ...definition, tools });
  site.put("agent-manifest.json", { ...manifest, allowed_peers: ["https://partner.example"] });
  const report = await checkNetwork(`${site.base}/${NET}`, { fetch: site.fetch() });
  assert.ok(hasStatus(report, "C6.3", "pass"));
});
