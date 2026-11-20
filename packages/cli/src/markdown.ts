// A Markdown rendering of a report, for CI job summaries and pull-request comments.

import type { Report, Status } from "@conform/core";

const ICON: Record<Status, string> = { pass: "✅", fail: "❌", warn: "⚠️", info: "ℹ️", untestable: "❔" };

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function formatMarkdown(report: Report): string {
  const s = report.summary;
  const target = report.target.networkUrl ?? report.target.siteBase ?? report.target.input;
  const lines = [
    `## ${ICON[s.worst]} Conform: ${s.worst.toUpperCase()} for \`${cell(target)}\``,
    "",
    `**${s.pass}** pass · **${s.fail}** fail · **${s.warn}** warn · ${s.info} info · ${s.untestable} untestable`,
    "",
    "| Check | Result | Problems |",
    "| --- | --- | --- |",
  ];
  for (const check of report.checks) {
    const problems = check.findings.filter((f) => f.status === "fail" || f.status === "warn" || f.status === "untestable");
    lines.push(`| ${check.id} ${cell(check.name)} | ${ICON[check.status]} ${check.status} | ${problems.length ? problems.map((p) => `${p.id}`).join(", ") : "–"} |`);
  }
  const problems = report.checks.flatMap((c) => c.findings.filter((f) => f.status === "fail" || f.status === "warn" || f.status === "untestable"));
  if (problems.length) {
    lines.push("", "### What to fix", "");
    for (const p of problems) {
      lines.push(`- ${ICON[p.status]} **${p.id}** ${cell(p.message)}${p.suggestion ? `<br>Fix: ${cell(p.suggestion)}` : ""}${p.spec.length ? ` _(spec ${p.spec.join(", ")})_` : ""}`);
    }
  }
  lines.push("", `<sub>Conform ${report.conform.version} · spec ${report.conform.spec.specCommit.slice(0, 7)} (${report.conform.spec.profile}) · runtime nsdeploy ${report.conform.runtime.nsdeployCommit} · C10–C14 not automated yet</sub>`, "");
  return lines.join("\n");
}
