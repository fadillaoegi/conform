// Ports: what the use cases need from the outside world. Infrastructure implements them; the
// composition root (main/) wires them.

import type { Report } from "@conform/core";
import type { Badge, BadgeState } from "../domain/badge.ts";
import type { DirectoryEntry } from "../domain/directory.ts";

/** Runs Conform's checks against a network URL that the UrlPolicy accepted. */
export interface ConformanceChecker {
  check(url: string): Promise<Report>;
  /** How many checks are waiting. */
  readonly pending: number;
}

/** Normalizes a visitor's URL, or throws ValidationError (scheme, port, private address, shape). */
export interface UrlPolicy {
  normalize(input: unknown): string;
}

export interface PublicJwk {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
  kid: string;
  use: "sig";
  alg: "EdDSA";
}

/** Signs badges. The private key never leaves the adapter. */
export interface BadgeSigner {
  readonly kid: string;
  readonly publicJwk: PublicJwk;
  /** base64url Ed25519 signature over the UTF-8 bytes. */
  sign(bytes: string): string;
  /** base64url SHA-256 of the UTF-8 bytes, first 22 characters. */
  badgeId(bytes: string): string;
}

export interface BadgeRepository {
  save(badge: Badge): Promise<void>;
  get(id: string): Promise<Badge | null>;
  directory(): Promise<DirectoryEntry[]>;
  count(): Promise<number>;
}

/** Reads a public artifact and returns its SHA-256 (hex), or null when it cannot be read. */
export interface ArtifactProbe {
  sha256(url: string): Promise<string | null>;
}

export interface Cache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
}

export interface Clock {
  now(): Date;
}

export type { BadgeState };
