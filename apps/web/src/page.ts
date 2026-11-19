// The page object: the single source of state and operations for the Conform page. The page's own
// form and the assistant's website_* actions both call these methods, so they follow one set of rules.

import { CATALOG, checkInfo, checkNetwork, findingGuides, compactReport, parseInput, type CheckOptions, type CheckResult, type CompactReport, type Report } from "@conform/core";

export { compactReport, type CompactReport } from "@conform/core";

export interface Refusal {
  ok: false;
  reason: string;
  field?: string;
}

export interface PageState {
  input: string;
  running: boolean;
  progress: CheckResult[];
  report: Report | null;
  error: string | null;
  lastRun: { url: string; at: number } | null;
}

export type Checker = (input: string, options?: CheckOptions) => Promise<Report>;

const COOLDOWN_MS = 5_000;
const MAX_MESSAGE = 300;

function clip(text: string, max = MAX_MESSAGE): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export class ConformPage {
  state: PageState = { input: "", running: false, progress: [], report: null, error: null, lastRun: null };
  private readonly listeners = new Set<(state: PageState) => void>();
  private readonly checker: Checker;
  private readonly now: () => number;

  constructor(options: { checker?: Checker; now?: () => number } = {}) {
    this.checker = options.checker ?? checkNetwork;
    this.now = options.now ?? Date.now;
  }

  subscribe(listener: (state: PageState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }

  setInput(input: string): void {
    this.state = { ...this.state, input };
    this.emit();
  }

  /** The read-only check behind both the form and the assistant's confirmation dialog. */
  validate(url: string): Refusal | { ok: true; url: string; origin: string; networkUrl: string | null } {
    const value = url.trim();
    if (!value) return { ok: false, reason: "Enter the URL of an agentic website or one of its networks.", field: "url" };
    const { target, problems } = parseInput(value);
    if (problems.length) return { ok: false, reason: problems.join(" "), field: "url" };
    if (this.state.running) return { ok: false, reason: "A check is already running. Wait for it to finish." };
    const last = this.state.lastRun;
    if (last && new URL(last.url).origin === target.origin && this.now() - last.at < COOLDOWN_MS) {
      return { ok: false, reason: "This site was checked a moment ago. Wait a few seconds before checking it again." };
    }
    return { ok: true, url: value, origin: target.origin, networkUrl: target.networkUrl };
  }

  /** Run every automated check against the URL and keep the report on the page. */
  async check(url: string): Promise<CompactReport | Refusal> {
    const valid = this.validate(url);
    if (!valid.ok) return valid;
    this.state = { ...this.state, input: valid.url, running: true, progress: [], error: null, report: null, lastRun: { url: valid.url, at: this.now() } };
    this.emit();
    try {
      const report = await this.checker(valid.url, {
        onCheck: (result) => {
          this.state = { ...this.state, progress: [...this.state.progress, result] };
          this.emit();
        },
      });
      this.state = { ...this.state, running: false, report };
      this.emit();
      return compactReport(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state = { ...this.state, running: false, error: message };
      this.emit();
      throw error;
    }
  }

  /** Which URLs this page can check, stated as a fact so the assistant never has to guess. */
  urlRules(): string {
    const host = (globalThis as { location?: { hostname?: string } }).location?.hostname ?? "";
    const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    const format = "Give a network URL: the folder that holds agent-manifest.json, then the network name (for example https://example.org/agents/assistant when https://example.org/agents/agent-manifest.json exists), or a site folder ending in /.";
    return local
      ? `Conform is running on this machine, so it can check https sites and local http sites (http://localhost:<port>, http://127.0.0.1:<port>). ${format}`
      : `This page checks https sites; its security policy refuses plain http URLs. ${format}`;
  }

  /** Plain JSON for the assistant: what the checker shows right now. */
  getState(): Record<string, unknown> {
    return {
      urlRules: this.urlRules(),
      checkerInput: this.state.input,
      running: this.state.running,
      report: this.state.report ? compactReport(this.state.report) : null,
      lastError: this.state.error,
      automatedChecks: CATALOG.filter((c) => c.automated).map((c) => `${c.id} ${c.name}`),
      notAutomated: CATALOG.filter((c) => !c.automated).map((c) => `${c.id} ${c.name}`),
    };
  }

  /** What a check or finding id means, plus the matching findings of the current report. */
  explain(id: string): Record<string, unknown> | Refusal {
    const info = checkInfo(id);
    if (!info) {
      return { ok: false, reason: `"${id}" is not a Conform check id. Use C1 to C14, or a finding id such as C2.4.`, field: "id" };
    }
    const findingId = id.trim().toUpperCase();
    const findings = (this.state.report?.checks ?? [])
      .flatMap((c) => c.findings)
      .filter((f) => (findingId.includes(".") ? f.id === findingId : f.id.startsWith(`${info.id}.`)))
      .slice(0, 10)
      .map((f) => ({ id: f.id, status: f.status, message: clip(f.message), fix: f.suggestion ? clip(f.suggestion) : undefined, spec: f.spec }));
    const guide = findingGuides(id);
    // A ready-made answer: small models relay text more faithfully than they rebuild it from fields.
    const explanation = [
      `${info.id} ${info.name} (${info.automated ? "automated" : "planned"}; spec ${info.spec.join(", ")}): ${info.proves}`,
      ...guide.map((g) => `${g.id} fails when: ${g.why}\nFix: ${g.fix}`),
      ...findings.map((f) => `In the current report, ${f.id} is ${f.status}: ${f.message}`),
    ].join("\n\n");
    return { ok: true, explanation, check: info, guide, findingsInCurrentReport: findings };
  }
}
