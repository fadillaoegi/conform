// Mounts the reference runtime's assistant in the page (a TypeScript port of the agentify-website
// skill's templates/site.js). The runtime is loaded from /runtime/, unchanged, at run time.

import type { ConformPage } from "./page.ts";

interface ActionItem {
  action: string;
  origin: string;
  effect: string;
  arguments: Record<string, unknown>;
}

interface DialogWords {
  title: string;
  sentence: string;
  confirm: string;
  decline: string;
}

interface DialogContent extends DialogWords {
  details: Record<string, string>;
  refusal?: string;
  exact: string;
}

type Review = (items: ActionItem[]) => Promise<boolean>;
type Consent = (info: Record<string, unknown>) => Promise<string>;

interface Engine {
  mockLLM: boolean;
  byokKey: string;
  onActionConfirm: Review;
  onConsent: Consent;
}

export class AssistantMount {
  static GREETING = "I can check an agentic website against the MVP spec, explain any result such as C2.4, and suggest the fix. Give me a network URL, or ask about the report above.";

  static DIALOGS: Record<string, DialogWords> = {
    check_site: {
      title: "Check this site?",
      sentence: "Conform will read this site's public agent files, as another site's browser would. Nothing else is sent to it.",
      confirm: "Run the check",
      decline: "Don't check",
    },
  };

  static page: ConformPage;
  static engine: Engine | null = null;
  static defaultReview: Review;
  static defaultConsent: Consent;

  static async start(page: ConformPage): Promise<Engine | null> {
    AssistantMount.page = page;
    const status = document.querySelector<HTMLElement>("#assistant-status");
    const siteBase = new URL("./", document.baseURI).href;
    try {
      const runtimeUrl = new URL("runtime/index.js", siteBase).href;
      const { boot } = (await import(/* @vite-ignore */ runtimeUrl)) as {
        boot: (selector: string, options: Record<string, string>) => Promise<{ engine: Engine }>;
      };
      const booted = await boot("#agent-app", {
        originUrl: siteBase,
        sandboxWorkerUrl: new URL("runtime/sandbox-worker.js", siteBase).href,
      });
      const engine = booted.engine;
      AssistantMount.engine = engine;
      AssistantMount.defaultReview = engine.onActionConfirm;
      engine.onActionConfirm = AssistantMount.review;
      AssistantMount.defaultConsent = engine.onConsent;
      engine.onConsent = AssistantMount.consent;
      const needsKey = !engine.mockLLM && (!engine.byokKey || engine.byokKey === "demo");
      if (status) {
        status.textContent = needsKey
          ? "Add your AI provider key in AI model settings below to start."
          : "Assistant connected to this page.";
      }
      document.querySelector("#assistant")?.classList.add("ready");
      if (!needsKey) AssistantMount.greet();
      return engine;
    } catch (error) {
      if (status) status.textContent = "The assistant could not load. You can still use the checker directly.";
      console.error("Assistant startup failed", error);
      return null;
    }
  }

  static greet(): void {
    const first = document.querySelector("#ns-msgs .ns-msg.bot");
    if (first) first.textContent = AssistantMount.GREETING;
  }

  static async review(items: ActionItem[]): Promise<boolean> {
    const pageOrigin = new URL(document.URL).origin;
    if (items.length > 1) {
      for (const item of items) {
        const words = AssistantMount.DIALOGS[item.action];
        if (item.origin === pageOrigin && words) {
          throw new Error(`Nothing ran. "${words.confirm}" needs its own confirmation, so ask the assistant to do that on its own.`);
        }
      }
    }
    const first = items[0];
    let confirmed: boolean;
    if (items.length === 1 && first && first.origin === pageOrigin && AssistantMount.DIALOGS[first.action]) {
      const content = AssistantMount.dialogContent(first);
      if (content.refusal) throw new Error(content.refusal);
      confirmed = await new Promise<boolean>((resolve) => AssistantMount.openDialog(content, resolve));
    } else {
      confirmed = await AssistantMount.defaultReview(items);
    }
    AssistantMount.keepFocusInChat();
    return confirmed;
  }

  static async consent(info: Record<string, unknown>): Promise<string> {
    const answer = AssistantMount.defaultConsent(info);
    AssistantMount.focusConsentCard();
    const decision = await answer;
    AssistantMount.keepFocusInChat();
    return decision;
  }

  static focusConsentCard(): void {
    const cards = document.querySelectorAll("#ns-msgs .ns-consent");
    const card = cards[cards.length - 1];
    const title = card?.querySelector<HTMLElement>(".ns-consent-title");
    if (!card || !title) return;
    card.setAttribute("role", "group");
    card.setAttribute("aria-label", title.textContent ?? "");
    const active = document.activeElement;
    if (active && active !== document.body && !active.closest("#agent-app")) return;
    title.tabIndex = -1;
    title.focus();
  }

  /** The dialog's words, readable details from the page's own read-only check, and the exact call. */
  static dialogContent(item: ActionItem): DialogContent {
    const words = AssistantMount.DIALOGS[item.action] as DialogWords;
    let details: Record<string, string> = {};
    let refusal: string | undefined;
    if (item.action === "check_site") {
      const url = typeof item.arguments["url"] === "string" ? item.arguments["url"] : "";
      const valid = AssistantMount.page.validate(url);
      if (!valid.ok) refusal = valid.reason;
      else {
        details = {
          "Site": valid.origin,
          "URL": valid.url,
          "Reads": "agent-manifest.json, the network definition it names, links.json",
          "Sends": "Ordinary GET requests, no cookies, no key",
        };
      }
    }
    const content: DialogContent = {
      ...words,
      details,
      exact: `${item.action} on ${item.origin} (${item.effect})\n${JSON.stringify(item.arguments, null, 2)}`,
    };
    if (refusal) content.refusal = refusal;
    return content;
  }

  static openDialog(content: DialogContent, resolve: (confirmed: boolean) => void): void {
    const dialog = document.createElement("dialog");
    dialog.className = "assistant-review";
    dialog.setAttribute("aria-labelledby", "assistant-review-title");
    const heading = document.createElement("h2");
    heading.id = "assistant-review-title";
    heading.textContent = content.title;
    heading.tabIndex = -1;
    heading.autofocus = true;
    const sentence = document.createElement("p");
    sentence.textContent = content.sentence;
    dialog.append(heading, sentence);
    const exact = document.createElement("details");
    const exactLabel = document.createElement("summary");
    exactLabel.textContent = "Technical details";
    const exactText = document.createElement("pre");
    exactText.textContent = content.exact;
    exact.append(exactLabel, exactText);
    const entries = Object.entries(content.details);
    if (entries.length) {
      const list = document.createElement("dl");
      for (const [label, value] of entries) {
        const term = document.createElement("dt");
        term.textContent = label;
        const description = document.createElement("dd");
        description.textContent = value;
        list.append(term, description);
      }
      dialog.append(list);
    } else {
      exact.open = true;
    }
    const confirmButton = document.createElement("button");
    confirmButton.textContent = content.confirm;
    confirmButton.addEventListener("click", () => dialog.close("confirm"));
    const declineButton = document.createElement("button");
    declineButton.className = "assistant-decline";
    declineButton.textContent = content.decline;
    declineButton.addEventListener("click", () => dialog.close("decline"));
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(dialog.returnValue === "confirm");
    });
    dialog.append(exact, confirmButton, declineButton);
    document.body.append(dialog);
    dialog.showModal();
  }

  static keepFocusInChat(): void {
    if (document.activeElement === document.body || document.activeElement === null) {
      document.querySelector<HTMLElement>("#ns-input")?.focus();
    }
  }
}
