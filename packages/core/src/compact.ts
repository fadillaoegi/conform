// A report small enough for a model prompt or an MCP answer: every check, but only its problem findings.

import { CATALOG } from "./catalog.ts";
import type { Report, Status } from "./types.ts";

export interface CompactFinding {
  id: string;
  status: Status;
  message: string;
  fix?: string;
  spec: string[];
}

export interface CompactCheck {
  id: string;
  name: string;
  status: Status;
  passed: number;
  problems: CompactFinding[];
}

export interface CompactReport {
  ok: true;
  target: string;
  result: Status;
  summary: Report["summary"];
  checks: CompactCheck[];
  notAutomated: string[];
  specCommit: string;
  checkedAt: string;
}

const MAX_MESSAGE = 300;

function clip(text: string, max = MAX_MESSAGE): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function compactReport(report: Report): CompactReport {
  return {
    ok: true,
    target: report.target.networkUrl ?? report.target.siteBase,
    result: report.summary.worst,
    summary: report.summary,
    checks: report.checks.map((c) => {
      const problems = c.findings.filter((f) => f.status === "fail" || f.status === "warn" || f.status === "untestable");
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        passed: c.findings.filter((f) => f.status === "pass").length,
        problems: problems.slice(0, 8).map((f) => {
          const out: CompactFinding = { id: f.id, status: f.status, message: clip(f.message), spec: f.spec };
          if (f.suggestion) out.fix = clip(f.suggestion);
          return out;
        }),
      };
    }),
    notAutomated: CATALOG.filter((c) => !c.automated).map((c) => `${c.id} ${c.name}`),
    specCommit: report.conform.spec.specCommit,
    checkedAt: report.finishedAt,
  };
}

/** Plain text for an MCP answer or a log line. */
export function compactText(compact: CompactReport): string {
  const lines = [`Conform result for ${compact.target}: ${compact.result.toUpperCase()} (${compact.summary.pass} pass, ${compact.summary.fail} fail, ${compact.summary.warn} warn).`];
  for (const check of compact.checks) {
    lines.push(`${check.id} ${check.name}: ${check.status}`);
    for (const p of check.problems) lines.push(`  - ${p.id} ${p.status}: ${p.message}${p.fix ? ` Fix: ${p.fix}` : ""}`);
  }
  lines.push(`Not automated yet: ${compact.notAutomated.join(", ")}. Spec commit ${compact.specCommit.slice(0, 7)}.`);
  return lines.join("\n");
}
