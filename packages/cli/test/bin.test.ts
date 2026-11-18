// End to end: the real `conform` binary against the committee's examples served by serve_site.mjs.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { FIXTURE_NETWORKS, startFixture } from "../../core/test/helpers/fixture-server.ts";

const BIN = fileURLToPath(new URL("../src/bin.ts", import.meta.url));
const exec = promisify(execFile);

async function conform(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await exec(process.execPath, ["--conditions=conform-source", BIN, ...args], { env: { ...process.env, NO_COLOR: "1" } });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

for (const [folder, network] of Object.entries(FIXTURE_NETWORKS)) {
  test(`conform check ${network} exits 0`, async () => {
    const server = await startFixture(folder);
    try {
      const { code, stdout } = await conform(["check", `${server.base}/${network}`]);
      assert.equal(code, 0, stdout);
      assert.doesNotMatch(stdout, /FAIL/);
      for (const id of ["C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"]) assert.match(stdout, new RegExp(`^${id} +PASS`, "m"));
      if (folder === "pizza_restaurant_agentified") {
        // The pizza example declares actions without actions.bridge: a real finding, reported as a warning.
        assert.match(stdout, /^C1 +WARN/m);
        assert.match(stdout, /▲ C1\.7 +actions is declared without actions\.bridge/);
        assert.match(stdout, /Result +WARN/);
      } else {
        assert.match(stdout, /^C1 +PASS/m);
        assert.match(stdout, /Result +PASS/);
      }
    } finally {
      await server.stop();
    }
  });
}

test("a wrong network name exits 1", async () => {
  const server = await startFixture("pizza_restaurant_agentified");
  try {
    const { code, stdout } = await conform(["check", `${server.base}/pizza`, "--problems"]);
    assert.equal(code, 1);
    assert.match(stdout, /✖ C2\.1 +The manifest lists no network named "pizza"/);
  } finally {
    await server.stop();
  }
});

test("an unreachable site exits 1, not 2", async () => {
  const { code, stdout } = await conform(["check", "http://127.0.0.1:9/nothing", "--timeout", "2000"]);
  assert.equal(code, 1);
  assert.match(stdout, /C1\.1 +agent-manifest\.json cannot be fetched/);
});
