// DOM rendering for the checker. Everything that comes from a checked site (names, URLs, error
// text, evidence) is untrusted, so it is only ever written with textContent, never as HTML.

import type { CheckResult, Finding, Report, Status } from "@conform/core";
import { CATALOG } from "./catalog.ts";
import type { PageState } from "./page.ts";

const AUTOMATED = CATALOG.filter((c) => c.automated);
const ICON: Record<Status, string> = { pass: "✔", fail: "✖", warn: "▲", info: "·", untestable: "?" };
const LABEL: Record<Status, string> = { pass: "Pass", fail: "Fail", warn: "Warn", info: "Info", untestable: "N/T" };

type Attrs = Record<string, string>;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Array<Node | string>): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(typeof child === "string" ? document.createTextNode(child) : child);
  return node;
}

function $(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
}

export function renderProgress(state: PageState): void {
  const section = $("progress");
  const show = state.running || state.progress.length > 0 || state.error !== null;
  section.hidden = !show;
  if (!show) return;
  const hp = $("hp");
  hp.replaceChildren();
  AUTOMATED.forEach((info, index) => {
    const done = state.progress[index];
    let cls = "pending";
    let label = `${info.id}: waiting`;
    if (done) {
      cls = done.status;
      label = `${info.id}: ${LABEL[done.status]}`;
    } else if (state.running && index === state.progress.length) {
      cls = "running";
      label = `${info.id}: running`;
    } else if (!state.running) {
      cls = "skipped";
      label = `${info.id}: not run`;
    }
    hp.append(el("li", { class: cls, "aria-label": label, title: label }, info.id, el("span", { class: "hp-name" }, info.name)));
  });
  const text = $("progress-text");
  if (state.running) text.textContent = `Running ${AUTOMATED[state.progress.length]?.id ?? "…"}…`;
  else if (state.error) text.textContent = `The check stopped on an unexpected error: ${state.error}`;
  else {
    const ran = state.progress.length;
    text.textContent = ran < AUTOMATED.length
      ? `${ran} of ${AUTOMATED.length} checks ran. The rest need the earlier ones to pass first.`
      : `All ${AUTOMATED.length} automated checks ran.`;
  }
}

function findingNode(f: Finding): HTMLElement {
  const extra = el("div", { class: "extra" });
  if (f.suggestion && (f.status === "fail" || f.status === "warn")) {
    extra.append(el("div", { class: "fix" }, el("b", {}, "Fix"), f.suggestion));
  }
  if (f.spec.length && f.status !== "info") {
    extra.append(el("div", { class: "spec", "aria-label": "Spec sections" }, ...f.spec.map((s) => el("span", {}, s))));
  }
  if (f.evidence) extra.append(el("pre", { class: "evidence" }, JSON.stringify(f.evidence, null, 2)));
  const node = el("li", { class: `finding ${f.status}` },
    el("span", { class: "icon", "aria-label": LABEL[f.status] }, ICON[f.status]),
    el("span", { class: "fid" }, f.id),
    el("span", { class: "msg" }, f.message),
  );
  if (extra.childNodes.length) node.append(extra);
  return node;
}

function checkNode(check: CheckResult): HTMLElement {
  const details = el("details", { class: `check st-${check.status}` });
  if (check.status === "fail" || check.status === "warn" || check.status === "untestable") details.open = true;
  details.append(
    el("summary", {},
      el("span", { class: "check-id" }, check.id),
      el("span", { class: "check-name" }, check.name),
      el("span", { class: "check-meta" }, `${check.mode} · ${check.durationMs} ms`),
      el("span", { class: `tag ${check.status}` }, LABEL[check.status]),
    ),
    el("ul", { class: "findings" }, ...check.findings.map(findingNode)),
  );
  return details;
}

export function renderReport(report: Report | null): void {
  const section = $("report");
  section.hidden = report === null;
  if (!report) return;
  const worst = report.summary.worst;
  const stamp = $("stamp");
  stamp.className = `stamp ${worst}`;
  stamp.textContent = LABEL[worst].toUpperCase();
  $("report-title").textContent = `Report: ${LABEL[worst]}`;
  $("report-target").textContent = report.target.networkUrl ?? report.target.siteBase;
  const when = new Date(report.finishedAt);
  $("report-meta").textContent = `Checked ${when.toLocaleString()} from ${report.conform.environment} · spec ${report.conform.spec.specCommit.slice(0, 7)} · runtime nsdeploy ${report.conform.runtime.nsdeployCommit}`;
  const s = report.summary;
  $("counters").replaceChildren(
    ...([["pass", s.pass], ["fail", s.fail], ["warn", s.warn], ["info", s.info], ["untestable", s.untestable]] as const).map(([k, n]) =>
      el("li", { class: `c-${k}` }, el("b", {}, String(n)), k === "untestable" ? "untestable" : k),
    ),
  );
  $("checks-list").replaceChildren(...report.checks.map(checkNode));
  const planned = CATALOG.filter((c) => !c.automated).map((c) => c.id);
  $("not-yet").textContent = `A pass covers only the checks that ran. Not automated yet: ${planned.join(", ")} (see the table below).`;
}

export function renderCatalog(): void {
  const body = document.querySelector("#catalog-table tbody");
  if (!body) return;
  body.replaceChildren(
    ...CATALOG.map((c) =>
      el("tr", {},
        el("td", {}, c.id),
        el("td", { class: "name" }, c.name, el("small", {}, c.proves)),
        el("td", {}, c.spec.join(" ")),
        el("td", {}, c.mode),
        el("td", {}, el("span", { class: c.automated ? "auto" : "soon" }, c.automated ? "Auto" : "Soon")),
      ),
    ),
  );
}
