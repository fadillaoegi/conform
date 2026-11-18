/// <reference path="./reference-runtime.d.ts" />
// Conform core: check an Open Agentic Web site against the MVP specification.
//
// checkNetwork(input) runs the static checks (C1–C3) and, when the network entry resolves, the
// reference-runtime harness checks (C4–C9). It returns a JSON-serializable report bound to the spec
// commit and runtime version in spec.ts.

import { checkDefinition } from "./checks/definition.ts";
import { checkExactName } from "./checks/exact-name.ts";
import { checkLimits } from "./checks/limits.ts";
import { checkManifest } from "./checks/manifest.ts";
import { checkNetworkEntry } from "./checks/network-entry.ts";
import { checkOriginPolicy } from "./checks/origin-policy.ts";
import { checkRuntimeTrust } from "./checks/runtime-trust.ts";
import { inBrowser, type FetchLike, type FetchOptions } from "./fetcher.ts";
import { Findings } from "./findings.ts";
import { summarize } from "./report.ts";
import { CONFORM_VERSION, RUNTIME, SPEC } from "./spec.ts";
import type { CheckResult, Report } from "./types.ts";
import { parseInput } from "./url.ts";

export interface CheckOptions {
  /** The fetch to use for artifacts (defaults to the global fetch). */
  fetch?: FetchLike;
  /** The origin a caller would present; defaults to Conform's own origin in a browser, else a placeholder. */
  callerOrigin?: string;
  /** Skip the harness checks (C4–C6), for example when only static evidence is wanted. */
  staticOnly?: boolean;
  timeoutMs?: number;
  /** Called after each check finishes, in order, so a UI can show progress. */
  onCheck?: (result: CheckResult, index: number) => void;
}

export const DEFAULT_CALLER_ORIGIN = "https://conform.example";

function callerOriginFor(options: CheckOptions): string {
  if (options.callerOrigin) return options.callerOrigin;
  const g = globalThis as { location?: { origin?: string } };
  if (inBrowser() && g.location?.origin) return g.location.origin;
  return DEFAULT_CALLER_ORIGIN;
}

export async function checkNetwork(input: string, options: CheckOptions = {}): Promise<Report> {
  const startedAt = new Date().toISOString();
  const callerOrigin = callerOriginFor(options);
  const { target, problems } = parseInput(input);
  const checks: CheckResult[] = [];
  const push = (result: CheckResult): void => {
    checks.push(result);
    try {
      options.onCheck?.(result, checks.length - 1);
    } catch {
      // A progress callback must never break a check run.
    }
  };
  const artifacts: Report["artifacts"] = {};
  const fetchOptions: FetchOptions = { callerOrigin };
  if (options.fetch) fetchOptions.fetch = options.fetch;
  if (options.timeoutMs !== undefined) fetchOptions.timeoutMs = options.timeoutMs;

  let site: Report["site"] = null;
  const finish = (): Report => ({
    site,
    conform: { version: CONFORM_VERSION, spec: SPEC, runtime: RUNTIME, environment: inBrowser() ? "browser" : "node", callerOrigin },
    target,
    startedAt,
    finishedAt: new Date().toISOString(),
    summary: summarize(checks),
    checks,
    artifacts,
  });

  if (problems.length) {
    const f = new Findings("C0", "Input", ["§3.2.1"], "static");
    for (const problem of problems) f.fail("C0.1", problem, ["§3.2.1"], "Give a network URL: the folder that holds agent-manifest.json, then the network name.", { input });
    push(f.result());
    return finish();
  }

  const c1 = await checkManifest(target, fetchOptions);
  push(c1.result);
  if (c1.artifact) artifacts.manifest = c1.artifact;
  if (!c1.manifest) return finish();

  const c2 = await checkNetworkEntry(target, c1.manifest, c1.entries, fetchOptions);
  push(c2.result);
  if (c2.definitionArtifact) artifacts.definition = c2.definitionArtifact;
  if (c2.linksArtifact) artifacts.links = c2.linksArtifact;
  if (c2.entry) {
    const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
    const tags = Array.isArray(c2.entry.raw["tags"]) ? (c2.entry.raw["tags"] as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 8).map((t) => t.slice(0, 40)) : [];
    site = { brand: text(c1.manifest["brand"], 80), description: text(c2.entry.raw["description"], 300), tags };
  }
  if (!c2.entry || !c2.definition || c2.definitionText === null) return finish();
  if (target.networkName === null) {
    target.networkName = c2.entry.name;
    target.networkUrl = `${target.siteBase}/${c2.entry.name}`;
  }

  const c3 = checkDefinition(target, c1.manifest, c2.entry, c2.definition, c2.definitionText, c1.fetched?.text ?? "");
  push(c3.result);

  if (options.staticOnly) return finish();
  push((await checkExactName(target, c1.manifest, c1.entries, c2.entry, options.fetch)).result);
  push((await checkLimits(target, c1.manifest, c2.entry, options.fetch)).result);
  push((await checkOriginPolicy(target, c1.manifest, c2.entry, c3.externals, options.fetch)).result);
  const trust = await checkRuntimeTrust(target, c1.manifest, c2.entry, c2.definition, fetchOptions, options.fetch);
  push(trust.c7);
  push(trust.c8);
  push(trust.c9);
  return finish();
}

export { parseInput } from "./url.ts";
export { fetchArtifact, evaluateCors } from "./fetcher.ts";
export { summarize } from "./report.ts";
export { SPEC, RUNTIME, CONFORM_VERSION } from "./spec.ts";
export type * from "./types.ts";
export { CATALOG, checkInfo, type CheckInfo } from "./catalog.ts";
export { compactReport, compactText, type CompactReport, type CompactCheck, type CompactFinding } from "./compact.ts";
export { canonicalJson, type BadgePayload, type SignedBadge, type BadgeState } from "./badge-format.ts";
