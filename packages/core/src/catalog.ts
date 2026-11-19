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

export interface FindingGuide {
  /** Why the finding fails, in terms of what the checker actually tests. */
  why: string;
  /** How to fix it. */
  fix: string;
}

// Per-finding explanations, written from what each check's code tests, so an assistant can explain a
// failure without guessing. Keys are finding ids; checks without an entry fall back to CATALOG.proves.
export const FINDING_GUIDE: Record<string, FindingGuide> = {
  "C1.1": { why: "There is no agent-manifest.json at the site base (the folder before the network name), it answered something other than HTTP 200, or it is not a JSON object.", fix: "Publish agent-manifest.json as a JSON object at <site base>/agent-manifest.json." },
  "C1.2": { why: "The manifest is not readable by a browser on another origin: it sends no Access-Control-Allow-Origin header, or one that names a different origin.", fix: "Serve agent-manifest.json (and the other public agent files) with Access-Control-Allow-Origin: *. Do not add it to business endpoints." },
  "C1.3": { why: "A required manifest field is missing or malformed: networks[] entries need name, front_man and hocon; the manifest needs llm_router (base_url and/or byok_router) and a peer policy (peer_policy with mode \"closed\" or \"open\", and/or allowed_peers).", fix: "Add the missing field; for example \"peer_policy\": {\"mode\": \"closed\"} with \"allowed_peers\": [] when the network calls no other site." },
  "C1.4": { why: "The site base is plain http on a host that is not loopback. The spec requires HTTPS outside local development.", fix: "Serve the site over HTTPS." },
  "C1.5": { why: "Fetching the manifest redirects to another origin. A redirect to another origin is a new destination that needs its own consent.", fix: "Serve the manifest directly at the site base, without a cross-origin redirect." },
  "C2.1": { why: "The last path segment of the URL is not exactly (case-sensitively) the name of a network in the manifest. A caller must then fail rather than run another network.", fix: "Use the exact name from networks[].name as the last path segment, or add the network to the manifest." },
  "C2.2": { why: "The manifest entry's hocon location does not resolve, does not answer HTTP 200, or the file does not parse as JSON (or the reference runtime's HOCON subset).", fix: "Publish the fully resolved network definition as JSON at the location hocon declares (relative to the site base, or an absolute https URL)." },
  "C2.3": { why: "The network definition is not readable by a browser on another origin (missing or wrong Access-Control-Allow-Origin).", fix: "Serve the definition file with Access-Control-Allow-Origin: *." },
  "C2.4": { why: "One of three things: the manifest entry has no front_man; front_man is not the name of any agent in the definition's tools[]; or, most often, the reference runtime does not read front_man at all: it runs the first entry in tools[] that has instructions (and no class or toolbox). When that is a different agent, the manifest advertises one entry point while callers actually run another.", fix: "Set front_man to the entry agent's exact name and put that agent first in tools[] (or make it the first agent with instructions). Republish and check again." },
  "C2.6": { why: "links.json is published but cannot be read cross-origin, is not valid JSON, has no networks object, or binds a reference to something that is not an http(s) network URL ending in a network name.", fix: "Use {\"version\": 1, \"networks\": {\"<network>\": {\"<reference>\": \"https://peer.example/<network name>\"}}} and serve it with Access-Control-Allow-Origin: *." },
  "C3.1": { why: "The definition has no non-empty tools[] array, an entry is not an object or has no name, or two agents share a name.", fix: "Describe every agent once in a top-level tools[] array, each with a unique name." },
  "C3.2": { why: "An LLM agent has no instructions (and is not a coded or toolbox tool), or its tools field is not an array.", fix: "Give each LLM agent instructions and a tools array (empty when it calls nothing)." },
  "C3.3": { why: "The reference runtime's validator rejects the network: an agent's tools[] names something that is neither an agent in this network, a full peer network URL, nor an MCP descriptor; or there is no front agent. Callers refuse to run such a network.", fix: "Fix or remove the reference so every tools[] entry resolves." },
  "C3.5": { why: "The published definition still depends on build-time or local features: an include directive, a ${...} substitution, a file:// URL or a local path.", fix: "Resolve includes and substitutions at build time and publish the expanded document." },
  "C3.6": { why: "A private-context allow rule (allow.to_downstream.sly_data or allow.to_upstream.sly_data) is not an array of field names, or allows \"*\".", fix: "List the exact field names that may cross, for example [\"customer_id\"]." },
  "C3.8": { why: "A credential-looking value (an API key, bearer token, JWT, or a field such as api_key or password with a value) appears in the public manifest or definition.", fix: "Remove it from the published files and rotate the credential; public agent files are public by design." },
  "C4.1": { why: "Asking a caller's reference runtime for a network name the site does not publish did not fail with the exact-name error.", fix: "Usually a manifest problem: check C1 and C2.1. The reference runtime itself refuses unknown names." },
  "C4.2": { why: "A caller's reference runtime could not fetch or validate the network (see the error in the finding; often the same problem as C2.2 or C3.3).", fix: "Fix the earlier failing finding; the network must parse and validate before any model call." },
  "C6.3": { why: "An agent references a peer network or MCP server on another origin that the site's own peer policy does not allow (mode \"closed\" without that origin in allowed_peers). The site's own runtime would refuse the call.", fix: "Add the origin to allowed_peers, or remove the reference." },
  "C7.1": { why: "In the scripted turn, the visitor's key or credentials reached something other than the caller's router.", fix: "Use the reference runtime unchanged; never attach the key to requests other than model calls to the selected router." },
  "C8.1": { why: "Private context reached the site's network without an allow rule.", fix: "Private-context fields must not cross network boundaries by default; use the reference runtime's filtering." },
  "C9.1": { why: "The caller's runtime contacted the site before asking for consent, or the consent request did not name the destination origin and the request.", fix: "Ask before every third-party contact, naming the origin and what will be sent." },
  "C9.3": { why: "The site's page does not visibly boot the reference runtime's UI (runtime/index.js boot()) or set its own consent handler. The reference engine allows every contact when no handler is attached.", fix: "Boot the runtime with its UI, or set engine.onConsent before the first message." },
};

/** The guide for a finding id, or every guide of a check id. */
export function findingGuides(id: string): Array<{ id: string } & FindingGuide> {
  const key = id.trim().toUpperCase();
  if (key.includes(".")) {
    const guide = FINDING_GUIDE[key];
    return guide ? [{ id: key, ...guide }] : [];
  }
  return Object.entries(FINDING_GUIDE).filter(([k]) => k.startsWith(`${key}.`)).map(([k, g]) => ({ id: k, ...g }));
}
