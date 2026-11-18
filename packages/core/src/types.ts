import type { RuntimeRef, SpecRef } from "./spec.ts";

/** Outcome of one finding or one check. */
export type Status = "pass" | "fail" | "warn" | "info" | "untestable";

/** How a check gathers its evidence. */
export type Mode = "static" | "harness" | "browser";

export type Evidence = Record<string, unknown>;

export interface Finding {
  /** Stable id such as "C1.2". */
  id: string;
  status: Status;
  message: string;
  /** Spec clauses, such as "§3.3". */
  spec: string[];
  evidence?: Evidence;
  suggestion?: string;
}

export interface CheckResult {
  id: string;
  name: string;
  spec: string[];
  mode: Mode;
  status: Status;
  findings: Finding[];
  durationMs: number;
}

export interface ArtifactInfo {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string | null;
  sha256: string | null;
  bytes: number;
}

export interface Target {
  input: string;
  siteBase: string;
  origin: string;
  networkName: string | null;
  networkUrl: string | null;
}

export interface Summary {
  total: number;
  pass: number;
  fail: number;
  warn: number;
  info: number;
  untestable: number;
  worst: Status;
}

export interface SiteInfo {
  brand: string | null;
  description: string | null;
  tags: string[];
}

export interface Report {
  /** Public identity from the manifest (untrusted text, clipped). */
  site: SiteInfo | null;
  conform: {
    version: string;
    spec: SpecRef;
    runtime: RuntimeRef;
    environment: "node" | "browser";
    callerOrigin: string;
  };
  target: Target;
  startedAt: string;
  finishedAt: string;
  summary: Summary;
  checks: CheckResult[];
  artifacts: {
    manifest?: ArtifactInfo;
    definition?: ArtifactInfo;
    links?: ArtifactInfo;
  };
}

/** A loosely typed JSON object. */
export type JsonObject = Record<string, unknown>;

export interface NetworkEntry {
  name: string;
  front_man: string | null;
  hocon: string | null;
  raw: JsonObject;
}
