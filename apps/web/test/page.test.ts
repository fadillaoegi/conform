// The page object behind both the form and the assistant's website_* actions.
import assert from "node:assert/strict";
import test from "node:test";
import type { CheckOptions, Report } from "@conform/core";
import { checkNetwork } from "@conform/core";
import { compactReport, ConformPage } from "../src/page.ts";
import { pizzaStub } from "../../../packages/core/test/helpers/stub-site.ts";

const NET = "pizza_restaurant_website_assistant";

async function pageWithStub(mutate?: (site: Awaited<ReturnType<typeof pizzaStub>>["site"]) => void) {
  const stub = await pizzaStub();
  mutate?.(stub.site);
  let now = 1_000_000;
  const page = new ConformPage({
    checker: (input: string, options?: CheckOptions) => checkNetwork(input, { ...options, fetch: stub.site.fetch() }),
    now: () => now,
  });
  return { page, stub, advance: (ms: number) => (now += ms) };
}

test("check() runs every automated check, reports progress and keeps the report", async () => {
  const { page } = await pageWithStub();
  const seen: number[] = [];
  page.subscribe((s) => seen.push(s.progress.length));
  const result = await page.check(`https://pizza.example/${NET}`);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.checks.map((c) => c.id), ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"]);
  assert.ok(seen.includes(9) && seen.includes(1), "progress went from 1 to 9");
  assert.equal(page.state.running, false);
  assert.ok(page.state.report);
  assert.ok(result.notAutomated.includes("C10 Runtime fingerprint"));
});

test("validate() refuses empty, malformed and repeated input without contacting anything", async () => {
  const { page, stub, advance } = await pageWithStub();
  assert.equal(page.validate("").ok, false);
  assert.equal(page.validate("ftp://x.example/a").ok, false);
  assert.equal(stub.site.requests.length, 0);
  await page.check(`https://pizza.example/${NET}`);
  const again = await page.check(`https://pizza.example/${NET}`);
  assert.equal(again.ok, false);
  if (!again.ok) assert.match(again.reason, /checked a moment ago/);
  advance(6_000);
  assert.equal((await page.check(`https://pizza.example/${NET}`)).ok, true);
});

test("a failing site's compact report carries the fix and the spec section", async () => {
  const { page } = await pageWithStub((site) => site.strip("agent-manifest.json", "access-control-allow-origin"));
  const result = await page.check(`https://pizza.example/${NET}`);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.result, "fail");
  const c1 = result.checks.find((c) => c.id === "C1");
  const cors = c1?.problems.find((p) => p.id === "C1.2");
  assert.ok(cors?.fix?.includes("Access-Control-Allow-Origin"));
  assert.ok(cors?.spec.includes("§3.4"));
});

test("compact reports stay small and drop passing findings", async () => {
  const { page } = await pageWithStub();
  await page.check(`https://pizza.example/${NET}`);
  const compact = compactReport(page.state.report as Report);
  assert.ok(JSON.stringify(compact).length < 6000, "fits easily in a prompt");
  assert.ok(compact.checks.every((c) => c.problems.every((p) => p.status !== "pass")));
});

test("explain() answers check and finding ids and refuses unknown ones", async () => {
  const { page } = await pageWithStub((site) => site.strip("agent-manifest.json", "access-control-allow-origin"));
  await page.check(`https://pizza.example/${NET}`);
  const byCheck = page.explain("c1") as { ok: boolean; check: { id: string }; findingsInCurrentReport: Array<{ id: string }> };
  assert.equal(byCheck.ok, true);
  assert.equal(byCheck.check.id, "C1");
  assert.ok(byCheck.findingsInCurrentReport.length > 1);
  const byFinding = page.explain("C1.2") as { findingsInCurrentReport: Array<{ id: string; status: string }> };
  assert.deepEqual(byFinding.findingsInCurrentReport.map((f) => f.id), ["C1.2"]);
  assert.equal(page.explain("Z9").ok, false);
  const planned = page.explain("C12") as { check: { automated: boolean } };
  assert.equal(planned.check.automated, false);
});

test("getState() is plain JSON", async () => {
  const { page } = await pageWithStub();
  await page.check(`https://pizza.example/${NET}`);
  const state = page.getState();
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  assert.equal((state["report"] as { result: string }).result, "warn");
});
