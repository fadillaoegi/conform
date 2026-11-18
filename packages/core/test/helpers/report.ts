import type { Finding, Report, Status } from "../../src/types.ts";

export function findings(report: Report, id: string): Finding[] {
  return report.checks.flatMap((c) => c.findings.filter((f) => f.id === id));
}

export function statuses(report: Report, id: string): Status[] {
  return findings(report, id).map((f) => f.status);
}

export function hasStatus(report: Report, id: string, status: Status): boolean {
  return statuses(report, id).includes(status);
}

export function checkStatus(report: Report, checkId: string): Status | null {
  return report.checks.find((c) => c.id === checkId)?.status ?? null;
}

export function failures(report: Report): string[] {
  return report.checks.flatMap((c) => c.findings.filter((f) => f.status === "fail").map((f) => `${f.id}: ${f.message}`));
}
