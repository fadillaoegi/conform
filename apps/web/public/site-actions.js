// Registers Conform's page operations with the agent runtime (agent-manifest.json -> actions.module).
// The page script (src/main.ts) creates one ConformPage and publishes it as globalThis.__conform.page
// before the assistant boots; these actions only wrap its methods, so the assistant and the page's
// own form share one set of rules. Only names in actions.agentTools become website_* tools.

function page() {
  const app = globalThis.__conform;
  if (!app || !app.page) throw new Error("The Conform page is not ready.");
  return app.page;
}

class SiteActions {
  static registerActions(actions) {
    actions.register(SiteActions.getPageState());
    actions.register(SiteActions.checkSite());
    actions.register(SiteActions.explainCheck());
  }

  static getPageState() {
    return {
      name: "get_page_state",
      description: "Read what the Conform page shows now: the URL in the checker, whether a check is running, the latest report (every check with its status and its fail, warn and untestable findings with fixes), and which checks are automated or planned.",
      effect: "read",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: () => page().getState(),
    };
  }

  static checkSite() {
    return {
      name: "check_site",
      description: "Run Conform's automated checks (C1 to C9) against a public agentic website and show the report on the page. Reads only the site's public agent files. The browser asks the visitor to confirm first, because it contacts that site. Returns the compact report, or ok false with a reason.",
      // "irreversible" makes the runtime ask before the call: contacting another origin cannot be undone.
      effect: "irreversible",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["url"],
        properties: {
          url: {
            type: "string",
            minLength: 8,
            maxLength: 2048,
            description: "The exact URL the visitor gave: a network URL (site folder, then network name), a site base ending in /, or an agent-manifest.json URL.",
          },
        },
      },
      execute: (args) => page().check(args.url),
    };
  }

  static explainCheck() {
    return {
      name: "explain_check",
      description: "Explain one Conform check or finding id (such as C3 or C2.4): what it proves, its spec sections, whether it is automated, and the matching findings in the current report.",
      effect: "read",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["id"],
        properties: {
          id: { type: "string", minLength: 2, maxLength: 8, description: "A check id such as C3, or a finding id such as C2.4." },
        },
      },
      execute: (args) => page().explain(args.id),
    };
  }
}

export const registerActions = SiteActions.registerActions;
