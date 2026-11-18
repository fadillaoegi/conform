// Server-side signing (node:crypto) against browser-side verification (WebCrypto, apps/web/src/verify.ts).
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "@conform/core";
import { buildPayload, ineligibility, signedBytes, type BadgePayload } from "../src/domain/badge.ts";
import { Ed25519Signer, verifyBadgeSignature as verifyBadge } from "../src/infrastructure/ed25519-signer.ts";

function signWith(signer: Ed25519Signer, payload: BadgePayload) {
  const bytes = signedBytes(payload);
  return { id: signer.badgeId(bytes), payload, signature: signer.sign(bytes) };
}
import { verifyBadge as verifyInBrowser } from "../../web/src/verify.ts";
import type { Report } from "@conform/core";

function fakeReport(fail = 0, warn = 0): Report {
  const checks = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"].map((id) => ({ id, name: id, spec: [], mode: "static" as const, status: "pass" as const, findings: [], durationMs: 1 }));
  return {
    site: { brand: "Test", description: null, tags: [] },
    conform: { version: "0.1.0", spec: { specCommit: "fd872b9221aeb8ff762b75a5badbf84b23c133cc", profile: "MVP Profile 0.2" }, runtime: { nsdeployCommit: "53a787c" }, environment: "node", callerOrigin: "https://conform.example" },
    target: { input: "https://site.example/net", siteBase: "https://site.example", origin: "https://site.example", networkName: "net", networkUrl: "https://site.example/net" },
    startedAt: "", finishedAt: "",
    summary: { total: 10, pass: 10 - fail - warn, fail, warn, info: 0, untestable: 0, worst: fail ? "fail" : warn ? "warn" : "pass" },
    checks,
    artifacts: {
      manifest: { url: "https://site.example/agent-manifest.json", finalUrl: "https://site.example/agent-manifest.json", status: 200, contentType: "application/json", sha256: "a".repeat(64), bytes: 10 },
      definition: { url: "https://site.example/net.network.json", finalUrl: "https://site.example/net.network.json", status: 200, contentType: "application/json", sha256: "b".repeat(64), bytes: 10 },
    },
  } as unknown as Report;
}

test("canonical JSON sorts keys at every level and drops undefined", () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: undefined } }), '{"a":{"d":[3,{"y":2,"z":1}]},"b":1}');
});

test("eligibility: failures, missing checks and missing hashes are refused", () => {
  assert.match(String(ineligibility(fakeReport(1))), /failing/);
  assert.equal(ineligibility(fakeReport(0, 2)), null, "warnings are allowed (badge result: warn)");
  const partial = fakeReport();
  partial.checks = partial.checks.slice(0, 6);
  assert.match(String(ineligibility(partial)), /C7 did not run/);
});

test("a badge signed by the server verifies in node and in the browser code, and tampering breaks both", async () => {
  const signer = Ed25519Signer.ephemeral();
  const payload = buildPayload(fakeReport(0, 1), "https://conform.example", signer.kid, new Date("2026-11-17T00:00:00Z"));
  assert.equal(payload.result, "warn");
  const badge = signWith(signer, payload);
  assert.equal(verifyBadge(badge, signer.publicJwk), true);

  const files: Record<string, string> = { "https://site.example/agent-manifest.json": "M", "https://site.example/net.network.json": "D" };
  const sha = async (t: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))), (b) => b.toString(16).padStart(2, "0")).join("");
  payload.artifacts.manifest.sha256 = await sha("M");
  payload.artifacts.definition.sha256 = await sha("D");
  const fresh = signWith(signer, payload);
  const fakeFetch = (async (url: string) => new Response(files[url] ?? "", { status: files[url] ? 200 : 404 })) as typeof fetch;
  const keys = { issuer: "https://conform.example", keys: [signer.publicJwk] };
  const steps = await verifyInBrowser(fresh, keys, "https://conform.example", { fetch: fakeFetch, now: Date.parse("2026-11-20T00:00:00Z") });
  assert.deepEqual(steps.map((s) => s.status), ["pass", "pass", "pass", "pass", "pass", "pass", "pass"], JSON.stringify(steps));

  const tampered = { ...fresh, payload: { ...fresh.payload, result: "pass" as const } };
  assert.equal(verifyBadge(tampered, signer.publicJwk), false);
  const browserTampered = await verifyInBrowser(tampered, keys, "https://conform.example", { fetch: fakeFetch, now: Date.parse("2026-11-20T00:00:00Z") });
  assert.equal(browserTampered.find((s) => s.label === "Badge id")?.status, "fail");
  assert.equal(browserTampered.find((s) => s.label === "Signature")?.status, "fail");

  files["https://site.example/net.network.json"] = "D changed";
  const stale = await verifyInBrowser(fresh, keys, "https://conform.example", { fetch: fakeFetch, now: Date.parse("2026-11-20T00:00:00Z") });
  assert.equal(stale.find((s) => s.label === "Network unchanged")?.status, "fail");
  const expired = await verifyInBrowser(fresh, keys, "https://conform.example", { fetch: fakeFetch, now: Date.parse("2027-01-01T00:00:00Z") });
  assert.equal(expired.find((s) => s.label === "Not expired")?.status, "fail");
});
