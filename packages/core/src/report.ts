import { worstStatus } from "./findings.ts";
import type { CheckResult, Status, Summary } from "./types.ts";

export function summarize(checks: CheckResult[]): Summary {
  const summary: Summary = { total: 0, pass: 0, fail: 0, warn: 0, info: 0, untestable: 0, worst: "pass" };
  const statuses: Status[] = [];
  for (const check of checks) {
    for (const finding of check.findings) {
      summary.total += 1;
      summary[finding.status] += 1;
      statuses.push(finding.status);
    }
  }
  summary.worst = worstStatus(statuses);
  return summary;
}
