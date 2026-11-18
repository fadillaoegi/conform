// Entry point: the checker page and the assistant share one ConformPage.

import "@fontsource/press-start-2p/400.css";
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/600.css";
import "./styles.css";
import { SPEC, RUNTIME } from "@conform/core";
import { LOGO_SVG } from "./logo.ts";
import { ConformPage } from "./page.ts";
import { renderBadgePanel, renderDirectory, renderVerify, type BadgePanelState } from "./badges.ts";
import { renderCatalog, renderProgress, renderReport } from "./render.ts";
import { ConformService, type DirectoryEntry } from "./service.ts";
import { verifyBadge } from "./verify.ts";

declare global {
  // The actions module (public/site-actions.js) reads the page object from here.
  var __conform: { page: ConformPage } | undefined;
}

const page = new ConformPage();
globalThis.__conform = { page };

const form = document.querySelector<HTMLFormElement>("#check-form");
const input = document.querySelector<HTMLInputElement>("#url");
const run = document.querySelector<HTMLButtonElement>("#run");
const formError = document.querySelector<HTMLElement>("#form-error");
const list = document.querySelector<HTMLElement>("#checks-list");
const toolStatus = document.querySelector<HTMLElement>("#tool-status");

for (const slot of document.querySelectorAll<HTMLElement>("[data-logo]")) slot.innerHTML = LOGO_SVG; // static, trusted markup

const binding = document.querySelector("#binding");
if (binding) {
  binding.textContent = `Checks against the spec at commit ${SPEC.specCommit.slice(0, 7)} (${SPEC.profile}) and the reference runtime nsdeploy ${RUNTIME.nsdeployCommit}.`;
}

function showError(message: string): void {
  if (formError) formError.textContent = message;
  input?.setAttribute("aria-invalid", message ? "true" : "false");
}

// ---- Badges and directory (only when the Conform service answers on this origin) ----
const service = new ConformService(location.origin);
const badgeState: BadgePanelState = { available: false, report: null, issuing: false, badge: null, refusal: null };
let directoryEntries: DirectoryEntry[] = [];
const dirSearch = document.querySelector<HTMLInputElement>("#dir-search");

function refreshBadgePanel(): void {
  renderBadgePanel(badgeState, () => void issueBadge());
}

async function issueBadge(): Promise<void> {
  const url = badgeState.report?.target.networkUrl;
  if (!url || badgeState.issuing) return;
  badgeState.issuing = true;
  badgeState.refusal = null;
  refreshBadgePanel();
  try {
    const outcome = await service.issue(url);
    if (outcome.ok) {
      badgeState.badge = outcome.badge;
      await loadDirectory();
    } else {
      badgeState.refusal = outcome.reason;
    }
  } catch (error) {
    badgeState.refusal = `The badge service could not be reached: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    badgeState.issuing = false;
    refreshBadgePanel();
    document.querySelector<HTMLElement>("#badge-panel")?.focus?.();
  }
}

function checkFromDirectory(url: string): void {
  page.setInput(url);
  if (input) input.value = url;
  document.querySelector("#checker")?.scrollIntoView({ block: "start" });
  input?.focus();
}

async function loadDirectory(): Promise<void> {
  directoryEntries = await service.directory();
  renderDirectory(directoryEntries, dirSearch?.value ?? "", checkFromDirectory);
}

dirSearch?.addEventListener("input", () => renderDirectory(directoryEntries, dirSearch.value, checkFromDirectory));

async function showBadge(id: string): Promise<void> {
  try {
    const view = await service.badge(id);
    if (!view) return renderVerify(null, null, `There is no badge with id ${id}.`);
    renderVerify(view, null, null);
    document.querySelector("#verify")?.scrollIntoView({ block: "start" });
    const steps = await verifyBadge(view, await service.keys(), location.origin);
    renderVerify(view, steps, null);
  } catch (error) {
    renderVerify(null, null, `The badge could not be verified: ${error instanceof Error ? error.message : String(error)}`);
  }
}

let lastReportShown: unknown = null;
page.subscribe((state) => {
  renderProgress(state);
  if (state.report !== lastReportShown) {
    lastReportShown = state.report;
    renderReport(state.report);
    badgeState.report = state.report;
    badgeState.badge = null;
    badgeState.refusal = null;
    refreshBadgePanel();
    if (state.report) document.querySelector("#report")?.scrollIntoView({ block: "start" });
  }
  if (run) run.disabled = state.running;
  if (input && document.activeElement !== input && input.value !== state.input) input.value = state.input;
});

async function runCheck(url: string): Promise<void> {
  showError("");
  try {
    const result = await page.check(url);
    if (!result.ok) {
      showError(result.reason);
      input?.focus();
    }
  } catch {
    // The progress panel shows the error.
  }
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  void runCheck(input?.value ?? "");
});
input?.addEventListener("input", () => {
  page.setInput(input.value);
  if (formError?.textContent) showError("");
});

document.querySelector("#try-self")?.addEventListener("click", () => {
  const self = new URL("conform", document.baseURI).href;
  page.setInput(self);
  if (input) input.value = self;
  input?.focus();
});

document.querySelector<HTMLInputElement>("#only-problems")?.addEventListener("change", (e) => {
  list?.classList.toggle("only-problems", (e.target as HTMLInputElement).checked);
});
document.querySelector<HTMLInputElement>("#show-evidence")?.addEventListener("change", (e) => {
  list?.classList.toggle("with-evidence", (e.target as HTMLInputElement).checked);
});

function say(text: string): void {
  if (toolStatus) toolStatus.textContent = text;
}

document.querySelector("#copy-link")?.addEventListener("click", async () => {
  const report = page.state.report;
  if (!report) return;
  const link = new URL(location.pathname, location.origin);
  link.searchParams.set("url", report.target.input);
  try {
    await navigator.clipboard.writeText(link.href);
    say("Link copied. It opens the checker with this URL filled in; it runs only when someone presses Run.");
  } catch {
    say(link.href);
  }
});

document.querySelector("#download-json")?.addEventListener("click", () => {
  const report = page.state.report;
  if (!report) return;
  const blob = new Blob([`${JSON.stringify(report, null, 2)}\n`], { type: "application/json" });
  const a = document.createElement("a");
  const host = (() => {
    try {
      return new URL(report.target.siteBase).host.replace(/[^a-z0-9.-]/gi, "_");
    } catch {
      return "site";
    }
  })();
  a.href = URL.createObjectURL(blob);
  a.download = `conform-${host}-${report.finishedAt.slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  say("Report downloaded.");
});

// A shared link fills in the URL. It never runs a check by itself: contacting a site is the visitor's choice.
const shared = new URLSearchParams(location.search).get("url");
if (shared) page.setInput(shared.slice(0, 2048));

renderCatalog();
renderProgress(page.state);

void (async () => {
  badgeState.available = await service.available();
  refreshBadgePanel();
  if (!badgeState.available) return;
  await loadDirectory();
  const badgeId = new URLSearchParams(location.search).get("badge");
  if (badgeId && /^[A-Za-z0-9_-]{22}$/.test(badgeId)) await showBadge(badgeId);
})();

// The page works without the assistant; load it last.
void import("./assistant.ts").then(({ AssistantMount }) => AssistantMount.start(page));
