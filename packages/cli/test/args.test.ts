import assert from "node:assert/strict";
import test from "node:test";
import { parseArgs } from "../src/args.ts";

test("check with defaults", () => {
  const a = parseArgs(["check", "https://site.example/net"]);
  assert.equal(a.command, "check");
  if (a.command !== "check") return;
  assert.equal(a.url, "https://site.example/net");
  assert.equal(a.json, false);
  assert.equal(a.failOn, "fail");
  assert.equal(a.color, null);
});

test("every option parses", () => {
  const a = parseArgs([
    "check", "https://site.example/net", "--json", "--out", "r.json", "--static-only",
    "--origin", "https://me.example/path", "--timeout", "500", "--fail-on", "warn",
    "--evidence", "--problems", "--no-color",
  ]);
  if (a.command !== "check") return assert.fail("expected check");
  assert.deepEqual(
    { json: a.json, out: a.out, staticOnly: a.staticOnly, origin: a.origin, timeoutMs: a.timeoutMs, failOn: a.failOn, evidence: a.evidence, problemsOnly: a.problemsOnly, color: a.color },
    { json: true, out: "r.json", staticOnly: true, origin: "https://me.example", timeoutMs: 500, failOn: "warn", evidence: true, problemsOnly: true, color: false },
  );
});

test("help and version", () => {
  assert.equal(parseArgs(["--help"]).command, "help");
  assert.equal(parseArgs(["check", "x", "-h"]).command, "help");
  assert.equal(parseArgs(["-v"]).command, "version");
});

test("bad usage throws", () => {
  for (const argv of [[], ["inspect", "x"], ["check"], ["check", "a", "b"], ["check", "a", "--timeout", "0"], ["check", "a", "--fail-on", "info"], ["check", "a", "--origin", "nope"], ["check", "a", "--out"], ["check", "a", "--wat"]]) {
    assert.throws(() => parseArgs(argv), Error, JSON.stringify(argv));
  }
});
