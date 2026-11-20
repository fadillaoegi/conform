// The published package and the GitHub Action run the esbuild bundle: it must work from an empty folder
// with no node_modules and no workspace.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { startFixture } from "../../core/test/helpers/fixture-server.ts";

const exec = promisify(execFile);
const CLI = fileURLToPath(new URL("../", import.meta.url));

test("the bundled CLI runs on its own, outside the workspace", { timeout: 180_000 }, async () => {
  await exec(process.execPath, [path.join(CLI, "scripts/bundle.mjs")]);
  const dir = await mkdtemp(path.join(tmpdir(), "conform-bundle-"));
  const server = await startFixture("guesthouse_agentified");
  try {
    await cp(path.join(CLI, "dist-bundle"), dir, { recursive: true });
    const version = await exec(process.execPath, [path.join(dir, "conform.mjs"), "--version"], { cwd: dir });
    assert.match(version.stdout, /^conform 0\.1\.0/);
    const { stdout } = await exec(process.execPath, [path.join(dir, "conform.mjs"), "check", `${server.base}/tidewhistle_guesthouse`, "--no-color"], { cwd: dir });
    assert.match(stdout, /Result +PASS/);
    assert.match(stdout, /^C9 +PASS/m);
  } finally {
    await server.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
