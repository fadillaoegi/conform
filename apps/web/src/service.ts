// Client for the Conform service (apps/server) on the same origin. The checker works without it;
// badges and the directory appear only when it answers.

import type { BadgePayload, BadgeState } from "@conform/core";

export interface BadgeView {
  id: string;
  state: BadgeState;
  payload: BadgePayload;
  signature: string;
  site: { brand: string | null; description: string | null; tags: string[] };
  checkedAt: string;
  links: { svg: string; json: string; page: string; key: string };
}

export interface DirectoryEntry {
  network: string;
  badgeId: string;
  result: "pass" | "warn";
  brand: string | null;
  description: string | null;
  tags: string[];
  issuedAt: string;
  expiresAt: string;
  expired: boolean;
}

export interface KeySet {
  issuer: string;
  keys: Array<{ kty: string; crv: string; x: string; kid: string }>;
}

export type IssueOutcome =
  | { ok: true; badge: BadgeView }
  | { ok: false; reason: string };

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export class ConformService {
  readonly base: string;
  private readonly fetchImpl: typeof fetch;

  constructor(base: string, fetchImpl: typeof fetch = (...args) => fetch(...args)) {
    this.base = base.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
  }

  async available(): Promise<boolean> {
    try {
      const response = await this.fetchImpl(`${this.base}/api/health`, { cache: "no-store" });
      if (!response.ok) return false;
      const body = await readJson<{ ok?: boolean }>(response);
      return body.ok === true;
    } catch {
      return false;
    }
  }

  async issue(url: string): Promise<IssueOutcome> {
    const response = await this.fetchImpl(`${this.base}/api/badges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (response.status === 201) return { ok: true, badge: await readJson<BadgeView>(response) };
    const body = await readJson<{ refused?: string; error?: string }>(response).catch(() => ({} as { refused?: string; error?: string }));
    return { ok: false, reason: body.refused ?? body.error ?? `The service answered HTTP ${response.status}.` };
  }

  async badge(id: string): Promise<BadgeView | null> {
    const response = await this.fetchImpl(`${this.base}/api/badges/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!response.ok) return null;
    return readJson<BadgeView>(response);
  }

  async keys(): Promise<KeySet> {
    const response = await this.fetchImpl(`${this.base}/.well-known/conform-badge-key.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`The public key is unavailable (HTTP ${response.status}).`);
    return readJson<KeySet>(response);
  }

  async directory(): Promise<DirectoryEntry[]> {
    const response = await this.fetchImpl(`${this.base}/api/directory`, { cache: "no-store" });
    if (!response.ok) return [];
    return (await readJson<{ sites: DirectoryEntry[] }>(response)).sites ?? [];
  }
}
