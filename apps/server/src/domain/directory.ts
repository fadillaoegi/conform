// The directory of badged networks: one entry per network URL, the latest badge wins.

import type { Badge } from "./badge.ts";

export interface DirectoryEntry {
  network: string;
  badgeId: string;
  result: "pass" | "warn";
  brand: string | null;
  description: string | null;
  tags: string[];
  issuedAt: string;
  expiresAt: string;
}

export function entryFor(badge: Badge): DirectoryEntry {
  return {
    network: badge.payload.network,
    badgeId: badge.id,
    result: badge.payload.result,
    brand: badge.site.brand,
    description: badge.site.description,
    tags: badge.site.tags,
    issuedAt: badge.payload.issuedAt,
    expiresAt: badge.payload.expiresAt,
  };
}

/** Insert or replace the network's entry, newest first. */
export function withEntry(directory: DirectoryEntry[], entry: DirectoryEntry): DirectoryEntry[] {
  return [...directory.filter((e) => e.network !== entry.network), entry].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

export function isEntryExpired(entry: DirectoryEntry, now: Date): boolean {
  return Date.parse(entry.expiresAt) <= now.getTime();
}
