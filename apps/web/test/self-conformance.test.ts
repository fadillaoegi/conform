// Conform must pass its own checks. Build the site, serve dist/ with the skill's serve_site.mjs
// (the headers a host must send), and check the published "conform" network.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { checkNetwork } from "@conform/core";

const WEB = fileURLToPath(new URL("../", import.meta.url));
const SERVE = path.resolve(WEB, "../../fixtures/upstream/serve_site.mjs");
const exec = promisify(execFile);

test("the built Conform site passes Conform with no fail and no warn", { timeout: 180_000 }, async () => {
  await exec("pnpm", ["run", "build"], { cwd: WEB });
  const manifest = JSON.parse(await readFile(path.join(WEB, "dist/agent-manifest.json"), "utf8"));
  assert.equal(manifest.networks[0].name, "conform");
  const child = spawn(process.execPath, [SERVE, path.join(WEB, "dist"), "--port", "0"], { stdio: ["ignore", "pipe", "pipe"] });
  try {
    const base = await new Promise<string>((resolve, reject) => {
      let out = "";
      child.stdout.on("data", (d: Buffer) => {
        out += d.toString();
        const m = out.match(/Open (http:\/\/[^\s/]+)\//);
        if (m) resolve(m[1] as string);
      });
      child.on("exit", (code) => reject(new Error(`serve_site exited ${code}`)));
    });
    const report = await checkNetwork(`${base}/conform`);
    const problems = report.checks.flatMap((c) => c.findings.filter((f) => f.status === "fail" || f.status === "warn").map((f) => `${f.id}: ${f.message}`));
    assert.deepEqual(problems, []);
    assert.equal(report.checks.length, 9);
    const page = await (await fetch(`${base}/`)).text();
    assert.match(page, /<script type="module" crossorigin src="\/assets\/index-[\w-]+\.js"><\/script>/);
    const runtime = await fetch(`${base}/runtime/index.js`);
    assert.equal(runtime.status, 200);
    const worker = await fetch(`${base}/runtime/sandbox-worker.js`);
    assert.match(worker.headers.get("content-security-policy") ?? "", /default-src 'none'/);
  } finally {
    child.kill("SIGTERM");
  }
});
