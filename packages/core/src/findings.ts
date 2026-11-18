import type { CheckResult, Evidence, Finding, Mode, Status } from "./types.ts";

const SEVERITY: Record<Status, number> = { fail: 4, warn: 3, untestable: 2, pass: 1, info: 0 };

/** The status a group of findings reports: fail beats warn beats untestable beats pass; info never counts. */
export function worstStatus(statuses: Iterable<Status>): Status {
  let worst: Status = "info";
  for (const status of statuses) {
    if (SEVERITY[status] > SEVERITY[worst]) worst = status;
  }
  return worst === "info" ? "pass" : worst;
}

/** Collects the findings of one check. */
export class Findings {
  readonly items: Finding[] = [];
  private readonly started = performance.now();

  readonly id: string;
  readonly name: string;
  readonly spec: string[];
  readonly mode: Mode;

  constructor(id: string, name: string, spec: string[], mode: Mode) {
    this.id = id;
    this.name = name;
    this.spec = spec;
    this.mode = mode;
  }

  add(id: string, status: Status, message: string, spec: string[], extra: { evidence?: Evidence; suggestion?: string } = {}): Finding {
    const finding: Finding = { id, status, message, spec };
    if (extra.evidence) finding.evidence = extra.evidence;
    if (extra.suggestion) finding.suggestion = extra.suggestion;
    this.items.push(finding);
    return finding;
  }

  pass(id: string, message: string, spec: string[], evidence?: Evidence): Finding {
    return this.add(id, "pass", message, spec, evidence ? { evidence } : {});
  }

  fail(id: string, message: string, spec: string[], suggestion: string, evidence?: Evidence): Finding {
    return this.add(id, "fail", message, spec, evidence ? { evidence, suggestion } : { suggestion });
  }

  warn(id: string, message: string, spec: string[], suggestion: string, evidence?: Evidence): Finding {
    return this.add(id, "warn", message, spec, evidence ? { evidence, suggestion } : { suggestion });
  }

  info(id: string, message: string, spec: string[], evidence?: Evidence): Finding {
    return this.add(id, "info", message, spec, evidence ? { evidence } : {});
  }

  untestable(id: string, message: string, spec: string[], evidence?: Evidence): Finding {
    return this.add(id, "untestable", message, spec, evidence ? { evidence } : {});
  }

  hasFail(): boolean {
    return this.items.some((f) => f.status === "fail");
  }

  result(): CheckResult {
    return {
      id: this.id,
      name: this.name,
      spec: this.spec,
      mode: this.mode,
      status: worstStatus(this.items.map((f) => f.status)),
      findings: [...this.items],
      durationMs: Math.round(performance.now() - this.started),
    };
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

/** Show the start of a secret-looking value without revealing it. */
export function mask(value: string): string {
  if (value.length <= 6) return "***";
  return `${value.slice(0, 4)}…(${value.length} chars)`;
}
