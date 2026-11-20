// The run() function against in-memory sites (no processes, no network).
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { run, type Io } from "../src/run.ts";
import { pizzaStub } from "../../core/test/helpers/stub-site.ts";

const NET = "pizza_restaurant_website_assistant";

function capture(fetchImpl?: typeof fetch): { io: Io; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  const io: Io = { stdout: (t) => out.push(t), stderr: (t) => err.push(t), isTty: false, env: {} };
  if (fetchImpl) io.fetch = fetchImpl;
  return { io, out, err };
}

test("a conforming site exits 0 and prints a text report", async () => {
  const { site } = await pizzaStub();
  const { io, out } = capture(site.fetch());
  const code = await run(["check", `${site.base}/${NET}`], io);
  assert.equal(code, 0);
  const text = out.join("\n");
  assert.match(text, /^Conform 0\.1\.0 · spec fd872b9/);
  assert.match(text, /C4 +PASS/);
  // The pizza copy warns about actions without a bridge (C1.7); warnings do not fail by default.
  assert.match(text, /Result +WARN/);
  assert.doesNotMatch(text, /\u001b\[/, "no colors when not a terminal");
});

test("--json prints a parseable report", async () => {
  const { site } = await pizzaStub();
  const { io, out } = capture(site.fetch());
  const code = await run(["check", `${site.base}/${NET}`, "--json", "--static-only"], io);
  assert.equal(code, 0);
  const report = JSON.parse(out.join(""));
  assert.equal(report.checks.length, 3);
  assert.equal(report.conform.spec.specCommit, "fd872b9221aeb8ff762b75a5badbf84b23c133cc");
});

test("a failing site exits 1 and shows the fix", async () => {
  const { site } = await pizzaStub();
  site.strip("agent-manifest.json", "access-control-allow-origin");
  const { io, out } = capture(site.fetch());
  const code = await run(["check", `${site.base}/${NET}`, "--problems"], io);
  assert.equal(code, 1);
  const text = out.join("\n");
  assert.match(text, /✖ C1\.2/);
  assert.match(text, /fix: Serve agent-manifest\.json with Access-Control-Allow-Origin/);
  assert.doesNotMatch(text, /✔ C1\.1/, "--problems hides passes");
});

test("--fail-on warn exits 1 on a warning only", async () => {
  const { site, manifest } = await pizzaStub();
  site.put("agent-manifest.json", { ...manifest, peer_policy: { mode: "open", deny_origins: [] } });
  const failOnly = capture(site.fetch());
  assert.equal(await run(["check", `${site.base}/${NET}`, "--static-only"], failOnly.io), 0);
  const failOnWarn = capture(site.fetch());
  assert.equal(await run(["check", `${site.base}/${NET}`, "--static-only", "--fail-on", "warn"], failOnWarn.io), 1);
});

test("--out writes the JSON report", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "conform-cli-"));
  try {
    const file = path.join(dir, "report.json");
    const { site } = await pizzaStub();
    const { io, err } = capture(site.fetch());
    assert.equal(await run(["check", `${site.base}/${NET}`, "--static-only", "--out", file], io), 0);
    const report = JSON.parse(await readFile(file, "utf8"));
    assert.equal(report.target.networkName, NET);
    assert.match(err.join("\n"), /JSON report written to/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("bad usage exits 2 with the usage text", async () => {
  const { io, err } = capture();
  assert.equal(await run(["check"], io), 2);
  assert.match(err.join("\n"), /Usage: conform check <url>/);
});

test("--version names the spec commit", async () => {
  const { io, out } = capture();
  assert.equal(await run(["--version"], io), 0);
  assert.match(out.join(""), /conform 0\.1\.0 \(spec fd872b9221aeb8ff762b75a5badbf84b23c133cc/);
});

test("--color forces ANSI colors", async () => {
  const { site } = await pizzaStub();
  const { io, out } = capture(site.fetch());
  await run(["check", `${site.base}/${NET}`, "--static-only", "--color"], io);
  assert.match(out.join("\n"), /\u001b\[32m/);
});

test("--summary appends a Markdown report with the fixes", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "conform-md-"));
  try {
    const file = path.join(dir, "summary.md");
    const { site } = await pizzaStub();
    site.strip("agent-manifest.json", "access-control-allow-origin");
    const { io } = capture(site.fetch());
    assert.equal(await run(["check", `${site.base}/${NET}`, "--static-only", "--summary", file], io), 1);
    const md = await readFile(file, "utf8");
    assert.match(md, /^## ❌ Conform: FAIL for `https:\/\/pizza\.example\/pizza_restaurant_website_assistant`/);
    assert.match(md, /\| C1 Manifest.* \| ❌ fail \| C1\.2, C1\.7 \|/);
    assert.match(md, /- ❌ \*\*C1\.2\*\* .*<br>Fix: Serve agent-manifest\.json with Access-Control-Allow-Origin/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
