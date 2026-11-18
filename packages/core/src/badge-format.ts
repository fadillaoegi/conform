// The signed-badge format, shared by the server (which signs) and any verifier (the site, or anyone).
// The signature is Ed25519 over the UTF-8 bytes of canonicalJson(payload); the id is the first 22
// base64url characters of SHA-256 over the same bytes.

export interface BadgePayload {
  v: 1;
  type: "conform-badge";
  issuer: string;
  kid: string;
  network: string;
  result: "pass" | "warn";
  checks: Record<string, string>;
  summary: { pass: number; warn: number; info: number; untestable: number };
  artifacts: {
    manifest: { url: string; sha256: string };
    definition: { url: string; sha256: string };
  };
  spec: { commit: string; profile: string };
  runtime: string;
  conform: string;
  issuedAt: string;
  expiresAt: string;
}

export interface SignedBadge {
  id: string;
  payload: BadgePayload;
  signature: string;
}

export type BadgeState = "valid" | "stale" | "expired" | "unreachable";

/** JSON with object keys sorted at every level and undefined members dropped: the exact signed bytes. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).filter((k) => record[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(",")}}`;
}
