// Rendering for the badge panel, the verification view and the directory. Text from other sites is
// written with textContent only.

import type { Report } from "@conform/core";
import { el } from "./render.ts";
import type { BadgeView, DirectoryEntry } from "./service.ts";
import type { VerifyStep } from "./verify.ts";

const MARK = { pass: "✔", fail: "✖", warn: "▲" } as const;

export interface BadgePanelState {
  available: boolean;
  report: Report | null;
  issuing: boolean;
  badge: BadgeView | null;
  refusal: string | null;
}

function $(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
}

function copyButton(label: string, text: () => string): HTMLButtonElement {
  const button = el("button", { type: "button", class: "px-btn px-btn-small" }, label);
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text());
      button.textContent = "Copied";
      setTimeout(() => (button.textContent = label), 1500);
    } catch {
      button.textContent = "Select and copy";
    }
  });
  return button;
}

export function embedSnippets(badge: BadgeView): { markdown: string; html: string } {
  return {
    markdown: `[![Conform: Worldwide Agentic Web MVP](${badge.links.svg})](${badge.links.page})`,
    html: `<a href="${badge.links.page}"><img src="${badge.links.svg}" alt="Conform conformance badge"></a>`,
  };
}

export function renderBadgePanel(state: BadgePanelState, onIssue: () => void): void {
  const panel = $("badge-panel");
  panel.hidden = !state.available || state.report === null;
  if (panel.hidden || !state.report) return;
  panel.replaceChildren(el("h3", { class: "px-h3" }, "Signed badge"));
  if (state.badge) {
    const snippets = embedSnippets(state.badge);
    const md = el("textarea", { class: "snippet", readonly: "", rows: "2", "aria-label": "Markdown snippet" });
    md.value = snippets.markdown;
    const html = el("textarea", { class: "snippet", readonly: "", rows: "2", "aria-label": "HTML snippet" });
    html.value = snippets.html;
    panel.append(
      el("p", { class: "badge-preview" }, el("img", { src: state.badge.links.svg, alt: `Conform badge: ${state.badge.payload.result}`, height: "20" })),
      el("p", {}, `Badge ${state.badge.id} is signed and valid until ${state.badge.payload.expiresAt.slice(0, 10)}. It turns stale if the site's manifest or network changes.`),
      el("label", { class: "px-label" }, "Markdown"), md, copyButton("Copy Markdown", () => snippets.markdown),
      el("label", { class: "px-label" }, "HTML"), html, copyButton("Copy HTML", () => snippets.html),
      el("p", {}, el("a", { href: `?badge=${encodeURIComponent(state.badge.id)}#verify` }, "Verify this badge in your browser")),
    );
    return;
  }
  if (state.report.summary.fail > 0) {
    panel.append(el("p", { class: "hint" }, "Fix every failing finding, then check again to get a signed badge."));
    return;
  }
  const button = el("button", { type: "button", class: "px-btn px-btn-go", id: "issue-badge" }, state.issuing ? "Signing…" : "Get a signed badge");
  button.disabled = state.issuing;
  button.addEventListener("click", onIssue);
  panel.append(
    el("p", {}, "Conform's server runs every check again itself, signs the result with Ed25519, and lists the site in the directory."),
    button,
  );
  if (state.refusal) panel.append(el("p", { class: "form-error", role: "alert" }, state.refusal));
}

export function renderVerify(badge: BadgeView | null, steps: VerifyStep[] | null, error: string | null): void {
  const section = $("verify");
  section.hidden = false;
  const body = $("verify-body");
  if (error || !badge) {
    body.replaceChildren(el("p", { class: "form-error" }, error ?? "No such badge."));
    return;
  }
  const ok = steps !== null && steps.every((s) => s.status === "pass");
  const failed = steps?.some((s) => s.status === "fail") ?? false;
  body.replaceChildren(
    el("p", { class: "badge-preview" }, el("img", { src: badge.links.svg, alt: `Conform badge: ${badge.payload.result}`, height: "20" })),
    el("p", { class: "target" }, badge.payload.network),
    el("p", { class: "hint" }, `${badge.site.brand ?? "Unnamed site"} · ${badge.payload.result.toUpperCase()} · issued ${badge.payload.issuedAt.slice(0, 10)} · expires ${badge.payload.expiresAt.slice(0, 10)} · spec ${badge.payload.spec.commit.slice(0, 7)} · server says: ${badge.state}`),
    el("p", { class: `verdict ${ok ? "pass" : failed ? "fail" : "warn"}` }, steps === null ? "Verifying…" : ok ? "Verified in this browser" : failed ? "Not valid" : "Partly verified"),
    el("ul", { class: "steps" }, ...(steps ?? []).map((s) => el("li", { class: `finding ${s.status}` },
      el("span", { class: "icon" }, MARK[s.status]), el("span", { class: "fid" }, ""), el("span", { class: "msg" }, `${s.label}: ${s.detail}`)))),
  );
}

export function renderDirectory(entries: DirectoryEntry[], filter: string, onCheck: (url: string) => void): void {
  $("directory").hidden = false;
  const q = filter.trim().toLowerCase();
  const shown = entries.filter((e) => !q || [e.brand ?? "", e.description ?? "", e.network, ...e.tags].join(" ").toLowerCase().includes(q));
  const empty = $("dir-empty");
  empty.hidden = shown.length > 0;
  empty.textContent = entries.length === 0 ? "No badged sites yet. Check yours and get the first badge." : "No site matches that search.";
  $("dir-list").replaceChildren(...shown.map((e) => {
    const check = el("button", { type: "button", class: "px-chip" }, "Check now");
    check.addEventListener("click", () => onCheck(e.network));
    return el("li", { class: `dir-card${e.expired ? " expired" : ""}` },
      el("div", { class: "dir-head" },
        el("span", { class: "dir-brand" }, e.brand ?? new URL(e.network).host),
        el("span", { class: `tag ${e.expired ? "info" : e.result}` }, e.expired ? "Expired" : e.result === "pass" ? "Pass" : "Warn")),
      el("p", { class: "dir-desc" }, e.description ?? ""),
      el("p", { class: "dir-url" }, e.network),
      el("div", { class: "dir-tags" }, ...e.tags.map((t) => el("span", {}, t))),
      el("div", { class: "dir-actions" }, check, el("a", { href: `?badge=${encodeURIComponent(e.badgeId)}#verify` }, "Verify badge")),
    );
  }));
}
