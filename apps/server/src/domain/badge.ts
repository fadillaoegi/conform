// The Badge entity and its rules. A badge asserts that a network passed Conform's checks, bound to the
// SHA-256 of its manifest and definition: it is valid until it expires or the site's files change.
// Pure: no I/O, no clock, no crypto (signing and hashing are ports).

import { canonicalJson, type BadgePayload, type BadgeState, type Report } from "@conform/core";

export type { BadgePayload, BadgeState };

export const BADGE_TTL_DAYS = 30;
export const REQUIRED_CHECKS = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"] as const;

export interface SiteIdentity {
  brand: string | null;
  description: string | null;
  tags: string[];
}

export interface Badge {
  id: string;
  payload: BadgePayload;
  /** base64url Ed25519 signature over signedBytes(payload). */
  signature: string;
  site: SiteIdentity;
}

/** Why a report cannot be badged, or null when it can. */
export function ineligibility(report: Report): string | null {
  if (report.summary.fail > 0) return `The site has ${report.summary.fail} failing finding(s). Fix them, then ask for a badge again.`;
  const ran = new Set(report.checks.map((c) => c.id));
  for (const id of REQUIRED_CHECKS) {
    if (!ran.has(id)) return `Check ${id} did not run, so the site cannot be badged yet.`;
  }
  if (!report.artifacts.manifest?.sha256 || !report.artifacts.definition?.sha256) return "The manifest or definition could not be hashed.";
  if (report.target.networkUrl === null) return "The report names no network.";
  return null;
}

/** What the badge asserts. Call only when ineligibility(report) is null. */
export function buildPayload(report: Report, issuer: string, kid: string, now: Date): BadgePayload {
  const manifest = report.artifacts.manifest;
  const definition = report.artifacts.definition;
  if (!manifest?.sha256 || !definition?.sha256 || !report.target.networkUrl) throw new Error("Report is not eligible for a badge.");
  const checks: Record<string, string> = {};
  for (const c of report.checks) checks[c.id] = c.status;
  return {
    v: 1,
    type: "conform-badge",
    issuer,
    kid,
    network: report.target.networkUrl,
    result: report.summary.warn > 0 ? "warn" : "pass",
    checks,
    summary: { pass: report.summary.pass, warn: report.summary.warn, info: report.summary.info, untestable: report.summary.untestable },
    artifacts: {
      manifest: { url: manifest.finalUrl, sha256: manifest.sha256 },
      definition: { url: definition.finalUrl, sha256: definition.sha256 },
    },
    spec: { commit: report.conform.spec.specCommit, profile: report.conform.spec.profile },
    runtime: `nsdeploy ${report.conform.runtime.nsdeployCommit}`,
    conform: report.conform.version,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + BADGE_TTL_DAYS * 86_400_000).toISOString(),
  };
}

/** The exact text that is hashed for the id and signed. */
export function signedBytes(payload: BadgePayload): string {
  return canonicalJson(payload);
}

export function isExpired(payload: BadgePayload, now: Date): boolean {
  return Date.parse(payload.expiresAt) <= now.getTime();
}

/** The artifacts a badge is bound to, in the order they are re-checked. */
export function boundArtifacts(payload: BadgePayload): Array<{ url: string; sha256: string }> {
  return [payload.artifacts.manifest, payload.artifacts.definition];
}

/**
 * The badge's state from what was observed now: each bound artifact's current SHA-256, or null when it
 * could not be read. Observations are in boundArtifacts() order; the first problem decides.
 */
export function evaluateState(payload: BadgePayload, now: Date, observed: Array<string | null>): BadgeState {
  if (isExpired(payload, now)) return "expired";
  const bound = boundArtifacts(payload);
  for (let i = 0; i < bound.length; i += 1) {
    const actual = observed[i];
    if (actual === null || actual === undefined) return "unreachable";
    if (actual !== bound[i]?.sha256) return "stale";
  }
  return "valid";
}
