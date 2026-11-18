// Use cases with in-memory fakes for every port: no network, no files, no real crypto.
import assert from "node:assert/strict";
import test from "node:test";
import type { Report } from "@conform/core";
import type { ArtifactProbe, BadgeRepository, BadgeSigner, Cache, Clock, ConformanceChecker, UrlPolicy } from "../src/application/ports.ts";
import { CheckSite } from "../src/application/use-cases/check-site.ts";
import { FindBadgeForNetwork, ListDirectory } from "../src/application/use-cases/directory.ts";
import { GetBadge } from "../src/application/use-cases/get-badge.ts";
import { IssueBadge } from "../src/application/use-cases/issue-badge.ts";
import type { Badge, BadgeState } from "../src/domain/badge.ts";
import { evaluateState } from "../src/domain/badge.ts";
import { withEntry, type DirectoryEntry } from "../src/domain/directory.ts";
import { ValidationError } from "../src/domain/errors.ts";

const NET = "https://site.example/net";

function report(fail = 0, warn = 0): Report {
  const checks = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"].map((id) => ({ id, name: id, spec: [], mode: "static", status: "pass", findings: [], durationMs: 1 }));
  return {
    site: { brand: "Site", description: "Books things", tags: ["booking"] },
    conform: { version: "0.1.0", spec: { specCommit: "fd872b9", profile: "MVP Profile 0.2" }, runtime: { nsdeployCommit: "53a787c" }, environment: "node", callerOrigin: "x" },
    target: { input: NET, siteBase: "https://site.example", origin: "https://site.example", networkName: "net", networkUrl: NET },
    startedAt: "", finishedAt: "",
    summary: { total: 9, pass: 9, fail, warn, info: 0, untestable: 0, worst: fail ? "fail" : warn ? "warn" : "pass" },
    checks,
    artifacts: {
      manifest: { url: "m", finalUrl: "https://site.example/agent-manifest.json", status: 200, contentType: null, sha256: "m1", bytes: 1 },
      definition: { url: "d", finalUrl: "https://site.example/net.network.json", status: 200, contentType: null, sha256: "d1", bytes: 1 },
    },
  } as unknown as Report;
}

class Fakes {
  now = new Date("2026-11-17T00:00:00Z");
  checks: string[] = [];
  next: Report = report();
  hashes: Record<string, string | null> = { "https://site.example/agent-manifest.json": "m1", "https://site.example/net.network.json": "d1" };
  probes = 0;
  badges = new Map<string, Badge>();
  dir: DirectoryEntry[] = [];
  clock: Clock = { now: () => this.now };
  policy: UrlPolicy = { normalize: (input) => {
    if (typeof input !== "string" || !input.startsWith("https://")) throw new ValidationError("https only");
    return input;
  } };
  checker: ConformanceChecker = { check: async (url) => { this.checks.push(url); return this.next; }, pending: 0 };
  signer: BadgeSigner = {
    kid: "kid1",
    publicJwk: { kty: "OKP", crv: "Ed25519", x: "x", kid: "kid1", use: "sig", alg: "EdDSA" },
    sign: (bytes) => `sig(${bytes.length})`,
    badgeId: (bytes) => `id${bytes.length}`.padEnd(22, "0").slice(0, 22),
  };
  repository: BadgeRepository = {
    save: async (b) => { this.badges.set(b.id, b); this.dir = withEntry(this.dir, { network: b.payload.network, badgeId: b.id, result: b.payload.result, brand: b.site.brand, description: b.site.description, tags: b.site.tags, issuedAt: b.payload.issuedAt, expiresAt: b.payload.expiresAt }); },
    get: async (id) => this.badges.get(id) ?? null,
    directory: async () => this.dir,
    count: async () => this.badges.size,
  };
  probe: ArtifactProbe = { sha256: async (url) => { this.probes += 1; return this.hashes[url] ?? null; } };
  cache<T>(): Cache<T> {
    const m = new Map<string, T>();
    return { get: (k) => m.get(k), set: (k, v) => void m.set(k, v) };
  }
}

function wire(f: Fakes) {
  const states = f.cache<BadgeState>();
  const checkSite = new CheckSite(f.policy, f.checker, f.cache<Report>());
  const getBadge = new GetBadge(f.repository, f.probe, states, f.clock, "https://conform.example");
  return {
    checkSite,
    issue: new IssueBadge(checkSite, f.signer, f.repository, states, f.clock, "https://conform.example"),
    getBadge,
    find: new FindBadgeForNetwork(f.policy, f.repository, getBadge),
    list: new ListDirectory(f.repository, f.clock),
    states,
  };
}

test("CheckSite validates through the policy and caches per URL", async () => {
  const f = new Fakes();
  const { checkSite } = wire(f);
  await assert.rejects(checkSite.report("http://site.example/net"), ValidationError);
  await checkSite.report(NET);
  await checkSite.report(NET);
  assert.deepEqual(f.checks, [NET]);
  await checkSite.report(NET, { fresh: true });
  assert.equal(f.checks.length, 2);
});

test("IssueBadge re-checks the site, refuses failures, and signs the canonical payload", async () => {
  const f = new Fakes();
  const { issue } = wire(f);
  f.next = report(1);
  const refused = await issue.execute(NET);
  assert.ok("refused" in refused && /failing/.test(refused.refused));
  assert.equal(f.badges.size, 0);
  f.next = report(0, 2);
  const issued = await issue.execute(NET);
  assert.ok("badge" in issued);
  if (!("badge" in issued)) return;
  assert.equal(issued.badge.payload.result, "warn");
  assert.equal(issued.badge.payload.kid, "kid1");
  assert.match(issued.badge.signature, /^sig\(\d+\)$/);
  assert.equal(issued.badge.links.svg, `https://conform.example/badges/${issued.badge.id}.svg`);
  assert.equal(f.checks.length, 2, "every issue runs a fresh check");
});

test("GetBadge evaluates expiry, staleness and reachability, and caches the state", async () => {
  const f = new Fakes();
  const w = wire(f);
  const issued = await w.issue.execute(NET);
  if (!("badge" in issued)) return assert.fail("not issued");
  const id = issued.badge.id;
  const fresh = wire(f);
  assert.equal((await fresh.getBadge.execute(id))?.state, "valid");
  assert.equal(f.probes, 2);
  assert.equal((await fresh.getBadge.execute(id))?.state, "valid");
  assert.equal(f.probes, 2, "state is cached");
  f.hashes["https://site.example/net.network.json"] = "changed";
  assert.equal((await wire(f).getBadge.execute(id))?.state, "stale");
  f.hashes["https://site.example/agent-manifest.json"] = null;
  assert.equal((await wire(f).getBadge.execute(id))?.state, "unreachable");
  f.now = new Date("2027-01-01T00:00:00Z");
  assert.equal((await wire(f).getBadge.execute(id))?.state, "expired");
  assert.equal(await wire(f).getBadge.execute("nope"), null);
});

test("the directory keeps one entry per network and marks expiry; FindBadge goes through the policy", async () => {
  const f = new Fakes();
  const w = wire(f);
  await w.issue.execute(NET);
  f.now = new Date("2026-11-18T00:00:00Z");
  await w.issue.execute(NET);
  const list = await w.list.execute();
  assert.equal(list.length, 1);
  assert.equal(list[0]?.issuedAt, "2026-11-18T00:00:00.000Z");
  assert.equal(list[0]?.expired, false);
  assert.ok(await w.find.execute(NET));
  await assert.rejects(w.find.execute("ftp://x"), ValidationError);
});

test("domain: the first problem decides the state", () => {
  const payload = { expiresAt: "2027-01-01T00:00:00Z", artifacts: { manifest: { url: "m", sha256: "a" }, definition: { url: "d", sha256: "b" } } } as Badge["payload"];
  const now = new Date("2026-12-01T00:00:00Z");
  assert.equal(evaluateState(payload, now, ["a", "b"]), "valid");
  assert.equal(evaluateState(payload, now, ["x"]), "stale");
  assert.equal(evaluateState(payload, now, [null]), "unreachable");
  assert.equal(evaluateState(payload, now, ["a", "x"]), "stale");
  assert.equal(evaluateState(payload, new Date("2027-02-01T00:00:00Z"), ["a", "b"]), "expired");
});
