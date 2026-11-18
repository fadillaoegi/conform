// The committee's three agentified examples, served locally by the skill's serve_site.mjs on a
// free port, must pass every spec check (fail-free). Each harness check must reach its pass.
import assert from "node:assert/strict";
import test from "node:test";
import { checkNetwork } from "../src/index.ts";
import { FIXTURE_NETWORKS, startFixture } from "./helpers/fixture-server.ts";
import { checkStatus, failures, hasStatus } from "./helpers/report.ts";

for (const [folder, network] of Object.entries(FIXTURE_NETWORKS)) {
  test(`${folder}: ${network} has no failing finding and every harness check passes`, async () => {
    const server = await startFixture(folder);
    try {
      const report = await checkNetwork(`${server.base}/${network}`);
      assert.deepEqual(failures(report), [], "no failing findings expected");
      assert.equal(report.target.networkName, network);
      assert.equal(report.checks.map((c) => c.id).join(","), "C1,C2,C3,C4,C5,C6,C7,C8,C9");
      // C1
      assert.ok(hasStatus(report, "C1.1", "pass"));
      assert.ok(hasStatus(report, "C1.2", "pass"), "CORS on the manifest");
      assert.ok(hasStatus(report, "C1.3", "pass"));
      assert.ok(hasStatus(report, "C1.4", "info"), "loopback http is accepted as local development");
      // C2
      assert.ok(hasStatus(report, "C2.1", "pass"));
      assert.ok(hasStatus(report, "C2.2", "pass"));
      assert.ok(hasStatus(report, "C2.3", "pass"), "CORS on the definition");
      assert.ok(hasStatus(report, "C2.4", "pass"), "front_man agrees with the runtime");
      assert.ok(hasStatus(report, "C2.6", "pass"), "links.json read");
      // C3
      assert.ok(hasStatus(report, "C3.3", "pass"), "runtime validator accepts the network");
      assert.ok(hasStatus(report, "C3.5", "pass"), "data-only");
      assert.ok(hasStatus(report, "C3.8", "pass"), "no secrets");
      // C4–C6 (harness on the pinned reference runtime)
      assert.ok(hasStatus(report, "C4.1", "pass"), "missing name fails closed");
      assert.ok(hasStatus(report, "C4.2", "pass"), "exact name instantiates");
      assert.ok(hasStatus(report, "C5.1", "pass"), "cycle stops");
      assert.ok(hasStatus(report, "C5.2", "pass"), "depth stops");
      assert.ok(hasStatus(report, "C5.3", "pass"), "budgets stop");
      assert.ok(hasStatus(report, "C6.1", "pass"), "closed policy refuses");
      assert.ok(hasStatus(report, "C6.2", "pass"), "deny list refuses");
      assert.ok(hasStatus(report, "C6.3", "pass"), "own references allowed by own policy");
      // C7–C9 (scripted turn on the pinned reference runtime)
      assert.ok(hasStatus(report, "C7.1", "pass"), "key only at the caller's router");
      assert.ok(hasStatus(report, "C7.3", "pass"), "peer manifest cannot switch the router");
      assert.ok(hasStatus(report, "C7.4", "pass"), "key not in prompts or trace");
      assert.ok(hasStatus(report, "C8.1", "pass"), "no private context by default");
      assert.ok(hasStatus(report, "C8.2", "pass"), "only the allowed field");
      assert.ok(hasStatus(report, "C9.1", "pass"), "consent before contact");
      assert.ok(hasStatus(report, "C9.2", "pass"), "decline sends nothing");
      assert.ok(hasStatus(report, "C9.3", "pass"), "the page boots the runtime UI");
      assert.ok(!JSON.stringify(report).includes("sk-conform-canary"), "the canary key never reaches the report");
      assert.equal(report.summary.fail, 0);
      assert.equal(report.conform.spec.specCommit, "fd872b9221aeb8ff762b75a5badbf84b23c133cc");
      assert.ok(report.artifacts.manifest?.sha256 && report.artifacts.definition?.sha256, "artifact hashes for the badge");
    } finally {
      await server.stop();
    }
  });
}

test("a site base input checks the first listed network", async () => {
  const server = await startFixture("pizza_restaurant_agentified");
  try {
    const report = await checkNetwork(`${server.base}/`, { staticOnly: true });
    assert.equal(report.target.networkName, "pizza_restaurant_website_assistant");
    assert.ok(hasStatus(report, "C2.1", "info"));
    assert.equal(report.checks.map((c) => c.id).join(","), "C1,C2,C3");
    assert.equal(checkStatus(report, "C3"), "pass");
  } finally {
    await server.stop();
  }
});

test("a name the site does not publish fails C2.1 and stops", async () => {
  const server = await startFixture("guesthouse_agentified");
  try {
    const report = await checkNetwork(`${server.base}/tidewhistle_guesthous`);
    assert.ok(hasStatus(report, "C2.1", "fail"));
    assert.equal(report.checks.map((c) => c.id).join(","), "C1,C2");
    assert.equal(report.summary.worst, "fail");
  } finally {
    await server.stop();
  }
});
