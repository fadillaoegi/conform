// Verify a Conform badge in the browser, trusting nothing but the published public key: the id and
// Ed25519 signature over the canonical payload, the issuer, the expiry, and the site's current files
// (re-hashed here, so a changed manifest or network makes the badge stale).

import { canonicalJson, type BadgePayload } from "@conform/core";
import type { KeySet } from "./service.ts";

export type StepStatus = "pass" | "fail" | "warn";

export interface VerifyStep {
  label: string;
  status: StepStatus;
  detail: string;
}

export interface VerifyInput {
  id: string;
  payload: BadgePayload;
  signature: string;
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  const binary = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function toBase64url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyBadge(
  badge: VerifyInput,
  keys: KeySet,
  expectedIssuer: string,
  options: { fetch?: typeof fetch; now?: number } = {},
): Promise<VerifyStep[]> {
  const fetchImpl = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const now = options.now ?? Date.now();
  const steps: VerifyStep[] = [];
  const bytes = new TextEncoder().encode(canonicalJson(badge.payload));
  const key = keys.keys.find((k) => k.kid === badge.payload.kid);
  if (!key) {
    steps.push({ label: "Signing key", status: "fail", detail: `No published key has id ${badge.payload.kid}.` });
    return steps;
  }
  steps.push({ label: "Signing key", status: "pass", detail: `Ed25519 key ${key.kid} from ${keys.issuer}/.well-known/conform-badge-key.json` });
  const id = toBase64url(await crypto.subtle.digest("SHA-256", bytes)).slice(0, 22);
  steps.push(id === badge.id
    ? { label: "Badge id", status: "pass", detail: "The id is the SHA-256 of the signed payload." }
    : { label: "Badge id", status: "fail", detail: "The id does not match the payload." });
  let signatureOk = false;
  try {
    const publicKey = await crypto.subtle.importKey("jwk", { kty: "OKP", crv: "Ed25519", x: key.x }, { name: "Ed25519" }, false, ["verify"]);
    signatureOk = await crypto.subtle.verify({ name: "Ed25519" }, publicKey, fromBase64url(badge.signature), bytes);
  } catch (error) {
    steps.push({ label: "Signature", status: "warn", detail: `This browser cannot verify Ed25519 (${error instanceof Error ? error.message : String(error)}).` });
  }
  if (!steps.some((s) => s.label === "Signature")) {
    steps.push(signatureOk
      ? { label: "Signature", status: "pass", detail: "Ed25519 signature over the canonical payload is valid." }
      : { label: "Signature", status: "fail", detail: "The signature does not match: the badge was altered or not issued by this key." });
  }
  steps.push(badge.payload.issuer === expectedIssuer
    ? { label: "Issuer", status: "pass", detail: badge.payload.issuer }
    : { label: "Issuer", status: "warn", detail: `Issued by ${badge.payload.issuer}, not by this site (${expectedIssuer}).` });
  steps.push(Date.parse(badge.payload.expiresAt) > now
    ? { label: "Not expired", status: "pass", detail: `Valid until ${badge.payload.expiresAt.slice(0, 10)}.` }
    : { label: "Not expired", status: "fail", detail: `Expired on ${badge.payload.expiresAt.slice(0, 10)}.` });
  for (const [label, artifact] of [["Manifest unchanged", badge.payload.artifacts.manifest], ["Network unchanged", badge.payload.artifacts.definition]] as const) {
    try {
      const response = await fetchImpl(artifact.url, { cache: "no-store", credentials: "omit" });
      if (!response.ok) {
        steps.push({ label, status: "warn", detail: `${artifact.url} answered HTTP ${response.status}.` });
        continue;
      }
      const digest = await sha256Hex(await response.arrayBuffer());
      steps.push(digest === artifact.sha256
        ? { label, status: "pass", detail: `SHA-256 ${digest.slice(0, 16)}… matches.` }
        : { label, status: "fail", detail: "The file changed since the badge was issued: the badge is stale. Check the site again." });
    } catch {
      steps.push({ label, status: "warn", detail: `Could not read ${artifact.url} from this browser.` });
    }
  }
  return steps;
}
