// What each Conform check proves, for the report UI and the assistant's explain_check action.
// Kept in step with docs/TEST-MATRIX.md and README.md. Shared by the site, the server (MCP) and the CLI.

export interface CheckInfo {
  id: string;
  name: string;
  spec: string[];
  mode: "static" | "harness" | "browser";
  automated: boolean;
  proves: string;
}

export const CATALOG: CheckInfo[] = [
  { id: "C1", name: "Manifest", spec: ["§3.2.1", "§3.2.5", "§3.3", "§3.4", "§5"], mode: "static", automated: true,
    proves: "agent-manifest.json is published at the site base, is a JSON object, can be read by a browser on another origin (CORS), lists networks with name, front_man and hocon, declares router metadata and a peer policy, uses HTTPS (loopback http only for development), and does not redirect to another origin." },
  { id: "C2", name: "Network entry", spec: ["§3.2.5", "§3.2.6", "§3.3"], mode: "static", automated: true,
    proves: "The requested network name matches a manifest entry exactly; its hocon location resolves, is readable cross-origin and parses; links.json, when present, maps references to proper network URLs; and the manifest's front_man is the agent the reference runtime actually runs." },
  { id: "C3", name: "Definition", spec: ["§2", "§2.1", "§2.2", "§3.1", "§5"], mode: "static", automated: true,
    proves: "The network definition follows the Neuro SAN data model: unique agent names, instructions for LLM agents, references that resolve, a front agent; it is data-only (no include, no ${...} substitutions, no local paths); private-context allow rules name fields explicitly; and no credentials appear in public files." },
  { id: "C4", name: "Exact name", spec: ["§3.2.5", "§3.2", "§5"], mode: "harness", automated: true,
    proves: "In a caller's reference runtime, asking for a network name the site does not publish fails closed instead of running another network, and the exact name loads and validates without any model call." },
  { id: "C5", name: "Limits", spec: ["§3.1", "§3.2.9", "§5"], mode: "harness", automated: true,
    proves: "A composition cycle, the composition depth limit and the per-message budgets (peer calls, agent calls, elapsed time) stop with visible errors before the site is contacted; repeating an internal agent is bounded by budget, not treated as a cycle." },
  { id: "C6", name: "Origin policy", spec: ["§2.1", "§3.2.9", "§3.3", "§5"], mode: "harness", automated: true,
    proves: "A caller whose peer policy does not allow the site refuses it before any contact, and every peer network or MCP server the site's own agents reference is allowed by the site's own peer policy." },
  { id: "C7", name: "Key never leaves", spec: ["§3.2.2", "§4"], mode: "harness", automated: true,
    proves: "In a scripted conversation turn with a random canary key, only the caller's router receives the key; the site gets plain requests for its public files, its manifest cannot switch the router, and the key appears in no prompt or trace." },
  { id: "C8", name: "Private context", spec: ["§3.2.7", "§5"], mode: "harness", automated: true,
    proves: "Private context (sly_data) never reaches the site's network by default, and with an allow rule only the named field crosses." },
  { id: "C9", name: "Consent", spec: ["§3.2.4", "§5"], mode: "harness", automated: true,
    proves: "A caller's runtime asks before the first request to the site, naming its origin and the request; a decline sends nothing; and the site's own page wires a consent card for its visitors." },
  { id: "C10", name: "Runtime fingerprint", spec: ["§3"], mode: "static", automated: false,
    proves: "Planned: the runtime a site ships matches a known reference version." },
  { id: "C11", name: "Write confirmation", spec: ["§3.1", "§5"], mode: "browser", automated: false,
    proves: "Planned: writes show destination and arguments first; unknown outcomes are reported and never retried." },
  { id: "C12", name: "Coded-tool integrity", spec: ["§3.2", "§5"], mode: "static", automated: false,
    proves: "Planned: a declared coded-tool bundle has a valid SRI digest and runs isolated." },
  { id: "C13", name: "Publisher links", spec: ["§3.3"], mode: "harness", automated: false,
    proves: "Planned: a runtime-supplied link binding never rewrites the publisher's links.json." },
  { id: "C14", name: "BYOK panel", spec: ["§4"], mode: "browser", automated: false,
    proves: "Planned: router, model and key can be entered, a missing key stops with a clear error, and stored profiles can be deleted." },
];

export function checkInfo(id: string): CheckInfo | null {
  const checkId = id.trim().toUpperCase().split(".")[0] ?? "";
  return CATALOG.find((c) => c.id === checkId) ?? null;
}
