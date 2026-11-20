// Text rendering of a Conform report for terminals and CI logs.

import type { Finding, Report, Status } from "@conform/core";

export interface FormatOptions {
  color: boolean;
  evidence: boolean;
  problemsOnly: boolean;
}

const CODES: Record<string, [number, number]> = {
  bold: [1, 22],
  dim: [2, 22],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  blue: [34, 39],
  magenta: [35, 39],
  cyan: [36, 39],
};

function paint(on: boolean, style: keyof typeof CODES, text: string): string {
  if (!on) return text;
  const [open, close] = CODES[style] as [number, number];
  return `\u001b[${open}m${text}\u001b[${close}m`;
}

const LABEL: Record<Status, string> = { pass: "PASS", fail: "FAIL", warn: "WARN", info: "INFO", untestable: "N/T " };
const MARK: Record<Status, string> = { pass: "✔", fail: "✖", warn: "▲", info: "·", untestable: "?" };
const STYLE: Record<Status, keyof typeof CODES> = { pass: "green", fail: "red", warn: "yellow", info: "dim", untestable: "magenta" };
const PROBLEMS: ReadonlySet<Status> = new Set<Status>(["fail", "warn", "untestable"]);

function statusTag(on: boolean, status: Status): string {
  return paint(on, STYLE[status], LABEL[status]);
}

function findingLines(f: Finding, options: FormatOptions): string[] {
  const c = options.color;
  const lines = [`    ${paint(c, STYLE[f.status], MARK[f.status])} ${paint(c, "dim", f.id.padEnd(6))} ${f.message}`];
  if (f.suggestion && (f.status === "fail" || f.status === "warn")) {
    lines.push(`      ${paint(c, "cyan", "fix:")} ${f.suggestion}`);
  }
  if (f.spec.length && (f.status === "fail" || f.status === "warn")) {
    lines.push(`      ${paint(c, "dim", `spec ${f.spec.join(", ")}`)}`);
  }
  if (options.evidence && f.evidence) {
    lines.push(`      ${paint(c, "dim", `evidence ${JSON.stringify(f.evidence)}`)}`);
  }
  return lines;
}

export function formatReport(report: Report, options: FormatOptions): string {
  const c = options.color;
  const { conform, target, summary } = report;
  const out: string[] = [];
  out.push(`${paint(c, "bold", "Conform")} ${conform.version} · spec ${conform.spec.specCommit.slice(0, 7)} · ${conform.spec.profile} · runtime nsdeploy ${conform.runtime.nsdeployCommit}`);
  out.push(`${paint(c, "dim", "Target")}  ${target.networkUrl ?? target.siteBase ?? target.input}`);
  out.push(`${paint(c, "dim", "Caller")}  ${conform.callerOrigin}`);
  out.push("");
  for (const check of report.checks) {
    out.push(`${paint(c, "bold", check.id.padEnd(3))} ${statusTag(c, check.status)}  ${check.name} ${paint(c, "dim", `[${check.mode}, ${check.durationMs} ms]`)}`);
    const shown = options.problemsOnly ? check.findings.filter((f) => PROBLEMS.has(f.status)) : check.findings;
    for (const finding of shown) out.push(...findingLines(finding, options));
    if (options.problemsOnly && shown.length === 0) out.push(`    ${paint(c, "dim", `${check.findings.length} finding(s), no problems`)}`);
    out.push("");
  }
  const parts = [
    paint(c, "green", `${summary.pass} pass`),
    paint(c, summary.fail ? "red" : "dim", `${summary.fail} fail`),
    paint(c, summary.warn ? "yellow" : "dim", `${summary.warn} warn`),
    paint(c, "dim", `${summary.info} info`),
    paint(c, summary.untestable ? "magenta" : "dim", `${summary.untestable} untestable`),
  ];
  out.push(`${paint(c, "bold", "Result")}  ${statusTag(c, summary.worst)}  ${parts.join(" · ")}`);
  const ran = report.checks.map((x) => x.id).join(" ");
  out.push(paint(c, "dim", `Checks run: ${ran || "none"}. Not yet automated: C10 runtime fingerprint to C14 BYOK panel.`));
  return out.join("\n");
}
