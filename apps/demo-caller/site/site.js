// Boots the reference runtime in the page (after the agentify-website skill's templates/site.js).
// No irreversible actions here, so only the consent card needs care: name it and move focus to it.
const GREETING = "I plan stays through our partners' agents. Before I ask a partner anything, I check it with Conform, and you approve each contact on a card.";

async function start() {
  const status = document.querySelector("#assistant-status");
  const siteBase = new URL("./", import.meta.url).href;
  try {
    const { boot } = await import("./runtime/index.js");
    const booted = await boot("#agent-app", { originUrl: siteBase, sandboxWorkerUrl: new URL("runtime/sandbox-worker.js", siteBase).href });
    const engine = booted.engine;
    const defaultConsent = engine.onConsent;
    engine.onConsent = async (info) => {
      const answer = defaultConsent(info);
      const cards = document.querySelectorAll("#ns-msgs .ns-consent");
      const card = cards[cards.length - 1];
      const title = card?.querySelector(".ns-consent-title");
      if (card && title) {
        card.setAttribute("role", "group");
        card.setAttribute("aria-label", title.textContent);
        title.tabIndex = -1;
        title.focus();
      }
      const decision = await answer;
      if (document.activeElement === document.body) document.querySelector("#ns-input")?.focus();
      return decision;
    };
    const needsKey = !engine.mockLLM && (!engine.byokKey || engine.byokKey === "demo");
    status.textContent = needsKey ? "Add your AI provider key in AI model settings below to start." : "Assistant connected.";
    if (!needsKey) {
      const first = document.querySelector("#ns-msgs .ns-msg.bot");
      if (first) first.textContent = GREETING;
    }
  } catch (error) {
    status.textContent = "The assistant could not load. You can still read the page.";
    console.error("Assistant startup failed", error);
  }
}

if (typeof window !== "undefined") await start();
