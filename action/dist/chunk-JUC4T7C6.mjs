// ../core/src/url.ts
var LOOPBACK_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
function isLoopbackHost(hostname) {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}
function isHttpUrl(value) {
  try {
    const url2 = new URL(value);
    return url2.protocol === "http:" || url2.protocol === "https:";
  } catch {
    return false;
  }
}
function originOf(value) {
  try {
    const url2 = new URL(value);
    if (url2.protocol !== "http:" && url2.protocol !== "https:") return null;
    return url2.origin;
  } catch {
    return null;
  }
}
function isSecureEnough(value) {
  try {
    const url2 = new URL(value);
    return url2.protocol === "https:" || url2.protocol === "http:" && isLoopbackHost(url2.hostname);
  } catch {
    return false;
  }
}
function trimSlash(value) {
  return value.replace(/\/$/, "");
}
var FILE_LIKE = /\.(json|html?|hocon|js|mjs)$/i;
function parseInput(input) {
  const problems = [];
  const raw = input.trim();
  let url2 = null;
  try {
    url2 = new URL(raw);
  } catch {
    url2 = null;
  }
  if (url2 === null || url2.protocol !== "http:" && url2.protocol !== "https:") {
    problems.push(`"${raw}" is not a full http or https URL.`);
    return { target: { input: raw, siteBase: "", origin: "", networkName: null, networkUrl: null }, problems };
  }
  if (url2.search || url2.hash) {
    problems.push("A network URL must have no query string or fragment.");
  }
  url2.search = "";
  url2.hash = "";
  const segments = url2.pathname.split("/");
  const last = segments[segments.length - 1] ?? "";
  if (last === "" || FILE_LIKE.test(last)) {
    const base2 = trimSlash(new URL("./", url2).href);
    return { target: { input: raw, siteBase: base2, origin: url2.origin, networkName: null, networkUrl: null }, problems };
  }
  const base = trimSlash(new URL("./", url2).href);
  return {
    target: { input: raw, siteBase: base, origin: url2.origin, networkName: last, networkUrl: `${base}/${last}` },
    problems
  };
}

// ../core/src/spec.ts
var CONFORM_VERSION = "0.1.0";
var SPEC = {
  repo: "https://github.com/cognizant-ai-labs/agentic-web",
  repoCommit: "63a956cf4653f610b1c238c70946f4d7647d17a8",
  repoCommitDate: "2026-11-13",
  path: "docs/worldwide_agentic_web_mvp_spec.md",
  specCommit: "fd872b9221aeb8ff762b75a5badbf84b23c133cc",
  specCommitDate: "2026-11-10",
  profile: "MVP Profile 0.2 (6 November 2026)"
};
var RUNTIME = {
  name: "agentify-website skill runtime (nsdeploy browser runtime + skill edits)",
  upstreamPath: "skills/agentify-website/runtime",
  repoCommit: SPEC.repoCommit,
  nsdeployCommit: "53a787c",
  nsdeployCommitDate: "2026-11-11",
  // Limits the pinned runtime enforces per visitor message (runtime/engine.js, runTurn).
  limits: {
    maxRemoteCalls: 4,
    maxCallsPerPeer: 1,
    maxAgentCalls: 24,
    deadlineMs: 9e4,
    maxCompositionDepth: 5,
    defaultMaxSteps: 12
  }
};

// ../core/src/catalog.ts
var CATALOG = [
  {
    id: "C1",
    name: "Manifest",
    spec: ["\xA73.2.1", "\xA73.2.5", "\xA73.3", "\xA73.4", "\xA75"],
    mode: "static",
    automated: true,
    proves: "agent-manifest.json is published at the site base, is a JSON object, can be read by a browser on another origin (CORS), lists networks with name, front_man and hocon, declares router metadata and a peer policy, uses HTTPS (loopback http only for development), and does not redirect to another origin."
  },
  {
    id: "C2",
    name: "Network entry",
    spec: ["\xA73.2.5", "\xA73.2.6", "\xA73.3"],
    mode: "static",
    automated: true,
    proves: "The requested network name matches a manifest entry exactly; its hocon location resolves, is readable cross-origin and parses; links.json, when present, maps references to proper network URLs; and the manifest's front_man is the agent the reference runtime actually runs."
  },
  {
    id: "C3",
    name: "Definition",
    spec: ["\xA72", "\xA72.1", "\xA72.2", "\xA73.1", "\xA75"],
    mode: "static",
    automated: true,
    proves: "The network definition follows the Neuro SAN data model: unique agent names, instructions for LLM agents, references that resolve, a front agent; it is data-only (no include, no ${...} substitutions, no local paths); private-context allow rules name fields explicitly; and no credentials appear in public files."
  },
  {
    id: "C4",
    name: "Exact name",
    spec: ["\xA73.2.5", "\xA73.2", "\xA75"],
    mode: "harness",
    automated: true,
    proves: "In a caller's reference runtime, asking for a network name the site does not publish fails closed instead of running another network, and the exact name loads and validates without any model call."
  },
  {
    id: "C5",
    name: "Limits",
    spec: ["\xA73.1", "\xA73.2.9", "\xA75"],
    mode: "harness",
    automated: true,
    proves: "A composition cycle, the composition depth limit and the per-message budgets (peer calls, agent calls, elapsed time) stop with visible errors before the site is contacted; repeating an internal agent is bounded by budget, not treated as a cycle."
  },
  {
    id: "C6",
    name: "Origin policy",
    spec: ["\xA72.1", "\xA73.2.9", "\xA73.3", "\xA75"],
    mode: "harness",
    automated: true,
    proves: "A caller whose peer policy does not allow the site refuses it before any contact, and every peer network or MCP server the site's own agents reference is allowed by the site's own peer policy."
  },
  {
    id: "C7",
    name: "Key never leaves",
    spec: ["\xA73.2.2", "\xA74"],
    mode: "harness",
    automated: true,
    proves: "In a scripted conversation turn with a random canary key, only the caller's router receives the key; the site gets plain requests for its public files, its manifest cannot switch the router, and the key appears in no prompt or trace."
  },
  {
    id: "C8",
    name: "Private context",
    spec: ["\xA73.2.7", "\xA75"],
    mode: "harness",
    automated: true,
    proves: "Private context (sly_data) never reaches the site's network by default, and with an allow rule only the named field crosses."
  },
  {
    id: "C9",
    name: "Consent",
    spec: ["\xA73.2.4", "\xA75"],
    mode: "harness",
    automated: true,
    proves: "A caller's runtime asks before the first request to the site, naming its origin and the request; a decline sends nothing; and the site's own page wires a consent card for its visitors."
  },
  {
    id: "C10",
    name: "Runtime fingerprint",
    spec: ["\xA73"],
    mode: "static",
    automated: false,
    proves: "Planned: the runtime a site ships matches a known reference version."
  },
  {
    id: "C11",
    name: "Write confirmation",
    spec: ["\xA73.1", "\xA75"],
    mode: "browser",
    automated: false,
    proves: "Planned: writes show destination and arguments first; unknown outcomes are reported and never retried."
  },
  {
    id: "C12",
    name: "Coded-tool integrity",
    spec: ["\xA73.2", "\xA75"],
    mode: "static",
    automated: false,
    proves: "Planned: a declared coded-tool bundle has a valid SRI digest and runs isolated."
  },
  {
    id: "C13",
    name: "Publisher links",
    spec: ["\xA73.3"],
    mode: "harness",
    automated: false,
    proves: "Planned: a runtime-supplied link binding never rewrites the publisher's links.json."
  },
  {
    id: "C14",
    name: "BYOK panel",
    spec: ["\xA74"],
    mode: "browser",
    automated: false,
    proves: "Planned: router, model and key can be entered, a missing key stops with a clear error, and stored profiles can be deleted."
  }
];
function checkInfo(id) {
  const checkId = id.trim().toUpperCase().split(".")[0] ?? "";
  return CATALOG.find((c) => c.id === checkId) ?? null;
}
var FINDING_GUIDE = {
  "C1.1": { why: "There is no agent-manifest.json at the site base (the folder before the network name), it answered something other than HTTP 200, or it is not a JSON object.", fix: "Publish agent-manifest.json as a JSON object at <site base>/agent-manifest.json." },
  "C1.2": { why: "The manifest is not readable by a browser on another origin: it sends no Access-Control-Allow-Origin header, or one that names a different origin.", fix: "Serve agent-manifest.json (and the other public agent files) with Access-Control-Allow-Origin: *. Do not add it to business endpoints." },
  "C1.3": { why: 'A required manifest field is missing or malformed: networks[] entries need name, front_man and hocon; the manifest needs llm_router (base_url and/or byok_router) and a peer policy (peer_policy with mode "closed" or "open", and/or allowed_peers).', fix: 'Add the missing field; for example "peer_policy": {"mode": "closed"} with "allowed_peers": [] when the network calls no other site.' },
  "C1.4": { why: "The site base is plain http on a host that is not loopback. The spec requires HTTPS outside local development.", fix: "Serve the site over HTTPS." },
  "C1.5": { why: "Fetching the manifest redirects to another origin. A redirect to another origin is a new destination that needs its own consent.", fix: "Serve the manifest directly at the site base, without a cross-origin redirect." },
  "C2.1": { why: "The last path segment of the URL is not exactly (case-sensitively) the name of a network in the manifest. A caller must then fail rather than run another network.", fix: "Use the exact name from networks[].name as the last path segment, or add the network to the manifest." },
  "C2.2": { why: "The manifest entry's hocon location does not resolve, does not answer HTTP 200, or the file does not parse as JSON (or the reference runtime's HOCON subset).", fix: "Publish the fully resolved network definition as JSON at the location hocon declares (relative to the site base, or an absolute https URL)." },
  "C2.3": { why: "The network definition is not readable by a browser on another origin (missing or wrong Access-Control-Allow-Origin).", fix: "Serve the definition file with Access-Control-Allow-Origin: *." },
  "C2.4": { why: "One of three things: the manifest entry has no front_man; front_man is not the name of any agent in the definition's tools[]; or, most often, the reference runtime does not read front_man at all: it runs the first entry in tools[] that has instructions (and no class or toolbox). When that is a different agent, the manifest advertises one entry point while callers actually run another.", fix: "Set front_man to the entry agent's exact name and put that agent first in tools[] (or make it the first agent with instructions). Republish and check again." },
  "C2.6": { why: "links.json is published but cannot be read cross-origin, is not valid JSON, has no networks object, or binds a reference to something that is not an http(s) network URL ending in a network name.", fix: 'Use {"version": 1, "networks": {"<network>": {"<reference>": "https://peer.example/<network name>"}}} and serve it with Access-Control-Allow-Origin: *.' },
  "C3.1": { why: "The definition has no non-empty tools[] array, an entry is not an object or has no name, or two agents share a name.", fix: "Describe every agent once in a top-level tools[] array, each with a unique name." },
  "C3.2": { why: "An LLM agent has no instructions (and is not a coded or toolbox tool), or its tools field is not an array.", fix: "Give each LLM agent instructions and a tools array (empty when it calls nothing)." },
  "C3.3": { why: "The reference runtime's validator rejects the network: an agent's tools[] names something that is neither an agent in this network, a full peer network URL, nor an MCP descriptor; or there is no front agent. Callers refuse to run such a network.", fix: "Fix or remove the reference so every tools[] entry resolves." },
  "C3.5": { why: "The published definition still depends on build-time or local features: an include directive, a ${...} substitution, a file:// URL or a local path.", fix: "Resolve includes and substitutions at build time and publish the expanded document." },
  "C3.6": { why: 'A private-context allow rule (allow.to_downstream.sly_data or allow.to_upstream.sly_data) is not an array of field names, or allows "*".', fix: 'List the exact field names that may cross, for example ["customer_id"].' },
  "C3.8": { why: "A credential-looking value (an API key, bearer token, JWT, or a field such as api_key or password with a value) appears in the public manifest or definition.", fix: "Remove it from the published files and rotate the credential; public agent files are public by design." },
  "C4.1": { why: "Asking a caller's reference runtime for a network name the site does not publish did not fail with the exact-name error.", fix: "Usually a manifest problem: check C1 and C2.1. The reference runtime itself refuses unknown names." },
  "C4.2": { why: "A caller's reference runtime could not fetch or validate the network (see the error in the finding; often the same problem as C2.2 or C3.3).", fix: "Fix the earlier failing finding; the network must parse and validate before any model call." },
  "C6.3": { why: `An agent references a peer network or MCP server on another origin that the site's own peer policy does not allow (mode "closed" without that origin in allowed_peers). The site's own runtime would refuse the call.`, fix: "Add the origin to allowed_peers, or remove the reference." },
  "C7.1": { why: "In the scripted turn, the visitor's key or credentials reached something other than the caller's router.", fix: "Use the reference runtime unchanged; never attach the key to requests other than model calls to the selected router." },
  "C8.1": { why: "Private context reached the site's network without an allow rule.", fix: "Private-context fields must not cross network boundaries by default; use the reference runtime's filtering." },
  "C9.1": { why: "The caller's runtime contacted the site before asking for consent, or the consent request did not name the destination origin and the request.", fix: "Ask before every third-party contact, naming the origin and what will be sent." },
  "C9.3": { why: "The site's page does not visibly boot the reference runtime's UI (runtime/index.js boot()) or set its own consent handler. The reference engine allows every contact when no handler is attached.", fix: "Boot the runtime with its UI, or set engine.onConsent before the first message." }
};
function findingGuides(id) {
  const key = id.trim().toUpperCase();
  if (key.includes(".")) {
    const guide = FINDING_GUIDE[key];
    return guide ? [{ id: key, ...guide }] : [];
  }
  return Object.entries(FINDING_GUIDE).filter(([k]) => k.startsWith(`${key}.`)).map(([k, g]) => ({ id: k, ...g }));
}

// ../core/src/compact.ts
var MAX_MESSAGE = 300;
function clip(text, max = MAX_MESSAGE) {
  return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text;
}
function compactReport(report) {
  return {
    ok: true,
    target: report.target.networkUrl ?? report.target.siteBase,
    result: report.summary.worst,
    summary: report.summary,
    checks: report.checks.map((c) => {
      const problems = c.findings.filter((f) => f.status === "fail" || f.status === "warn" || f.status === "untestable");
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        passed: c.findings.filter((f) => f.status === "pass").length,
        problems: problems.slice(0, 8).map((f) => {
          const out = { id: f.id, status: f.status, message: clip(f.message), spec: f.spec };
          if (f.suggestion) out.fix = clip(f.suggestion);
          return out;
        })
      };
    }),
    notAutomated: CATALOG.filter((c) => !c.automated).map((c) => `${c.id} ${c.name}`),
    specCommit: report.conform.spec.specCommit,
    checkedAt: report.finishedAt
  };
}
function compactText(compact) {
  const lines = [`Conform result for ${compact.target}: ${compact.result.toUpperCase()} (${compact.summary.pass} pass, ${compact.summary.fail} fail, ${compact.summary.warn} warn).`];
  for (const check of compact.checks) {
    lines.push(`${check.id} ${check.name}: ${check.status}`);
    for (const p of check.problems) lines.push(`  - ${p.id} ${p.status}: ${p.message}${p.fix ? ` Fix: ${p.fix}` : ""}`);
  }
  lines.push(`Not automated yet: ${compact.notAutomated.join(", ")}. Spec commit ${compact.specCommit.slice(0, 7)}.`);
  return lines.join("\n");
}

// ../reference-runtime/runtime/hocon.js
function parseHocon(text) {
  return new HoconParser(text).parseDocument();
}
var HoconParser = class {
  constructor(text) {
    this.s = text;
    this.i = 0;
    this.n = text.length;
  }
  error(msg) {
    const upto = this.s.slice(0, this.i);
    const line = upto.split("\n").length;
    const col = this.i - upto.lastIndexOf("\n");
    return new Error(`HOCON parse error at line ${line}:${col}: ${msg}`);
  }
  parseDocument() {
    this.skipTrivia();
    let value;
    if (this.peek() === "{") {
      value = this.parseObject();
    } else {
      value = this.parseObjectBody(
        /* braced */
        false
      );
    }
    this.skipTrivia();
    if (this.i < this.n) throw this.error(`unexpected trailing content '${this.peek()}'`);
    return value;
  }
  parseValue() {
    this.skipTrivia();
    const c = this.peek();
    if (c === "{") return this.parseObject();
    if (c === "[") return this.parseArray();
    if (c === '"') return this.parseStringValue();
    return this.parseUnquoted();
  }
  parseObject() {
    this.expect("{");
    const obj = this.parseObjectBody(true);
    return obj;
  }
  parseObjectBody(braced) {
    const obj = {};
    for (; ; ) {
      this.skipTrivia();
      const c = this.peek();
      if (c === null) {
        if (braced) throw this.error("unexpected end of input inside object");
        break;
      }
      if (c === "}") {
        if (!braced) throw this.error("unexpected '}'");
        this.i++;
        break;
      }
      let key;
      if (c === '"') key = this.parseQuotedString();
      else key = this.parseBareKey();
      this.skipTrivia();
      const sep = this.peek();
      let value;
      if (sep === ":" || sep === "=") {
        this.i++;
        value = this.parseValue();
      } else if (sep === "{") {
        value = this.parseObject();
      } else {
        throw this.error(`expected ':' or '=' after key '${key}'`);
      }
      if (Object.prototype.hasOwnProperty.call(obj, key) && isPlainObject(obj[key]) && isPlainObject(value)) {
        obj[key] = deepMerge(obj[key], value);
      } else {
        obj[key] = value;
      }
      this.skipSeparators();
    }
    return obj;
  }
  parseArray() {
    this.expect("[");
    const arr = [];
    for (; ; ) {
      this.skipTrivia();
      const c = this.peek();
      if (c === null) throw this.error("unexpected end of input inside array");
      if (c === "]") {
        this.i++;
        break;
      }
      arr.push(this.parseValue());
      this.skipSeparators();
    }
    return arr;
  }
  parseStringValue() {
    if (this.s.startsWith('"""', this.i)) return this.parseTripleQuoted();
    return this.parseQuotedString();
  }
  parseTripleQuoted() {
    this.i += 3;
    const end = this.s.indexOf('"""', this.i);
    if (end < 0) throw this.error("unterminated triple-quoted string");
    const str = this.s.slice(this.i, end);
    this.i = end + 3;
    return str;
  }
  parseQuotedString() {
    if (this.s.startsWith('"""', this.i)) return this.parseTripleQuoted();
    this.expect('"');
    let out = "";
    for (; ; ) {
      const c = this.s[this.i];
      if (c === void 0) throw this.error("unterminated string");
      if (c === '"') {
        this.i++;
        break;
      }
      if (c === "\\") {
        const e = this.s[this.i + 1];
        const map = { n: "\n", t: "	", r: "\r", '"': '"', "\\": "\\", "/": "/" };
        if (e === "u") {
          out += String.fromCharCode(parseInt(this.s.slice(this.i + 2, this.i + 6), 16));
          this.i += 6;
        } else if (e in map) {
          out += map[e];
          this.i += 2;
        } else {
          out += e;
          this.i += 2;
        }
      } else {
        out += c;
        this.i++;
      }
    }
    return out;
  }
  parseBareKey() {
    const start = this.i;
    while (this.i < this.n && !/[\s:={}]/.test(this.s[this.i])) this.i++;
    if (this.i === start) throw this.error("expected a key");
    return this.s.slice(start, this.i);
  }
  parseUnquoted() {
    const start = this.i;
    while (this.i < this.n) {
      const c = this.s[this.i];
      if (c === "\n" || c === "," || c === "}" || c === "]") break;
      if (c === "/" && (this.s[this.i + 1] === "/" || this.s[this.i + 1] === "*")) break;
      if (c === "#") break;
      this.i++;
    }
    const raw = this.s.slice(start, this.i).trim();
    return coerceScalar(raw);
  }
  // --- trivia handling -------------------------------------------------------
  skipTrivia() {
    for (; ; ) {
      const c = this.s[this.i];
      if (c === void 0) return;
      if (c === " " || c === "	" || c === "\r" || c === "\n") {
        this.i++;
        continue;
      }
      if (c === "#" || c === "/" && this.s[this.i + 1] === "/") {
        const nl = this.s.indexOf("\n", this.i);
        this.i = nl < 0 ? this.n : nl;
        continue;
      }
      if (c === "/" && this.s[this.i + 1] === "*") {
        const end = this.s.indexOf("*/", this.i + 2);
        this.i = end < 0 ? this.n : end + 2;
        continue;
      }
      return;
    }
  }
  // separators between members: commas and/or newlines, plus comments
  skipSeparators() {
    for (; ; ) {
      const c = this.s[this.i];
      if (c === " " || c === "	" || c === "\r" || c === "\n" || c === ",") {
        this.i++;
        continue;
      }
      if (c === "#" || c === "/" && (this.s[this.i + 1] === "/" || this.s[this.i + 1] === "*")) {
        this.skipTrivia();
        continue;
      }
      return;
    }
  }
  peek() {
    return this.i < this.n ? this.s[this.i] : null;
  }
  expect(ch) {
    if (this.s[this.i] !== ch) throw this.error(`expected '${ch}'`);
    this.i++;
  }
};
function coerceScalar(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (raw !== "" && !Number.isNaN(Number(raw)) && /^[-+0-9.eE]+$/.test(raw)) {
    return Number(raw);
  }
  return raw;
}
function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (isPlainObject(out[k]) && isPlainObject(v)) out[k] = deepMerge(out[k], v);
    else out[k] = v;
  }
  return out;
}

// ../reference-runtime/runtime/model.js
var MOCK_MODEL_NAME = "mock-1";
function normalizeModelName(value) {
  let model = String(value ?? "").trim();
  while (model.length >= 2) {
    const first = model[0];
    const last = model[model.length - 1];
    if (!(first === '"' && last === '"' || first === "'" && last === "'")) break;
    model = model.slice(1, -1).trim();
  }
  return model;
}
function isPlaceholderModel(model) {
  const name = normalizeModelName(model);
  return !name || name === MOCK_MODEL_NAME;
}
function fallbackModel(networkModel) {
  return networkModel || MOCK_MODEL_NAME;
}
function effectiveModel(override, agentModel2, networkModel) {
  return override || agentModel2 || fallbackModel(networkModel);
}
function assertModelForRouter(model, mock, routerHost) {
  if (mock || !isPlaceholderModel(model)) return;
  throw new Error(`A model is required for ${routerHost || "the configured provider"}. Open \u2699 AI model settings, enter a model your provider supports in the Model field, then select Save and start.`);
}

// ../reference-runtime/runtime/generated/graph.gen.mjs
var _get = (o, k, d) => o != null && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : d !== void 0 ? d : null;
var _contains = (needle, hay) => typeof hay === "string" ? hay.includes(needle) : Array.isArray(hay) ? hay.includes(needle) : hay && typeof hay === "object" ? Object.prototype.hasOwnProperty.call(hay, needle) : false;
function is_external_agent(ref) {
  return ref.startsWith("http://") || ref.startsWith("https://") || ref.startsWith("/");
}
function is_mcp_ref(ref) {
  if (!ref.startsWith("http://") && !ref.startsWith("https://")) {
    return false;
  }
  let lowered = ref.toLowerCase();
  return _contains("/mcp/", lowered) || lowered.endsWith("/mcp") || _contains("//mcp.", lowered) || _contains(".mcp.", lowered);
}
function find_front_man(config) {
  let tools = _get(config, "tools");
  if (tools === null) {
    return null;
  }
  for (const agent of tools) {
    let has_instructions = _get(agent, "instructions");
    if (has_instructions && !_get(agent, "class") && !_get(agent, "toolbox")) {
      return _get(agent, "name");
    }
  }
  if (tools.length > 0) {
    return _get(tools[0], "name");
  }
  return null;
}
function agent_names(config) {
  let names = [];
  let tools = _get(config, "tools");
  if (tools === null) {
    return names;
  }
  for (const agent of tools) {
    let name = _get(agent, "name");
    if (name !== null) {
      names.push(name);
    }
  }
  return names;
}
function classify_tool(config, ref) {
  if (!(typeof ref === "string") || is_mcp_ref(ref)) {
    return "mcp";
  }
  let names = agent_names(config);
  if (is_external_agent(ref) && !_contains(ref, names)) {
    return "remote";
  }
  let spec = _spec_for(config, ref);
  if (spec === null) {
    return "missing";
  }
  if (_get(spec, "class")) {
    return "coded";
  }
  if (_get(spec, "toolbox")) {
    return "toolbox";
  }
  return "agent";
}
function _spec_for(config, name) {
  let tools = _get(config, "tools");
  if (tools === null) {
    return null;
  }
  for (const agent of tools) {
    if (_get(agent, "name") === name) {
      return agent;
    }
  }
  return null;
}

// ../reference-runtime/runtime/generated/validation.gen.mjs
var _get2 = (o, k, d) => o != null && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : d !== void 0 ? d : null;
function validate_shape(config) {
  let errors = [];
  let tools = _get2(config, "tools");
  if (tools === null) {
    errors.push("Network must have a 'tools' array.");
    return errors;
  }
  if (tools.length === 0) {
    errors.push("Network 'tools' array must not be empty.");
    return errors;
  }
  for (const agent of tools) {
    let name = _get2(agent, "name");
    if (name === null) {
      errors.push("Every agent must have a 'name'.");
    }
  }
  return errors;
}
function validate_missing_nodes(config) {
  let errors = [];
  let tools = _get2(config, "tools");
  if (tools === null) {
    return errors;
  }
  for (const agent of tools) {
    let refs = _get2(agent, "tools");
    if (refs === null) {
      continue;
    }
    let owner = _get2(agent, "name");
    for (const ref of refs) {
      let kind = classify_tool(config, ref);
      if (kind === "missing") {
        errors.push("Agent '" + String(owner) + "' references missing tool '" + String(ref) + "'.");
      }
    }
  }
  return errors;
}
function validate_front_man(config) {
  let errors = [];
  if (find_front_man(config) === null) {
    errors.push("No front-man agent found.");
  }
  return errors;
}
function validate_network(config) {
  let errors = [];
  for (const e of validate_shape(config)) {
    errors.push(e);
  }
  for (const e of validate_front_man(config)) {
    errors.push(e);
  }
  for (const e of validate_missing_nodes(config)) {
    errors.push(e);
  }
  return errors;
}

// ../reference-runtime/runtime/kernel.js
var ChatMessageType = {
  UNKNOWN: 0,
  SYSTEM: 1,
  HUMAN: 2,
  AI: 4,
  AGENT: 100,
  AGENT_FRAMEWORK: 101,
  AGENT_TOOL_RESULT: 103,
  AGENT_PROGRESS: 104
};
function redactSlyData(slyData) {
  if (!slyData) return slyData;
  const out = {};
  for (const k of Object.keys(slyData)) out[k] = "<redacted>";
  return out;
}
function filterSlyData(slyData, allowedKeys) {
  if (!slyData) return {};
  if (!allowedKeys || allowedKeys.length === 0) return {};
  if (allowedKeys.includes("*")) return { ...slyData };
  const out = {};
  for (const k of allowedKeys) if (k in slyData) out[k] = slyData[k];
  return out;
}
function allowedDownstreamSly(agentSpec) {
  return agentSpec?.allow?.to_downstream?.sly_data ?? null;
}
function parseExternalAgent(ref, baseOrigin) {
  if (ref.startsWith("/")) {
    const origin = baseOrigin || (typeof location !== "undefined" ? location.origin : "");
    return { origin, agentName: ref.replace(/^\//, ""), url: origin + ref };
  }
  const u = new URL(ref);
  return { origin: u.origin, agentName: u.pathname.replace(/^\//, ""), url: ref };
}
var DEFAULT_KEYS = [
  "llm_config",
  "verbose",
  "max_steps",
  "max_iterations",
  "max_execution_seconds",
  "max_attempts",
  "error_formatter",
  "error_fragments"
];
function filterConfig(rawConfig) {
  let config = deepClone(rawConfig);
  const commondefs = config.commondefs || {};
  const strs = commondefs.replacement_strings || {};
  const vals = commondefs.replacement_values || {};
  config = walkReplace(config, (v) => {
    if (typeof v === "string") {
      if (Object.prototype.hasOwnProperty.call(vals, v)) return vals[v];
      return v.replace(
        /\{([A-Za-z0-9_]+)\}/g,
        (m, key) => Object.prototype.hasOwnProperty.call(strs, key) ? strs[key] : m
      );
    }
    return v;
  });
  const tools = Array.isArray(config.tools) ? config.tools : [];
  for (const agent of tools) {
    for (const key of DEFAULT_KEYS) {
      if (key in config) {
        if (isPlainObject(config[key]) && isPlainObject(agent[key])) {
          agent[key] = deepMerge(config[key], agent[key]);
        } else if (!(key in agent)) {
          agent[key] = deepClone(config[key]);
        }
      }
    }
    if (typeof agent.name === "string") agent.name = agent.name.trim();
    normalizeConfiguredModel(agent.llm_config);
  }
  normalizeConfiguredModel(config.llm_config);
  return config;
}
function normalizeConfiguredModel(llmConfig) {
  if (isPlainObject(llmConfig) && typeof llmConfig.model_name === "string") {
    llmConfig.model_name = normalizeModelName(llmConfig.model_name);
  }
}
function walkReplace(v, fn) {
  if (Array.isArray(v)) return v.map((x) => walkReplace(x, fn));
  if (isPlainObject(v)) {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = walkReplace(val, fn);
    return out;
  }
  return fn(v);
}
function deepClone(v) {
  return typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}
var AgentNetwork = class {
  constructor(config, name) {
    this.config = filterConfig(config);
    this.name = name;
    this.linkSlots = new Set(Object.keys(this.config.link_slots || {}));
    this.links = { ...this.config.links || {} };
    this.linkLabels = { ...this.config.link_labels || {} };
    this.specMap = /* @__PURE__ */ new Map();
    for (const agent of this.config.tools || []) {
      if (agent && typeof agent.name === "string") this.specMap.set(agent.name, agent);
    }
  }
  getAgentSpec(name) {
    return this.specMap.get(name) || null;
  }
  // Delegates to the cross-compiled kernel (neuro_san/kernel/graph.py).
  findFrontMan() {
    return find_front_man(this.config);
  }
  // Delegates classification to the cross-compiled kernel, then attaches the
  // local agent spec (needed by the runner) for non-remote/non-mcp kinds.
  classifyTool(ref) {
    let kind = classify_tool(this.config, ref);
    if (kind === "missing" && typeof ref === "string" && this.linkSlots.has(ref)) kind = "link";
    const spec = typeof ref === "string" ? this.specMap.get(ref) : void 0;
    return { kind, ref, spec };
  }
  getLink(ref) {
    return this.links[ref] || null;
  }
  setLink(ref, target) {
    if (this.linkSlots.has(ref)) this.links[ref] = target;
  }
  metadata() {
    return this.config.metadata || {};
  }
};
function validateNetwork(network) {
  const errors = validate_network(network.config).filter(
    (message) => ![...network.linkSlots].some((ref) => message.includes(`references missing tool '${ref}'.`))
  );
  const warnings = [];
  const externals = [];
  const mcps = [];
  for (const agent of network.config.tools || []) {
    for (const ref of agent.tools || []) {
      const c = network.classifyTool(ref);
      if (c.kind === "remote") externals.push(ref);
      else if (c.kind === "mcp") mcps.push(typeof ref === "string" ? ref : ref.url);
    }
  }
  return { errors, warnings, externals, mcps };
}

// ../core/src/findings.ts
var SEVERITY = { fail: 4, warn: 3, untestable: 2, pass: 1, info: 0 };
function worstStatus(statuses) {
  let worst = "info";
  for (const status of statuses) {
    if (SEVERITY[status] > SEVERITY[worst]) worst = status;
  }
  return worst === "info" ? "pass" : worst;
}
var Findings = class {
  items = [];
  started = performance.now();
  id;
  name;
  spec;
  mode;
  constructor(id, name, spec, mode) {
    this.id = id;
    this.name = name;
    this.spec = spec;
    this.mode = mode;
  }
  add(id, status, message, spec, extra = {}) {
    const finding = { id, status, message, spec };
    if (extra.evidence) finding.evidence = extra.evidence;
    if (extra.suggestion) finding.suggestion = extra.suggestion;
    this.items.push(finding);
    return finding;
  }
  pass(id, message, spec, evidence2) {
    return this.add(id, "pass", message, spec, evidence2 ? { evidence: evidence2 } : {});
  }
  fail(id, message, spec, suggestion, evidence2) {
    return this.add(id, "fail", message, spec, evidence2 ? { evidence: evidence2, suggestion } : { suggestion });
  }
  warn(id, message, spec, suggestion, evidence2) {
    return this.add(id, "warn", message, spec, evidence2 ? { evidence: evidence2, suggestion } : { suggestion });
  }
  info(id, message, spec, evidence2) {
    return this.add(id, "info", message, spec, evidence2 ? { evidence: evidence2 } : {});
  }
  untestable(id, message, spec, evidence2) {
    return this.add(id, "untestable", message, spec, evidence2 ? { evidence: evidence2 } : {});
  }
  hasFail() {
    return this.items.some((f) => f.status === "fail");
  }
  result() {
    return {
      id: this.id,
      name: this.name,
      spec: this.spec,
      mode: this.mode,
      status: worstStatus(this.items.map((f) => f.status)),
      findings: [...this.items],
      durationMs: Math.round(performance.now() - this.started)
    };
  }
};
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function asString(value) {
  return typeof value === "string" ? value : null;
}
function asArray(value) {
  return Array.isArray(value) ? value : null;
}
function mask(value) {
  if (value.length <= 6) return "***";
  return `${value.slice(0, 4)}\u2026(${value.length} chars)`;
}

// ../core/src/checks/definition.ts
var SECRET_PATTERNS = [
  { name: "OpenAI-style key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "Otari key", pattern: /\botk_[A-Za-z0-9_-]{10,}\b/g },
  { name: "Bearer token", pattern: /\bBearer\s+[A-Za-z0-9._-]{20,}/g },
  { name: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "JWT", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: "Anthropic key", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g }
];
var SECRET_KEYS = /^(api[_-]?key|apikey|secret|password|passwd|auth[_-]?token|access[_-]?token|private[_-]?key)$/i;
var DATA_ONLY_PATTERNS = [
  { name: "HOCON include directive", pattern: /^\s*include\s+["'(]/m, spec: ["\xA72"] },
  { name: "HOCON substitution ${...}", pattern: /\$\{[^}]*\}/, spec: ["\xA72"] },
  { name: "file:// URL", pattern: /\bfile:\/\//i, spec: ["\xA72"] },
  { name: "Unix home or system path", pattern: /(^|["'\s(])\/(Users|home|opt|var|etc|tmp)\/[^\s"']+/, spec: ["\xA72"] },
  { name: "Windows drive path", pattern: /(^|["'\s(])[A-Za-z]:\\[^\s"']+/, spec: ["\xA72"] }
];
function scanSecrets(text) {
  const hits = [];
  for (const { name, pattern } of SECRET_PATTERNS) {
    for (const match of text.matchAll(pattern)) hits.push({ kind: name, sample: mask(match[0]) });
  }
  return hits;
}
function walk(value, path, visit) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, visit));
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  for (const [key, item] of Object.entries(record)) {
    visit(`${path}.${key}`, key, item);
    walk(item, `${path}.${key}`, visit);
  }
}
function checkDefinition(target, manifest, entry, definition, definitionText, manifestText) {
  const f = new Findings("C3", "Definition: Neuro SAN data model, references, data-only, private context, secrets", ["\xA72", "\xA72.1", "\xA72.2", "\xA73.1", "\xA75"], "static");
  const externals = [];
  let network = null;
  let runtimeErrors = [];
  const tools = asArray(definition["tools"]);
  if (!tools || tools.length === 0) {
    f.fail("C3.1", "The definition has no non-empty tools[] array.", ["\xA72", "\xA72.1"], "Describe the network's agents in a top-level tools[] array.", { path: "tools" });
    return { result: f.result(), network, runtimeErrors, externals };
  }
  const agents = [];
  const seen = /* @__PURE__ */ new Map();
  tools.forEach((item, index) => {
    const path = `tools[${index}]`;
    const spec = asRecord(item);
    if (!spec) {
      f.fail("C3.1", `${path} is not an object.`, ["\xA72.1"], "Each tools[] entry describes one agent or tool.", { path });
      return;
    }
    const rawName = asString(spec["name"]);
    const name = rawName?.trim() ?? "";
    if (!name) {
      f.fail("C3.1", `${path} has no name.`, ["\xA72.1"], "Give every agent a unique name.", { path });
      return;
    }
    if (rawName !== name) {
      f.warn("C3.1", `${path}.name has surrounding whitespace ("${rawName}"); the runtime trims it.`, ["\xA72.1"], "Remove the whitespace.", { path, name: rawName });
    }
    seen.set(name, (seen.get(name) ?? 0) + 1);
    agents.push({ name, spec, path });
  });
  for (const [name, count] of seen) {
    if (count > 1) {
      f.fail("C3.1", `Agent name "${name}" is used ${count} times; names must be unique within the network.`, ["\xA72.1"], "Rename the duplicates.", { name, count });
    }
  }
  if (!f.hasFail()) f.pass("C3.1", `${agents.length} agent/tool definition(s) with unique names.`, ["\xA72.1"], { agents: agents.map((a) => a.name) });
  const agentNames = new Set(agents.map((a) => a.name));
  for (const { name, spec, path } of agents) {
    const isCoded = typeof spec["class"] === "string";
    const isToolbox = typeof spec["toolbox"] === "string";
    const instructions = spec["instructions"];
    const fn = asRecord(spec["function"]);
    if (!isCoded && !isToolbox) {
      if (typeof instructions !== "string" || instructions.trim() === "") {
        f.fail(
          "C3.2",
          `Agent "${name}" has no instructions and is neither a coded tool (class) nor a toolbox tool.`,
          ["\xA72.1"],
          "Give LLM agents instructions, or declare the tool's class/toolbox.",
          { path, name }
        );
      }
    }
    if (!fn || asString(fn["description"]) === null) {
      f.warn("C3.2", `"${name}" has no function.description; callers and models cannot tell when to use it.`, ["\xA72.1"], "Add function.description.", { path: `${path}.function.description`, name });
    } else {
      const params = fn["parameters"];
      if (params !== void 0) {
        const schema = asRecord(params);
        if (!schema || schema["type"] !== void 0 && schema["type"] !== "object") {
          f.warn("C3.2", `"${name}".function.parameters is not a JSON Schema object with type "object".`, ["\xA72.1"], 'Use { "type": "object", "properties": { ... }, "required": [...] }.', { path: `${path}.function.parameters`, name });
        }
      }
    }
    if (isCoded) {
      f.info("C3.9", `"${name}" is a coded tool (class "${spec["class"]}"): an optional extension, not part of the minimum portable data profile.`, ["\xA72.2", "\xA73.2"], { path, name, class: spec["class"] });
    }
    if (spec["tools"] !== void 0 && !Array.isArray(spec["tools"])) {
      f.fail("C3.2", `"${name}".tools is not an array.`, ["\xA72.1"], "List the agents, peer-network URLs or MCP descriptors the agent may call.", { path: `${path}.tools`, name });
    }
    const model = asString(asRecord(spec["llm_config"])?.["model_name"]);
    if (model) f.info("C3.10", `"${name}" names model "${model}" (a hint; the caller's router and model policy take precedence).`, ["\xA72.1", "\xA73.2.2"], { name, model });
  }
  if (!f.items.some((x) => x.id === "C3.2" && x.status === "fail")) {
    f.pass("C3.2", "Every LLM agent has instructions; function descriptions and schemas are well formed where present.", ["\xA72.1"]);
  }
  try {
    network = new AgentNetwork(structuredClone(definition), entry.name);
    const validation = validateNetwork(network);
    runtimeErrors = validation.errors;
    for (const message of validation.errors) {
      f.fail("C3.3", `Reference runtime validation: ${message}`, ["\xA72.1", "\xA73.1"], "Fix the reference so every tools[] entry names an agent in this network, a peer network URL, or an MCP descriptor.", { message });
    }
    if (validation.errors.length === 0) {
      f.pass("C3.3", "The reference runtime's validator accepts the network (shape, front agent, references).", ["\xA72.1", "\xA73.1"]);
    }
    const front = network.findFrontMan();
    if (front === null) {
      f.fail("C3.4", "No front agent: no tools[] entry has instructions.", ["\xA72.1"], "Give the entry agent instructions.", {});
    } else {
      f.pass("C3.4", `Front agent "${front}" found.`, ["\xA72.1"], { front });
    }
    for (const { name, spec } of agents) {
      const refs = asArray(spec["tools"]) ?? [];
      for (const ref of refs) {
        const kind = network.classifyTool(ref).kind;
        if (kind === "remote" && typeof ref === "string") {
          externals.push({ agent: name, kind: "remote", ref, origin: originOf(ref) });
        } else if (kind === "mcp") {
          const url2 = typeof ref === "string" ? ref : asString(asRecord(ref)?.["url"]) ?? "";
          externals.push({ agent: name, kind: "mcp", ref: url2, origin: originOf(url2) });
          if (!url2) f.fail("C3.3", `"${name}" lists an MCP descriptor without a url.`, ["\xA72.1"], 'Use { "url": "https://.../mcp", "tools": [...] }.', { name, ref });
        } else if (kind === "link") {
          f.warn(
            "C3.3",
            `"${name}" references link slot "${String(ref)}". An unbound slot makes the caller's chat ask the visitor for a URL (reference-runtime extension).`,
            ["\xA73.3", "\xA77"],
            "Prefer a concrete peer-network URL in tools, or bind the slot in links.json.",
            { name, ref }
          );
        } else if (typeof ref === "string" && ref === name) {
          f.warn("C3.3", `"${name}" lists itself as a tool.`, ["\xA73.1"], "Remove the self-reference; repeated invocation is bounded by the runtime's budgets, not by the graph.", { name });
        }
      }
    }
    if (front !== null) {
      const reached = /* @__PURE__ */ new Set();
      const queue = [front];
      while (queue.length) {
        const current = queue.pop();
        if (reached.has(current)) continue;
        reached.add(current);
        const spec = agents.find((a) => a.name === current)?.spec;
        for (const ref of asArray(spec?.["tools"]) ?? []) {
          if (typeof ref === "string" && agentNames.has(ref) && !reached.has(ref)) queue.push(ref);
        }
      }
      const unreachable = agents.map((a) => a.name).filter((n) => !reached.has(n));
      if (unreachable.length) {
        f.warn("C3.7", `${unreachable.length} agent(s) are not reachable from the front agent: ${unreachable.join(", ")}.`, ["\xA72.1"], "Remove them or reference them from an agent that runs.", { unreachable });
      } else {
        f.pass("C3.7", "Every agent is reachable from the front agent.", ["\xA72.1"]);
      }
    }
  } catch (error) {
    f.fail("C3.3", `The reference runtime cannot load the definition: ${error.message}`, ["\xA72", "\xA73.1"], "Publish a resolved definition that the reference runtime's parser and filter chain accept.", {});
  }
  const dataOnlyHits = [];
  for (const { name, pattern } of DATA_ONLY_PATTERNS) {
    const match = definitionText.match(pattern);
    if (match) dataOnlyHits.push({ name, sample: match[0].trim().slice(0, 80) });
  }
  if (dataOnlyHits.length) {
    for (const hit of dataOnlyHits) {
      f.fail(
        "C3.5",
        `The published definition depends on a build-time or local feature (${hit.name}): "${hit.sample}".`,
        ["\xA72", "\xA72.2"],
        "Resolve includes and substitutions at build time and publish the expanded document; never reference publisher-only paths.",
        hit
      );
    }
  } else {
    f.pass("C3.5", "No include directives, substitutions, file URLs or local paths in the published definition.", ["\xA72", "\xA72.2"]);
  }
  if (network) {
    const strs = asRecord(asRecord(definition["commondefs"])?.["replacement_strings"]) ?? {};
    const unresolved = /* @__PURE__ */ new Set();
    for (const agent of asArray(network.config["tools"]) ?? []) {
      const instructions = asString(asRecord(agent)?.["instructions"]) ?? "";
      for (const match of instructions.matchAll(/\{([A-Za-z0-9_]+)\}/g)) {
        const token = match[1];
        if (!(token in strs)) unresolved.add(token);
      }
    }
    if (unresolved.size) {
      f.warn(
        "C3.5",
        `Instructions contain {token} placeholders with no commondefs.replacement_strings entry: ${[...unresolved].join(", ")}.`,
        ["\xA72"],
        "Define the tokens in commondefs.replacement_strings or remove them; the model otherwise sees the literal braces.",
        { unresolved: [...unresolved] }
      );
    }
  }
  const codedTools = asRecord(manifest["coded_tools"]);
  const codedAgents = agents.filter((a) => typeof a.spec["class"] === "string").map((a) => a.name);
  if (codedAgents.length && !codedTools?.["bundle"]) {
    f.warn(
      "C3.9",
      `Coded tools (${codedAgents.join(", ")}) are declared but the manifest has no coded_tools.bundle; the runtime fails closed and the tool is unavailable.`,
      ["\xA72.1", "\xA72.2", "\xA75"],
      "Publish the bundle and declare coded_tools.bundle (with an integrity digest), or remove the coded tools.",
      { codedAgents }
    );
  }
  const allowRules = [];
  for (const { name, spec } of agents) {
    const allow = asRecord(spec["allow"]);
    if (!allow) continue;
    for (const direction of ["to_downstream", "to_upstream"]) {
      const block = asRecord(allow[direction]);
      if (!block || !("sly_data" in block)) continue;
      const fields = block["sly_data"];
      allowRules.push({ agent: name, direction, fields });
      if (!Array.isArray(fields) || !fields.every((x) => typeof x === "string")) {
        f.fail("C3.6", `"${name}".allow.${direction}.sly_data must be an array of field names.`, ["\xA72.1", "\xA75"], 'Use e.g. "allow": { "to_downstream": { "sly_data": ["customer_id"] } }.', { agent: name, direction, fields });
      } else if (fields.includes("*")) {
        f.warn("C3.6", `"${name}".allow.${direction}.sly_data allows "*": every private-context field would cross the boundary.`, ["\xA72.1", "\xA75"], "Name the fields explicitly.", { agent: name, direction });
      }
    }
  }
  if (allowRules.length === 0) {
    f.pass("C3.6", "No allow rules: private context is deny-by-default across every boundary.", ["\xA72.1", "\xA75"]);
  } else if (!f.items.some((x) => x.id === "C3.6" && x.status === "fail")) {
    f.pass("C3.6", `${allowRules.length} explicit private-context allow rule(s).`, ["\xA72.1", "\xA75"], { rules: allowRules });
  }
  const hits = [...scanSecrets(definitionText), ...scanSecrets(manifestText)];
  const keyedHits = [];
  walk(definition, "definition", (path, key, value) => {
    if (SECRET_KEYS.test(key) && typeof value === "string" && value.trim() !== "") keyedHits.push({ path, key });
  });
  walk(manifest, "manifest", (path, key, value) => {
    if (SECRET_KEYS.test(key) && typeof value === "string" && value.trim() !== "") keyedHits.push({ path, key });
  });
  if (hits.length || keyedHits.length) {
    for (const hit of hits) f.fail("C3.8", `A credential-looking value (${hit.kind}) appears in a public artifact: ${hit.sample}.`, ["\xA72.2", "\xA74", "\xA75"], "Remove it and rotate the credential; published artifacts are public by design.", hit);
    for (const hit of keyedHits) f.fail("C3.8", `A field named "${hit.key}" with a non-empty value appears at ${hit.path}.`, ["\xA72.2", "\xA74"], "Keep credentials out of published files; use private context or a server-side capability.", hit);
  } else {
    f.pass("C3.8", "No credential-looking values in the manifest or definition.", ["\xA72.2", "\xA74", "\xA75"]);
  }
  const hints = {};
  for (const key of ["max_steps", "max_iterations", "max_execution_seconds", "llm_config"]) {
    if (key in definition) hints[key] = definition[key];
  }
  if (Object.keys(hints).length) {
    f.info("C3.11", `Network-level execution hints: ${Object.keys(hints).join(", ")}. Runtime-defined maximums still apply.`, ["\xA72.1", "\xA73.1"], hints);
  }
  for (const ext of externals) {
    if (ext.origin === null) continue;
    const url2 = new URL(ext.origin);
    if (url2.protocol === "http:" && !isLoopbackHost(url2.hostname)) {
      f.fail("C3.3", `"${ext.agent}" references ${ext.kind} ${ext.ref} over plain http on a non-loopback host.`, ["\xA73.2.1"], "Reference peers over https.", { ...ext });
    }
  }
  void target;
  return { result: f.result(), network, runtimeErrors, externals };
}

// ../reference-runtime/runtime/provider-error.js
var ProviderError = class _ProviderError extends Error {
  /**
   * Creates a provider error while retaining the browser's original exception.
   *
   * @param {string} message - The actionable message shown to the user.
   * @param {unknown} cause - The original exception raised by the browser or SDK.
   */
  constructor(message, cause) {
    super(message);
    this.name = "ProviderError";
    this.code = "LLM_NETWORK_ERROR";
    this.cause = cause;
  }
  /**
   * Replaces opaque browser network errors with router-specific guidance.
   *
   * @param {unknown} error - The exception raised while calling the provider.
   * @param {string} routerUrl - The configured OpenAI-compatible base URL.
   * @param {string} pageUrl - The page URL making the browser request.
   * @return {unknown} The original exception or an actionable provider error.
   */
  static friendly(error, routerUrl, pageUrl = globalThis.location?.href || "") {
    if (!_ProviderError.isNetworkFailure(error) || error?.name === "AbortError") return error;
    const router = _ProviderError.parseUrl(routerUrl);
    const page = _ProviderError.parseUrl(pageUrl);
    const routerLabel = router?.host || routerUrl || "the configured AI router";
    if (!router || !_ProviderError.isLocalAddress(router.hostname)) {
      return new _ProviderError(
        `Couldn\u2019t connect to the AI router at ${routerLabel}. Check that the URL is correct, the service is running, and it allows browser requests from ${page?.origin || "this site"} (CORS).`,
        error
      );
    }
    const origin = page?.origin || "this site";
    let message = `Couldn\u2019t connect to the local AI router at ${routerLabel}. `;
    message += `Check that it is running, that the URL is its OpenAI-compatible base URL, and that it allows browser requests from ${origin} (CORS).`;
    if (router.port === "11434") {
      message += ` For Ollama, the base URL is usually http://localhost:11434/v1. Allow ${origin} in OLLAMA_ORIGINS, then restart Ollama.`;
    }
    if (page?.protocol === "https:" && router.protocol === "http:") {
      message += " This HTTPS page may also be blocked from calling a local HTTP service; if so, expose the router through an HTTPS proxy or tunnel.";
    }
    return new _ProviderError(message, error);
  }
  /**
   * Reports whether an exception is an opaque browser network failure.
   *
   * @param {unknown} error - The exception to inspect.
   * @return {boolean} True when the exception represents a failed fetch.
   */
  static isNetworkFailure(error) {
    if (!error) return false;
    const message = String(error.message || error);
    if (error.name === "APIConnectionError" || error.name === "APIConnectionTimeoutError") return true;
    if (error instanceof TypeError && /failed to fetch|fetch failed|networkerror|load failed/i.test(message)) return true;
    return error.cause && error.cause !== error ? _ProviderError.isNetworkFailure(error.cause) : false;
  }
  /**
   * Parses a URL without allowing malformed user input to mask the original error.
   *
   * @param {string} value - The URL to parse.
   * @return {URL|null} The parsed URL, or null when parsing fails.
   */
  static parseUrl(value) {
    try {
      return new URL(value);
    } catch (error) {
      return null;
    }
  }
  /**
   * Reports whether a router host belongs to the visitor's machine or private network.
   *
   * @param {string} hostname - The router hostname.
   * @return {boolean} True for loopback, local, and private-network addresses.
   */
  static isLocalAddress(hostname) {
    const value = String(hostname || "").toLowerCase().replace(/^\[(.*)\]$/, "$1");
    if (value === "localhost" || value === "::1" || value.endsWith(".localhost") || value.endsWith(".local")) return true;
    if (/^127\./.test(value) || /^10\./.test(value) || /^192\.168\./.test(value)) return true;
    const match = /^172\.(\d+)\./.exec(value);
    return !!match && Number(match[1]) >= 16 && Number(match[1]) <= 31;
  }
};

// ../reference-runtime/runtime/llm.js
function hostOf(url2) {
  try {
    return new URL(url2).host;
  } catch {
    return url2 || "?";
  }
}
function isMockResponse(configuredMock, routeKind, model) {
  return !!configuredMock || routeKind === "mock" || /neuro-san-mock/.test(model || "");
}
function browserMockCompletion(messages = [], tools = []) {
  const called = new Set(messages.filter((m) => m?.role === "tool" && m.name).map((m) => m.name));
  const available = (tools || []).map((tool) => tool?.function).filter((fn) => fn?.name);
  const next = available.find((fn) => !called.has(fn.name));
  const lastUser = [...messages].reverse().find((m) => m?.role === "user");
  const request = typeof lastUser?.content === "string" ? lastUser.content : JSON.stringify(lastUser?.content || "");
  if (next) {
    const args = {};
    const schema = next.parameters || {};
    for (const name of schema.required || []) args[name] = request;
    for (const name of ["request", "inquiry", "search_terms", "query", "input"]) {
      if (schema.properties?.[name] || (schema.required || []).includes(name)) args[name] ??= request;
    }
    return {
      content: "",
      toolCalls: [{
        id: `call_${next.name}`,
        type: "function",
        function: { name: next.name, arguments: JSON.stringify(args) }
      }],
      finishReason: "tool_calls",
      usage: null,
      model: "neuro-san-mock-browser"
    };
  }
  const results = messages.filter((m) => m?.role === "tool").map((m) => String(m.content || ""));
  const content = results.length ? `(mock summary) Based on the tools I consulted: ${results.join(" ").slice(0, 1200)}` : "(mock) I have no grounded tool output to summarize for this request.";
  return { content, toolCalls: [], finishReason: "stop", usage: null, model: "neuro-san-mock-browser" };
}
var LlmClient = class {
  constructor({ baseUrl, apiKey, trace, mock }) {
    this.baseUrl = (baseUrl || "").replace(/\/$/, "");
    this.apiKey = apiKey || "";
    this.trace = trace;
    this.mock = !!mock;
  }
  // messages: [{role, content, tool_calls?, tool_call_id?, name?}]
  // tools: [{type:'function', function:{name, description, parameters}}]
  // onContentDelta: (text) => void  — streamed natural-language tokens
  async chat({ model, messages, tools, origin, parentSpan, onContentDelta, signal }) {
    model = normalizeModelName(model);
    if (!this.mock && (!this.apiKey || this.apiKey === "demo")) {
      throw new Error(`An AI provider key is required for ${hostOf(this.baseUrl) || "the configured provider"}. Open \u2699 AI model settings, paste your key, then select Save and start. Your key stays in this browser and is sent only to the configured provider.`);
    }
    assertModelForRouter(model, this.mock, hostOf(this.baseUrl));
    const span = this.trace?.start("model_call", {
      parent: parentSpan,
      origin,
      model,
      mock: this.mock,
      routerHost: hostOf(this.baseUrl),
      endpoint: `${this.baseUrl}/chat/completions`,
      keySource: this.apiKey ? "local BYOK (not shown)" : "none",
      toolNames: (tools || []).map((t) => t.function.name)
    });
    const body = {
      model,
      messages,
      stream: true
    };
    if (tools && tools.length) {
      body.tools = tools;
      body.tool_choice = "auto";
    }
    try {
      if (this.baseUrl === "browser://mock") {
        signal?.throwIfAborted?.();
        const result2 = browserMockCompletion(messages, tools);
        if (result2.content) {
          onContentDelta?.(result2.content);
          this.trace?.update(span, { streamChunk: result2.content });
        }
        this.trace?.end(span, {
          finishReason: result2.finishReason,
          contentChars: result2.content.length,
          toolCalls: result2.toolCalls.map((t) => t.function.name),
          usage: null,
          mock: true,
          verifiedReal: false,
          respModel: result2.model,
          routeKind: "browser-mock"
        });
        return result2;
      }
      const headers = {
        "Content-Type": "application/json",
        ...this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}
      };
      if (hostOf(this.baseUrl) === "api.anthropic.com") {
        headers["anthropic-dangerous-direct-browser-access"] = "true";
      }
      const resp = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`LLM HTTP ${resp.status}: ${txt.slice(0, 300)}`);
      }
      const routeKind = resp.headers.get("X-Nsdeploy-LLM-Route") || "";
      const result = await this._readSse(resp, onContentDelta, span, signal);
      const respMock = isMockResponse(this.mock, routeKind, result.model);
      this.trace?.end(span, {
        finishReason: result.finishReason,
        contentChars: result.content.length,
        toolCalls: result.toolCalls.map((t) => t.function.name),
        usage: result.usage,
        mock: respMock,
        verifiedReal: !respMock && !!result.model,
        respModel: result.model,
        routeKind
      });
      return result;
    } catch (err) {
      const friendlyError = ProviderError.friendly(err, this.baseUrl);
      if (err?.name === "AbortError" && signal?.aborted) {
        this.trace?.end(span, { status: "steered", interrupted: true });
      } else {
        this.trace?.fail(span, friendlyError);
      }
      throw friendlyError;
    }
  }
  async _readSse(resp, onContentDelta, span, signal) {
    const reader = resp.body.getReader();
    const cancel = () => reader.cancel(signal?.reason).catch(() => {
    });
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) {
      await cancel();
      signal.throwIfAborted();
    }
    const dec = new TextDecoder();
    let buf = "";
    let content = "";
    const toolCalls = [];
    let finishReason = null;
    let usage = null;
    let model = null;
    const handleChunk = (json2) => {
      if (json2.model) model = json2.model;
      if (json2.usage) usage = json2.usage;
      const choice = json2.choices?.[0];
      if (!choice) return;
      const delta = choice.delta || {};
      if (delta.content) {
        content += delta.content;
        if (!signal?.aborted) {
          onContentDelta?.(delta.content);
          this.trace?.update(span, { streamChunk: delta.content });
        }
      }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCalls[idx]) toolCalls[idx] = { id: tc.id, type: "function", function: { name: "", arguments: "" } };
          if (tc.id) toolCalls[idx].id = tc.id;
          if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
          if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
        }
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    };
    try {
      for (; ; ) {
        const { value, done } = await reader.read();
        signal?.throwIfAborted();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line || !line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            handleChunk(JSON.parse(payload));
          } catch {
          }
        }
      }
    } finally {
      signal?.removeEventListener("abort", cancel);
    }
    return { content, toolCalls: toolCalls.filter(Boolean), finishReason, usage, model };
  }
};

// ../reference-runtime/runtime/sandbox.js
var ToolSandbox = class {
  constructor({ workerUrl, trace }) {
    this.workerUrl = workerUrl;
    this.trace = trace;
    this.worker = null;
    this.seq = 0;
    this.pending = /* @__PURE__ */ new Map();
    this.bundles = /* @__PURE__ */ new Map();
  }
  // Fetch the coded-tool bundle source on the trusted host side (the worker has no
  // network). If the publishing manifest declares a Subresource-Integrity digest
  // (`coded_tools.integrity`, e.g. "sha384-…"), verify it and fail closed on
  // mismatch — so a tampered or swapped peer bundle never runs.
  async _bundleSource(url2, integrity) {
    if (!url2) throw new Error("coded tool requested but no bundle URL is configured");
    const cacheKey = integrity ? `${url2}#${integrity}` : url2;
    if (this.bundles.has(cacheKey)) return this.bundles.get(cacheKey);
    const resp = await fetch(url2);
    if (!resp.ok) throw new Error(`failed to fetch coded-tool bundle ${url2}: ${resp.status}`);
    const code = await resp.text();
    assertNoExternalImports(code, url2);
    if (integrity) await verifyIntegrity(code, integrity, url2);
    this.bundles.set(cacheKey, code);
    return code;
  }
  _ensure() {
    if (this.worker) return;
    this.worker = new Worker(this.workerUrl, { type: "module" });
    this.worker.onmessage = (e) => {
      const { id, kind, ok, result, slyData, error, progress, message } = e.data;
      const p = this.pending.get(id);
      if (!p) return;
      if (kind === "progress") {
        this.trace?.note("tool_progress", {
          parent: p.span,
          origin: p.origin,
          tool: p.className,
          toolKind: "coded (sandbox)",
          progress,
          message: message || ""
        });
        p.onProgress?.({ progress, message: message || "" });
        return;
      }
      this.pending.delete(id);
      if (ok) p.resolve({ result, slyData });
      else p.reject(new Error(error));
    };
    this.worker.onerror = (e) => {
      for (const p of this.pending.values()) p.reject(new Error(e.message || "sandbox worker error"));
      this.pending.clear();
    };
  }
  // Runs a coded tool. `permittedSly` is the allow-filtered sly_data slice.
  async invoke({ bundleUrl, integrity, className, args, permittedSly, origin, parentSpan, timeoutMs = 15e3, onProgress }) {
    this._ensure();
    const id = ++this.seq;
    const span = this.trace?.start("tool_call", {
      parent: parentSpan,
      origin,
      tool: className,
      toolKind: "coded (sandbox)",
      args
    });
    try {
      const bundleCode = await this._bundleSource(bundleUrl, integrity);
      const result = await new Promise((resolve, reject) => {
        this.pending.set(id, { resolve, reject, span, origin, className, onProgress });
        this.worker.postMessage({ id, bundleCode, cacheKey: bundleUrl, className, args, slyData: permittedSly });
        setTimeout(() => {
          if (this.pending.has(id)) {
            this.pending.delete(id);
            reject(new Error(`coded tool '${className}' timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);
      });
      this.trace?.end(span, { result: result.result });
      return result;
    } catch (err) {
      this.trace?.fail(span, err);
      throw err;
    }
  }
  dispose() {
    this.worker?.terminate();
    this.worker = null;
  }
};
function assertNoExternalImports(code, url2) {
  const dynamicImport = /\bimport\s*[(.]/;
  const staticImport = /(^|[\n;])\s*import\b[\s"'{*]/;
  if (dynamicImport.test(code) || staticImport.test(code)) {
    throw new Error(`coded-tool bundle ${url2} must be self-contained: imports are not allowed in the sandbox.`);
  }
}
async function verifyIntegrity(code, integrity, url2) {
  const m = /^(sha(?:256|384|512))-(.+)$/.exec(String(integrity).trim());
  if (!m) throw new Error(`unsupported integrity '${integrity}' for ${url2}`);
  const algo = { sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" }[m[1]];
  const digest = await crypto.subtle.digest(algo, new TextEncoder().encode(code));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  if (b64 !== m[2]) {
    throw new Error(`integrity check failed for coded-tool bundle ${url2} (expected ${integrity}, got ${m[1]}-${b64})`);
  }
}

// ../reference-runtime/runtime/trace.js
var SEQ = 0;
var TraceBus = class extends EventTarget {
  constructor() {
    super();
    this.events = [];
    this.spans = /* @__PURE__ */ new Map();
  }
  _emit(ev) {
    ev.seq = SEQ++;
    ev.t = performance.now();
    ev.wall = Date.now();
    this.events.push(ev);
    this.dispatchEvent(new CustomEvent("event", { detail: ev }));
  }
  // Open a span; returns an id used to close it.
  start(kind, fields = {}) {
    const id = `s${SEQ}`;
    const span = { id, kind, parent: fields.parent ?? null, status: "running", ...fields };
    span.startedAt = performance.now();
    this.spans.set(id, span);
    this._emit({ phase: "start", ...span });
    return id;
  }
  // Attach incremental info to a running span (e.g. a stream chunk).
  // Emits the full merged span so each event is self-contained for the UI.
  update(id, fields = {}) {
    const span = this.spans.get(id);
    if (!span) return;
    Object.assign(span, fields);
    this._emit({ phase: "update", ...span, ...fields });
  }
  end(id, fields = {}) {
    const span = this.spans.get(id);
    if (!span) return;
    Object.assign(span, fields, { status: fields.status || "ok" });
    span.durationMs = performance.now() - (span.startedAt ?? performance.now());
    this._emit({ phase: "end", ...span });
  }
  fail(id, error) {
    this.end(id, { status: "error", error: String(error && error.message ? error.message : error) });
  }
  // A point-in-time event with no duration (e.g. progress, info).
  note(kind, fields = {}) {
    this._emit({ phase: "note", kind, ...fields });
  }
  export() {
    return {
      version: 1,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      events: this.events
    };
  }
};

// ../reference-runtime/runtime/remote.js
async function fetchManifest(originUrl) {
  const base = originUrl.replace(/\/$/, "");
  const url2 = `${base}/agent-manifest.json`;
  const resp = await fetch(url2);
  if (!resp.ok) throw new Error(`manifest fetch ${resp.status} for ${url2}`);
  const manifest = await resp.json();
  return { manifest, base, url: url2 };
}
async function fetchText(url2) {
  const resp = await fetch(url2);
  if (!resp.ok) throw new Error(`fetch ${resp.status} for ${url2}`);
  return resp.text();
}
function resolveUrl(base, path) {
  if (/^https?:\/\//i.test(path)) return path;
  return base.replace(/\/$/, "") + (path.startsWith("/") ? path : "/" + path);
}
var RemoteRegistry = class {
  constructor({ maxDepth = 5, trace } = {}) {
    this.maxDepth = maxDepth;
    this.trace = trace;
    this.cache = /* @__PURE__ */ new Map();
  }
  cacheKey(origin, agentName) {
    return `${origin}::${agentName}`;
  }
  get(origin, agentName) {
    return this.cache.get(this.cacheKey(origin, agentName));
  }
  set(origin, agentName, session) {
    this.cache.set(this.cacheKey(origin, agentName), session);
  }
  checkCycle(chain, origin, agentName) {
    const key = this.cacheKey(origin, agentName);
    if (chain.includes(key)) {
      const error = new Error(`composition cycle detected: ${[...chain, key].join(" -> ")}`);
      error.code = "COMPOSITION_CYCLE";
      throw error;
    }
    if (chain.length >= this.maxDepth) {
      const error = new Error(`composition depth limit (${this.maxDepth}) exceeded`);
      error.code = "COMPOSITION_DEPTH";
      throw error;
    }
  }
};

// ../reference-runtime/runtime/actions.js
var plain = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var badKeys = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
function cloneData(value) {
  const text = JSON.stringify(value);
  if (!text || text.length > 65536) throw new Error("Action data exceeds 64 KB.");
  return JSON.parse(text, (key, v) => {
    if (badKeys.has(key)) throw new Error("Unsafe object key.");
    return v;
  });
}
var keywords = /* @__PURE__ */ new Set(["type", "properties", "required", "additionalProperties", "items", "enum", "minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems", "format", "title", "description", "default"]);
function checkSchema(schema, depth = 0) {
  if (!plain(schema) || depth > 8) throw new Error("Invalid action schema.");
  for (const key of Object.keys(schema)) if (!keywords.has(key) && !key.startsWith("x-")) throw new Error(`Unsupported action schema keyword: ${key}`);
  if (!["object", "array", "string", "integer", "number", "boolean"].includes(schema.type)) throw new Error("Action schema requires a supported type.");
  if (schema.enum && (!Array.isArray(schema.enum) || !schema.enum.length)) throw new Error("Invalid enum.");
  if (schema.format && !["date", "email"].includes(schema.format)) throw new Error("Supported formats: date, email.");
  for (const key of ["minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems"]) {
    if (schema[key] !== void 0 && !Number.isFinite(schema[key])) throw new Error(`Invalid ${key}.`);
  }
  if (schema.type === "object") {
    if (!plain(schema.properties)) throw new Error("Object schema requires properties.");
    if (schema.additionalProperties !== void 0 && schema.additionalProperties !== false) throw new Error("Action objects must reject extra fields.");
    if (schema.required && (!Array.isArray(schema.required) || schema.required.some((k) => !Object.hasOwn(schema.properties, k)))) throw new Error("Invalid required fields.");
    Object.values(schema.properties).forEach((s) => checkSchema(s, depth + 1));
  }
  if (schema.type === "array") checkSchema(schema.items, depth + 1);
}
function validateData(schema, value, path = "arguments") {
  const fail = () => {
    throw new Error(`Invalid ${path}.`);
  };
  if (schema.type === "object") {
    if (!plain(value)) fail();
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) throw new Error(`Missing ${path}.${key}.`);
    for (const [key, v] of Object.entries(value)) {
      if (badKeys.has(key) || !Object.hasOwn(schema.properties, key)) throw new Error(`Unexpected ${path}.${key}.`);
      validateData(schema.properties[key], v, `${path}.${key}`);
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value) || value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? 1e3)) fail();
    value.forEach((v, i) => validateData(schema.items, v, `${path}[${i}]`));
  } else if (schema.type === "integer" || schema.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value) || schema.type === "integer" && !Number.isInteger(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) fail();
  } else if (schema.type === "string") {
    if (typeof value !== "string" || value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? 65536)) fail();
    if (schema.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail();
    if (schema.format === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) fail();
  } else if (typeof value !== "boolean") fail();
  if (schema.enum && !schema.enum.some((v) => JSON.stringify(v) === JSON.stringify(value))) fail();
}
function actionBindings(component) {
  if (component.kind === "action") return [{ action: component.action, arguments: component.arguments || {} }];
  return component.submit?.actions || [];
}
function proposalRefs(result) {
  return (result?.presentation?.components || []).flatMap((c) => actionBindings(c).map((b) => b.action));
}
function actionContext(catalog) {
  if (!catalog.length) return "\nNo browser actions are registered for this network. Forms can collect information only. Do not say availability/menu data was checked or an operation ran. Report missing integration explicitly. Validated proposals from children may still be relayed.\n";
  return `
CRUSE browser actions (proposals only; these are NOT tool calls):
${JSON.stringify(catalog)}
Return proposals in the ordinary version:1 cruse-ui components. A ready action is {kind:"action",id:"save",action:"EXACT ref",label:"Save",arguments:{...}}. A form may have submit:{actions:[{action:"EXACT ref",arguments:{knownValue:123},inputs:{argumentName:"fieldName"}}]}. inputs maps argument names to top-level form field names, not expressions. Use inputSchema for field types, enum choices and constraints. Preserve exact action references from this catalog or validated child proposals. Consolidate child/local forms and their submit.actions into one form where useful. Keep the mappings when renaming fields. An action proposal never means completion. Submission is executed by the browser after user review; only returned receipts establish results. Do not collect passwords, tokens or payment credentials in CRUSE. Never invent handlers, destinations or successful receipts.`;
}
var ActionRegistry = class {
  constructor() {
    this.entries = /* @__PURE__ */ new Map();
    this.sequence = 0;
    this.discoveryIssues = [];
  }
  register(scope, definition, execute = definition.execute) {
    const { name, description, inputSchema, outputSchema, effect = "write", availability = "local-only", callerOrigins = [], timeoutMs = 18e4 } = cloneData(definition);
    if (!/^[A-Za-z][\w-]{0,79}$/.test(name || "") || !description || typeof execute !== "function") throw new Error("Action requires name, description and execute function.");
    if (!["read", "write", "irreversible"].includes(effect) || !["local-only", "bridge", "top-level"].includes(availability)) throw new Error("Invalid action policy.");
    if (!Array.isArray(callerOrigins) || callerOrigins.some((o) => o !== "*" && new URL(o).origin !== o)) throw new Error("callerOrigins must contain exact origins.");
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 3e5) throw new Error("timeoutMs must be 100\u2013300000.");
    checkSchema(inputSchema);
    if (inputSchema.type !== "object") throw new Error("Action input must be an object.");
    if (outputSchema) checkSchema(outputSchema);
    const ref = `${scope.base.replace(/\/$/, "")}/${encodeURIComponent(scope.network)}#${name}`;
    if (this.entries.has(ref)) throw new Error(`Duplicate action: ${name}`);
    const entry = { ref, name, description, inputSchema, outputSchema, effect, availability, callerOrigins, timeoutMs, ...scope, execute };
    this.entries.set(ref, entry);
    return ref;
  }
  catalog(scope) {
    return [...this.entries.values()].filter((e) => e.base === scope.base && e.network === scope.network).map(({ ref, name, description, inputSchema, effect, availability }) => cloneData({ ref, name, description, inputSchema, effect, availability }));
  }
  validatePresentation(result, allowed) {
    const issues = [];
    if (result.presentation) result.presentation.components = result.presentation.components.filter((c) => {
      try {
        const bindings = actionBindings(c);
        if (!Array.isArray(bindings) || bindings.length > 12) throw new Error("Invalid action list.");
        for (const b of bindings) {
          if (!plain(b) || !allowed.has(b.action) || !this.entries.has(b.action)) throw new Error("Action is not available to this invocation.");
          if (Object.keys(b).some((k) => !["action", "arguments", "inputs"].includes(k))) throw new Error("Unknown action binding field.");
          const args = cloneData(b.arguments || {});
          if (!plain(args) || b.inputs !== void 0 && !plain(b.inputs)) throw new Error("Invalid arguments or input mapping.");
          for (const [key, field] of Object.entries(b.inputs || {})) {
            if (c.kind !== "form" || typeof field !== "string" || !Object.hasOwn(c.schema.properties, field) || Object.hasOwn(args, key)) throw new Error("Invalid field mapping.");
            if (!Object.hasOwn(this.entries.get(b.action).inputSchema.properties, key)) throw new Error("Unknown action argument.");
          }
          const schema = this.entries.get(b.action).inputSchema;
          for (const [key, value] of Object.entries(args)) {
            if (!Object.hasOwn(schema.properties, key)) throw new Error("Unknown action argument.");
            validateData(schema.properties[key], value, key);
          }
          for (const key of schema.required || []) if (!Object.hasOwn(args, key) && !Object.hasOwn(b.inputs || {}, key)) throw new Error(`Missing action argument: ${key}`);
        }
        return true;
      } catch (err) {
        issues.push(err.message);
        return false;
      }
    });
    if (issues.length) result.presentationIssues = [...result.presentationIssues || [], ...issues];
    if (result.presentation?.components.length === 0) {
      result.presentation = null;
      if (!result.text) result.text = "The proposed action could not be validated. Please ask me to try again.";
    }
    return result;
  }
  prepare(component, values = {}) {
    values = cloneData(values);
    return actionBindings(component).map((b) => {
      const entry = this.entries.get(b.action);
      if (!entry) throw new Error("Action is no longer available.");
      const args = cloneData(b.arguments || {});
      for (const [key, field] of Object.entries(b.inputs || {})) if (Object.hasOwn(values, field)) args[key] = values[field];
      validateData(entry.inputSchema, args);
      return { entry, args };
    });
  }
  async execute(plan, confirm, invocationId) {
    if (!await confirm(plan.map(({ entry, args }) => ({ action: entry.name, description: entry.description, origin: new URL(entry.base).origin, effect: entry.effect, arguments: cloneData(args) })))) return null;
    const receipts = [];
    for (let i = 0; i < plan.length; i++) {
      const { entry, args } = plan[i];
      const requestId = `${invocationId}:${i}`;
      const controller = new AbortController();
      let timer;
      try {
        const result = cloneData(await Promise.race([
          Promise.resolve().then(() => entry.execute(cloneData(args), { requestId, signal: controller.signal })),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new Error("Action timed out; outcome unknown. Check the site before retrying."));
            }, entry.timeoutMs);
          })
        ]));
        if (entry.outputSchema) validateData(entry.outputSchema, result, "result");
        receipts.push({ action: entry.ref, requestId, status: "succeeded", result });
      } catch (error) {
        receipts.push({ action: entry.ref, requestId, status: "unknown", error: String(error.message || error) });
        for (const { entry: rest } of plan.slice(i + 1)) receipts.push({ action: rest.ref, status: "not_started" });
        break;
      } finally {
        clearTimeout(timer);
      }
    }
    return receipts;
  }
};

// ../reference-runtime/runtime/cruse.js
var object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var kinds = /* @__PURE__ */ new Set(["form", "choice", "confirm", "info", "report", "table", "chart", "html", "action"]);
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
  }
  try {
    return JSON.parse(text.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, "$1"));
  } catch {
  }
  return null;
}
function isPresentation(value) {
  return object(value) && (Array.isArray(value.components) || object(value.schema?.properties) || kinds.has(value.kind) || object(value.fields));
}
function validComponent(c) {
  if (!object(c) || !kinds.has(c.kind)) return false;
  if (c.submit && (c.kind !== "form" || !Array.isArray(c.submit.actions) || !c.submit.actions.length)) return false;
  if (c.kind === "action") return typeof c.action === "string" && (!c.arguments || object(c.arguments));
  if (c.kind === "form") {
    const p = c.schema?.properties;
    return object(p) && Object.keys(p).length > 0 && Object.keys(p).length <= 40 && Object.values(p).every((f) => object(f) && (!f.type || ["string", "number", "integer", "boolean", "array"].includes(f.type)) && (!f.enum || Array.isArray(f.enum))) && (!c.schema.required || Array.isArray(c.schema.required) && c.schema.required.every((k) => Object.hasOwn(p, k)));
  }
  if (c.kind === "choice") return Array.isArray(c.options) && c.options.length > 0 && c.options.every(object);
  if (c.kind === "confirm") return typeof c.confirmText === "string" && !!c.confirmText.trim();
  if (c.kind === "info") return object(c.fields);
  if (c.kind === "report") return typeof c.markdown === "string";
  if (c.kind === "html") return typeof c.html === "string";
  if (c.kind === "table") return Array.isArray(c.columns) && c.columns.length > 0 && c.columns.every((s) => typeof s === "string") && Array.isArray(c.rows) && c.rows.every((r) => Array.isArray(r) && r.length === c.columns.length && r.every((v) => v === null || ["string", "number", "boolean"].includes(typeof v)));
  if (c.kind === "chart") return ["bar", "line"].includes(c.chartType) && typeof c.summary === "string" && !!c.summary.trim() && Array.isArray(c.labels) && c.labels.length > 0 && c.labels.length <= 120 && c.labels.every((s) => typeof s === "string") && Array.isArray(c.series) && c.series.length > 0 && c.series.length <= 8 && c.series.every((s) => object(s) && typeof s.name === "string" && Array.isArray(s.values) && s.values.length === c.labels.length && s.values.every((v) => typeof v === "number" && Number.isFinite(v)));
  return false;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!object(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
}
function normalizePresentation(value, prefix = "component") {
  const components = [];
  const issues = [];
  const seen = /* @__PURE__ */ new Set();
  const ids = /* @__PURE__ */ new Set();
  const candidates = Array.isArray(value?.components) ? value.components : [value];
  if (value?.version !== void 0 && value.version !== 1) return { presentation: null, issues: ["Unsupported presentation version."] };
  for (const candidate of candidates) {
    if (candidate?.display === false) continue;
    const c = object(candidate) ? { ...candidate, kind: candidate.kind || (candidate.schema ? "form" : "info") } : null;
    if (c?.kind === "confirm" && !c.confirmText) c.confirmText = c.confirmLabel || "Confirm";
    if (!validComponent(c)) {
      issues.push(`Invalid ${c?.kind || "presentation"} component${c?.title ? `: ${c.title}` : ""}.`);
      continue;
    }
    const key = JSON.stringify(canonical(c));
    if (seen.has(key)) continue;
    seen.add(key);
    let id = typeof c.id === "string" && /^[\w.-]{1,100}$/.test(c.id) ? c.id : `${prefix}-${components.length + 1}`;
    while (ids.has(id)) id += "-next";
    ids.add(id);
    components.push({ ...c, id });
  }
  return { presentation: components.length ? { version: 1, components } : null, issues };
}
function consolidateIntakePresentations(presentations) {
  const components = [];
  let intake;
  for (const presentation of presentations) {
    for (const component of presentation.components || []) {
      if (component.kind !== "form" || component.submit) {
        components.push(component);
        continue;
      }
      const properties = component.schema.properties;
      const compatible = intake && Object.entries(properties).every(([key, schema]) => !Object.hasOwn(intake.schema.properties, key) || JSON.stringify(canonical(intake.schema.properties[key])) === JSON.stringify(canonical(schema)));
      if (!compatible || Object.keys({ ...intake?.schema.properties, ...properties }).length > 40) {
        intake = { ...component, schema: {
          ...component.schema,
          properties: { ...properties },
          required: [...component.schema.required || []]
        } };
        components.push(intake);
      } else {
        Object.assign(intake.schema.properties, properties);
        intake.schema.required = [.../* @__PURE__ */ new Set([...intake.schema.required, ...component.schema.required || []])];
      }
    }
  }
  return normalizePresentation({ version: 1, components }).presentation;
}
function parseAgentResponse(raw, source = {}) {
  let text = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
  const proposals = [];
  const issues = [];
  let protocol2;
  const strip = (input) => input.replace(/```(cruse-ui|json)\s*([\s\S]*?)```/gi, (full, label2, body) => {
    const value = parseJson(body.trim());
    if (label2.toLowerCase() === "json" && !isPresentation(value)) return full;
    if (value && isPresentation(value)) proposals.push(value);
    else issues.push("The presentation could not be parsed.");
    return "";
  }).replace(/```cruse-ui[\s\S]*$/i, () => {
    issues.push("The presentation was incomplete.");
    return "";
  }).trim();
  const unwrap = (input) => {
    const plain2 = input.replace(/<\/?tool_(?:response|call)>/gi, "").trim();
    const match = plain2.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
    const doc = parseJson(match ? match[1] : plain2);
    if (isPresentation(doc) || isPresentation(doc?.presentation)) {
      proposals.push(isPresentation(doc?.presentation) ? doc.presentation : doc);
      return typeof doc.text === "string" ? doc.text : "";
    }
    if (object(doc) && doc.Mode !== void 0 && (doc.Name !== void 0 || doc.Inquiry !== void 0)) {
      protocol2 = doc;
      if (object(doc.Response)) return unwrap(JSON.stringify(doc.Response));
      return typeof doc.Response === "string" ? doc.Response : Array.isArray(doc.Requirements) ? doc.Requirements.map((r) => typeof r === "string" ? r : r?.description || r?.title || "").filter(Boolean).join("\n") : "";
    }
    return plain2;
  };
  text = strip(unwrap(text));
  if (!protocol2) text = strip(unwrap(text));
  const merged = [];
  for (const proposal of proposals) {
    const normalized = normalizePresentation(proposal, source.invocation || "component");
    issues.push(...normalized.issues);
    merged.push(...normalized.presentation?.components || []);
  }
  const { presentation } = normalizePresentation({ version: 1, components: merged }, source.invocation || "component");
  if (!text && !presentation && issues.length) text = "I couldn\u2019t display that response. Please ask me to try again.";
  if (protocol2 && typeof protocol2.Response === "string") protocol2 = { ...protocol2, Response: text };
  return {
    cruse: 1,
    text,
    presentation,
    source,
    ...protocol2 ? { protocol: protocol2 } : {},
    ...issues.length ? { presentationIssues: issues, unrenderedProposals: proposals } : {}
  };
}
function agentPresentationContext(ctx, agentName) {
  const spec = ctx.network.getAgentSpec(agentName);
  if (!ctx.network.config?.cruse && !spec?.instructions?.includes("GENERATIVE UI (CRUSE)")) return "";
  return `CRUSE invocation context (takes precedence over earlier presentation preferences):
Audience: ${ctx.isTop && agentName === ctx.frontMan ? "the user" : "your parent agent; your presentation is a proposal, not directly displayed"}.
The render_cruse tool is available to create widgets directly. When collecting multiple missing details, call render_cruse with ONE consolidated form, then finish with a brief introduction. Widgets submitted through this tool are preserved even if your final answer is plain text. A final answer or tool receipt must not claim that collecting form details places an order. For information-only requests, choose a useful component when it helps; do not ask for checkout details prematurely.
Tool results may contain {cruse:1,text,presentation,protocol,source}. Read all relevant child answers AND presentation components. During your normal final synthesis, consolidate them into your own presentation. Merge redundant questions by meaning, use facts already supplied, preserve distinct requirements and disagreements, and defer details needed only for later steps. Do not copy a stack of child forms. You may replace proposed forms with prose, a table, report or chart, or omit a presentation when chat suffices. Prefer one focused input step when input is needed, with complementary visual components when useful. Plain chat can answer or amend a form; never require form submission just to continue. If presentationIssues or unrenderedProposals are present, recover useful facts and requirements into your answer or a valid presentation. Return human-facing text and optionally one consolidated cruse-ui block; child protocol metadata is context, not another UI. Never invent data to fill a chart or report.`;
}
function interactionMessage(text, interaction) {
  return interaction ? `${text}

CRUSE interaction: ${JSON.stringify(interaction)}` : text;
}

// ../reference-runtime/runtime/turn-control.js
var TurnControl = class {
  constructor() {
    this.pending = [];
    this.accepted = [];
    this.watchers = /* @__PURE__ */ new Set();
    this.closed = false;
    this.trace = null;
    this.parentSpan = null;
    this.tracedCount = 0;
  }
  attach(trace, parentSpan) {
    this.trace = trace;
    this.parentSpan = parentSpan;
    for (const input of this.accepted.slice(this.tracedCount)) this._traceReceived(input);
    this.tracedCount = this.accepted.length;
  }
  _traceReceived(input) {
    this.trace?.note("steering", {
      parent: this.parentSpan,
      state: "received",
      input: input.text
    });
  }
  steer(value) {
    const text = String(value || "").trim();
    if (!text || this.closed) return false;
    const input = { text, receivedAt: Date.now() };
    this.pending.push(input);
    this.accepted.push(input);
    if (this.trace) {
      this._traceReceived(input);
      this.tracedCount = this.accepted.length;
    }
    for (const resolve of this.watchers) resolve();
    this.watchers.clear();
    return true;
  }
  drain() {
    if (!this.pending.length) return [];
    return this.pending.splice(0);
  }
  watch() {
    if (this.pending.length || this.closed) {
      return { promise: Promise.resolve(), cancel() {
      } };
    }
    let resolve;
    const promise = new Promise((done) => {
      resolve = done;
    });
    this.watchers.add(resolve);
    return {
      promise,
      cancel: () => this.watchers.delete(resolve)
    };
  }
  applied(inputs) {
    if (!inputs?.length) return;
    this.trace?.note("steering", {
      parent: this.parentSpan,
      state: "applied",
      count: inputs.length,
      input: inputs.map((item) => item.text).join("\n")
    });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const resolve of this.watchers) resolve();
    this.watchers.clear();
  }
};
async function runInterruptibleModelCall(turnControl, invoke) {
  if (!turnControl) return { interrupted: false, value: await invoke(void 0) };
  const abort = new AbortController();
  const watch = turnControl.watch();
  const operation = Promise.resolve().then(() => invoke(abort.signal));
  const settled = operation.then(
    (value) => ({ kind: "result", value }),
    (error) => ({ kind: "error", error })
  );
  try {
    const winner = await Promise.race([
      settled,
      watch.promise.then(() => ({ kind: "steering" }))
    ]);
    if (winner.kind === "steering" && turnControl.pending.length) {
      abort.abort(new DOMException("Model call superseded by user steering", "AbortError"));
      settled.then(() => {
      });
      return { interrupted: true };
    }
    if (winner.kind === "steering") {
      const completed = await settled;
      if (completed.kind === "error") throw completed.error;
      return { interrupted: false, value: completed.value };
    }
    if (winner.kind === "error") throw winner.error;
    return { interrupted: false, value: winner.value };
  } finally {
    watch.cancel();
  }
}
function applyPendingSteering(turnControl, append) {
  const inputs = turnControl?.drain() || [];
  for (const input of inputs) append(input.text);
  turnControl?.applied(inputs);
  return inputs.length;
}

// ../reference-runtime/runtime/runner.js
var invocationSequence = 0;
function argsToText(args) {
  if (args == null) return "";
  if (typeof args === "string") return args;
  if (args.request) return String(args.request);
  if (args.input) return String(args.input);
  if (args.input_string) return String(args.input_string);
  return JSON.stringify(args);
}
function safeName(s) {
  return s.replace(/[^A-Za-z0-9_]/g, "_").replace(/^_+/, "").slice(0, 60) || "tool";
}
function hostOfUrl(url2) {
  try {
    return new URL(url2).host;
  } catch {
    return url2;
  }
}
function requiresThirdPartyApproval(ref, baseOrigin) {
  const raw = typeof ref === "string" ? ref : ref?.url;
  try {
    const base = new URL(baseOrigin);
    const target = new URL(raw, base);
    const externalMcpProxy = /^\/ext-mcp(?:\/|$)/i.test(target.pathname);
    return externalMcpProxy || target.origin !== base.origin;
  } catch {
    return true;
  }
}
function remoteIsInChain(ref, baseOrigin, chain = []) {
  try {
    const parsed = parseExternalAgent(ref, baseOrigin);
    return chain.includes(`${parsed.origin}::${parsed.agentName}`);
  } catch {
    return false;
  }
}
function consumeRemoteBudget(composition2, targetKey, now = Date.now()) {
  if (!composition2) return null;
  if (now >= composition2.deadline) return "the composition deadline was reached";
  if (composition2.remoteCalls >= composition2.maxRemoteCalls) {
    return `the per-query limit of ${composition2.maxRemoteCalls} third-party calls was reached`;
  }
  const prior = composition2.peerCalls.get(targetKey) || 0;
  if (prior >= composition2.maxCallsPerPeer) return "that network was already consulted for this query";
  composition2.remoteCalls += 1;
  composition2.peerCalls.set(targetKey, prior + 1);
  return null;
}
function consumeAgentBudget(composition2, now = Date.now()) {
  if (!composition2) return null;
  if (now >= composition2.deadline) return "the 90-second query deadline was reached";
  if (composition2.agentCalls >= composition2.maxAgentCalls) {
    return `the per-query limit of ${composition2.maxAgentCalls} agent invocations was reached`;
  }
  composition2.agentCalls += 1;
  return null;
}
function schemaFor(name, fn) {
  return {
    type: "function",
    function: {
      name,
      description: fn && fn.description || name,
      parameters: fn && fn.parameters || {
        type: "object",
        properties: { request: { type: "string", description: "The request to handle." } },
        required: ["request"]
      }
    }
  };
}
async function buildToolTable(ctx, spec, chain, parentSpan) {
  const { network } = ctx;
  const toolByName = /* @__PURE__ */ new Map();
  const toolSchemas = [];
  for (const ref of spec.tools || []) {
    const c = network.classifyTool(ref);
    if (c.kind === "missing") continue;
    if (c.kind === "mcp") {
      const host = hostOfUrl(typeof ref === "string" ? ref : ref.url);
      const requiresApproval = requiresThirdPartyApproval(ref, ctx.baseOrigin);
      if (requiresApproval) {
        const decision = await ctx.requestConsent?.({
          kind: "mcp",
          phase: "discover",
          peerLabel: "Destination service",
          peerOrigin: host,
          requestText: "(discover available tools)",
          est: { totalTokens: 0, costText: ctx.mock ? "$0.00 (mock)" : "metadata only" }
        });
        if (decision === "decline") {
          ctx.trace.note("consent", { parent: parentSpan, origin: ctx.displayOrigin, peerOrigin: host, phase: "discover", decision: "declined" });
          continue;
        }
      }
      const client = await ctx.resolveMcp(ref, parentSpan);
      for (const t of await client.listTools(parentSpan)) {
        const name = safeName(`mcp_${t.name}`);
        toolByName.set(name, { kind: "mcp", ref, client, mcpName: t.name, requiresApproval });
        toolSchemas.push(schemaFor(name, { description: t.description, parameters: t.inputSchema }));
      }
    } else if (c.kind === "remote") {
      if (remoteIsInChain(ref, ctx.baseOrigin, chain)) {
        ctx.trace.note("composition_skip", {
          parent: parentSpan,
          origin: ctx.displayOrigin,
          target: ref,
          reason: "already visited in this request"
        });
        continue;
      }
      const name = safeName(parseExternalAgent(ref, ctx.baseOrigin).agentName);
      const host = hostOfUrl(ref);
      const label2 = ctx.network.linkLabels?.[ref] || name;
      toolByName.set(name, { kind: "remote", url: ref, label: label2 });
      toolSchemas.push(schemaFor(name, { description: `Hand off to the ${label2} network. Provide a natural-language request.` }));
    } else if (c.kind === "link") {
      const name = safeName(ref);
      toolByName.set(name, { kind: "link", reference: ref });
      toolSchemas.push(schemaFor(name, {
        description: `Hand off to the linked agent network "${ref}". If it is not linked yet, ask the developer for its nsDeploy site URL.`
      }));
    } else {
      const name = safeName(c.ref);
      toolByName.set(name, c);
      toolSchemas.push(schemaFor(name, c.spec.function));
    }
  }
  const callable = new Set(ctx.isTop ? ctx.manifest?.actions?.agentTools || [] : []);
  for (const action of ctx.actions?.catalog({ base: ctx.baseOrigin, network: network.name }) || []) {
    if (!callable.has(action.name) || action.availability !== "local-only" || action.effect === "irreversible" && typeof ctx.confirmWebsiteActions !== "function") continue;
    const name = `website_${action.name}`;
    if (toolByName.has(name)) throw new Error(`Duplicate website tool: ${name}`);
    toolByName.set(name, { kind: "website", ref: action.ref, parallelSafe: false });
    toolSchemas.push(schemaFor(name, { description: action.description, parameters: action.inputSchema }));
  }
  if (network.config?.cruse) {
    toolByName.set("render_cruse", { kind: "presentation", parallelSafe: false });
    toolSchemas.push(schemaFor("render_cruse", {
      description: "Create the CRUSE widgets for this response. Use this to show a consolidated form when several answers are needed, or a table, choice, report or other supported component. Widgets are preserved even if your final answer is plain text. This collects input or presents information; it does not execute website operations.",
      parameters: {
        type: "object",
        required: ["presentation"],
        additionalProperties: false,
        properties: {
          presentation: {
            type: "object",
            required: ["version", "components"],
            additionalProperties: false,
            properties: {
              version: { type: "integer", enum: [1] },
              components: { type: "array", minItems: 1, items: { type: "object" } }
            }
          }
        }
      }
    }));
  }
  return { toolByName, toolSchemas };
}
function mergeToolSlyData(ctx, spec, slyData) {
  if (!slyData || typeof slyData !== "object") return;
  const declared = spec.function?.sly_data_output_schema?.properties;
  const allowWrite = declared ? new Set(Object.keys(declared)) : null;
  for (const [k, v] of Object.entries(slyData)) {
    if (allowWrite) {
      if (allowWrite.has(k)) ctx.slyData[k] = v;
    } else if (!(k in ctx.slyData)) {
      ctx.slyData[k] = v;
    }
  }
}
function entryAllowsParallel(entry) {
  if (!entry) return true;
  if (entry.parallelSafe === false || entry.spec?.parallel_safe === false || entry.spec?.execution?.parallel_safe === false) return false;
  if (entry.kind === "toolbox") {
    return String(entry.spec?.args?.method || "GET").toUpperCase() === "GET";
  }
  return true;
}
function toolKind(entry) {
  if (!entry) return "unknown";
  return {
    agent: "agent",
    coded: "coded (sandbox)",
    toolbox: "REST (backend)",
    mcp: "MCP",
    link: "linked network",
    remote: "remote network"
  }[entry.kind] || entry.kind;
}
function changed(a, b) {
  if (Object.is(a, b)) return false;
  try {
    return JSON.stringify(a) !== JSON.stringify(b);
  } catch {
    return true;
  }
}
async function executeToolCalls(ctx, calls, parentSpan, chain, { maxConcurrency = 4 } = {}) {
  if (!calls.length) return [];
  if (!ctx.slyData) ctx.slyData = {};
  const initialSly = { ...ctx.slyData || {} };
  const concurrency = calls.every((call) => entryAllowsParallel(call.entry)) ? Math.max(1, Math.min(maxConcurrency, calls.length)) : 1;
  const results = new Array(calls.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const index = next++;
      if (index >= calls.length) return;
      const call = calls[index];
      const callCtx = { ...ctx, slyData: { ...initialSly } };
      const span = ctx.trace.start("tool", {
        parent: parentSpan,
        origin: ctx.displayOrigin,
        tool: call.name,
        callId: call.id,
        toolKind: toolKind(call.entry),
        args: call.args
      });
      try {
        const raw = call.entry ? await dispatchToolCall(callCtx, call.entry, call.args, span, chain) : `Error: unknown tool '${call.name}'`;
        const encoded = typeof raw === "string" ? raw : JSON.stringify(raw);
        const content = encoded ?? String(raw ?? "");
        ctx.trace.end(span, { resultPreview: content.slice(0, 240) });
        results[index] = { ...call, content, slyData: callCtx.slyData };
      } catch (error) {
        const message = String(error?.message || error);
        const content = `Error from tool '${call.name}': ${message}`;
        ctx.trace.end(span, { status: "error", error: message, resultPreview: content.slice(0, 240) });
        results[index] = { ...call, content, error, slyData: callCtx.slyData };
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  for (const result of results) {
    for (const [key, value] of Object.entries(result.slyData || {})) {
      if (changed(initialSly[key], value)) ctx.slyData[key] = value;
    }
  }
  return results;
}
async function dispatchToolCall(ctx, entry, args, parentSpan, chain) {
  const { trace } = ctx;
  if (entry.kind === "presentation") {
    if (!ctx.presentationOutput) throw new Error("No presentation output is available for this invocation.");
    const normalized = normalizePresentation(args.presentation, ctx.invocation);
    if (!normalized.presentation || normalized.issues.length) {
      throw new Error(normalized.issues.join(" ") || "Provide at least one valid CRUSE component.");
    }
    const result = { presentation: normalized.presentation };
    ctx.actions?.validatePresentation(result, ctx.allowedActionRefs || /* @__PURE__ */ new Set());
    if (!result.presentation || result.presentationIssues?.length) {
      throw new Error(result.presentationIssues?.join(" ") || "Invalid CRUSE action binding.");
    }
    ctx.presentationOutput.presentation = result.presentation;
    return {
      status: "accepted",
      componentIds: result.presentation.components.map((c) => c.id),
      message: "Widgets are attached to your response. Finish with a brief introduction; do not repeat the form questions in prose. This has not placed an order."
    };
  }
  if (entry.kind === "website") {
    const registered = ctx.actions.entries.get(entry.ref);
    if (!ctx.isTop || !registered || !ctx.manifest?.actions?.agentTools?.includes(registered.name) || registered.base !== ctx.baseOrigin || registered.network !== ctx.network.name || registered.availability !== "local-only" || registered.effect === "irreversible" && typeof ctx.confirmWebsiteActions !== "function") {
      throw new Error("Website action is not callable by this agent.");
    }
    const plan = ctx.actions.prepare({ kind: "action", action: entry.ref, arguments: args });
    const confirm = registered.effect === "irreversible" ? ctx.confirmWebsiteActions : async () => true;
    const receipts = await ctx.actions.execute(plan, confirm, crypto.randomUUID());
    return receipts?.[0] || { action: entry.ref, status: "cancelled", message: "Customer declined; nothing was submitted." };
  }
  if (entry.kind === "agent") {
    const result = await runAgent(ctx, entry.ref, argsToText(args), parentSpan, chain);
    if (result.presentation) ctx.presentationOutput?.children?.push(result.presentation);
    return result;
  }
  if (entry.kind === "coded") {
    const permitted = filterSlyData(ctx.slyData, allowedDownstreamSly(entry.spec) || []);
    const { result, slyData } = await ctx.sandbox.invoke({
      bundleUrl: ctx.codedToolBundleUrl,
      integrity: ctx.codedToolIntegrity,
      className: entry.spec.class,
      args,
      permittedSly: permitted,
      origin: ctx.displayOrigin,
      parentSpan
    });
    mergeToolSlyData(ctx, entry.spec, slyData);
    return typeof result === "string" ? result : JSON.stringify(result);
  }
  if (entry.kind === "toolbox") {
    return dispatchRest(ctx, entry, args, parentSpan);
  }
  if (entry.kind === "mcp") {
    if (entry.requiresApproval ?? requiresThirdPartyApproval(entry.ref || entry.client.url, ctx.baseOrigin)) {
      const host = hostOfUrl(entry.client.url);
      const requestText = argsToText(args);
      const decision = await ctx.requestConsent?.({
        kind: "mcp",
        phase: "call",
        peerLabel: "Destination service",
        peerOrigin: host,
        requestText,
        est: { totalTokens: Math.round((requestText.length + 80) / 4), costText: ctx.mock ? "$0.00 (mock)" : null }
      });
      if (decision === "decline") {
        ctx.trace.note("consent", { parent: parentSpan, origin: ctx.displayOrigin, peerOrigin: host, phase: "call", decision: "declined" });
        return `The user declined to send this request to ${host}. Continue without it.`;
      }
    }
    return entry.client.callTool(entry.mcpName, args, parentSpan);
  }
  if (entry.kind === "link") {
    const target = await ctx.resolveLink(entry.reference, parentSpan);
    if (!target) return `The user did not link '${entry.reference}'. Continue without it.`;
    return dispatchToolCall(ctx, { kind: "remote", url: target, label: entry.reference }, args, parentSpan, chain);
  }
  if (entry.kind === "remote") {
    const requestText = argsToText(args);
    const host = hostOfUrl(entry.url);
    if (requiresThirdPartyApproval(entry.url, ctx.baseOrigin)) {
      const est = {
        totalTokens: Math.round((requestText.length + 300) / 4) * 2,
        costText: ctx.mock ? "$0.00 (mock)" : null
      };
      const decision = await ctx.requestConsent?.({
        kind: "network",
        peerLabel: entry.label || host,
        peerOrigin: host,
        requestText,
        est
      });
      if (decision === "decline") {
        ctx.trace.note("consent", { parent: parentSpan, origin: ctx.displayOrigin, peerOrigin: host, decision: "declined" });
        return `The user declined to contact ${host}. Proceed without it and note that to the user.`;
      }
    }
    const parsed = parseExternalAgent(entry.url, ctx.baseOrigin);
    const budgetReason = consumeRemoteBudget(ctx.composition, `${parsed.origin}::${parsed.agentName}`);
    if (budgetReason) {
      ctx.trace.note("composition_limit", {
        parent: parentSpan,
        origin: ctx.displayOrigin,
        target: entry.url,
        reason: budgetReason,
        remoteCalls: ctx.composition?.remoteCalls
      });
      return `Skipped ${entry.label || host}: ${budgetReason}. Continue with available results and do not retry it.`;
    }
    let session;
    try {
      session = await ctx.resolveRemote(entry.url, chain, parentSpan);
    } catch (err) {
      if (err?.code === "COMPOSITION_CYCLE" || err?.code === "COMPOSITION_DEPTH") {
        return `Skipped ${entry.label || host}: that network is already in this request's call chain. Continue with available results and do not retry it.`;
      }
      throw err;
    }
    const downstreamSly = filterSlyData(ctx.slyData, allowedDownstreamSly(ctx.network.getAgentSpec(ctx.frontMan)) || []);
    const request = {
      user_message: { type: ChatMessageType.HUMAN, text: requestText },
      sly_data: downstreamSly,
      chat_filter: { chat_filter_type: "MINIMAL" }
    };
    const result = await session.invoke(request, { parentSpan, chain, composition: ctx.composition });
    for (const ref of proposalRefs(result)) ctx.allowedActionRefs?.add(ref);
    return result;
  }
  return `Error: unsupported tool kind '${entry.kind}'`;
}
function agentModel(ctx, spec) {
  return effectiveModel(ctx.modelOverride, spec?.llm_config?.model_name, ctx.network.config?.llm_config?.model_name);
}
async function runAgent(ctx, agentName, userText, parentSpan, chain) {
  const source = { origin: ctx.displayOrigin, network: ctx.network.name, agent: agentName, invocation: `cruse-${++invocationSequence}` };
  const budgetReason = consumeAgentBudget(ctx.composition);
  if (budgetReason) {
    ctx.trace.note("composition_limit", {
      parent: parentSpan,
      origin: ctx.displayOrigin,
      agent: agentName,
      reason: budgetReason,
      agentCalls: ctx.composition?.agentCalls
    });
    return parseAgentResponse(`Skipped ${agentName}: ${budgetReason}. Continue with available results and do not retry it.`, source);
  }
  if (ctx.apiKey && ctx.apiKey !== "demo") {
    assertModelForRouter(agentModel(ctx, ctx.network.getAgentSpec(agentName)), ctx.mock, hostOfUrl(ctx.routerBaseUrl));
  }
  const catalog = ctx.actions?.catalog({ base: ctx.baseOrigin, network: ctx.network.name }) || [];
  const presentationContext = agentPresentationContext(ctx, agentName);
  const nativeTools = new Set(ctx.manifest?.actions?.agentTools || []);
  const proposalCatalog = catalog.filter((action) => !nativeTools.has(action.name) || action.availability !== "local-only" || action.effect === "irreversible" && typeof ctx.confirmWebsiteActions !== "function");
  const websiteContext = proposalCatalog.length || !catalog.length ? actionContext(proposalCatalog) : "\nWebsite operations are connected as website_* tools. CRUSE forms remain available to collect missing details in one step. Return an ordinary form without submit.actions; its submitted values arrive as CRUSE interaction data on the next turn. Then call the appropriate website tool using those values. A form submission only supplies answers; checkout still requires the tool's browser confirmation. Do not report a missing integration.\n";
  const context = presentationContext + (presentationContext && ctx.actions ? websiteContext : "");
  const network = Object.create(ctx.network);
  network.getAgentSpec = (name) => {
    const spec = ctx.network.getAgentSpec(name);
    return name === agentName && spec && context ? { ...spec, instructions: `${spec.instructions || ""}

${context}` } : spec;
  };
  const local = {
    ...ctx,
    network,
    invocation: source.invocation,
    presentationOutput: { presentation: null, children: [] },
    allowedActionRefs: new Set(catalog.map((a) => a.ref))
  };
  const raw = ctx.externalRunner ? await ctx.externalRunner(local, agentName, userText, parentSpan, chain, {
    buildToolTable,
    dispatchToolCall,
    executeToolCalls,
    schemaFor,
    argsToText,
    applyPendingSteering,
    runInterruptibleModelCall
  }) : await runAgentManual(local, agentName, userText, parentSpan, chain);
  const result = parseAgentResponse(raw, source);
  if (!result.presentation) {
    result.presentation = local.presentationOutput.presentation || consolidateIntakePresentations(local.presentationOutput.children);
  }
  ctx.actions?.validatePresentation(result, local.allowedActionRefs);
  for (const ref of proposalRefs(result)) ctx.allowedActionRefs?.add(ref);
  ctx.trace.note("presentation_proposal", { parent: parentSpan, ...source, presentation: result.presentation, issues: result.presentationIssues });
  ctx.trace.note("agent_result", { parent: parentSpan, ...source, text: result.text, presentation: result.presentation });
  return result;
}
async function runAgentManual(ctx, agentName, userText, parentSpan, chain) {
  const { network, llm, trace } = ctx;
  const spec = network.getAgentSpec(agentName);
  if (!spec) throw new Error(`agent '${agentName}' not found`);
  const origin = ctx.displayOrigin;
  const isTopFrontMan = ctx.isTop && agentName === ctx.frontMan;
  const agentSpan = trace.start("agent", {
    parent: parentSpan,
    origin,
    agent: agentName,
    network: network.name,
    displayAs: spec.class ? "coded_tool" : "llm_agent",
    runner: "manual",
    invocation: ctx.invocation,
    isTopFrontMan
  });
  try {
    const { toolByName, toolSchemas } = await buildToolTable(ctx, spec, chain, agentSpan);
    const sysParts = [];
    if (spec.instructions) sysParts.push(spec.instructions.trim());
    if (spec.command) sysParts.push(spec.command.trim());
    const messages = [{ role: "system", content: sysParts.join("\n\n") || "You are a helpful agent." }];
    if (isTopFrontMan && ctx.history?.length) messages.push(...ctx.history);
    messages.push({ role: "user", content: userText });
    const model = agentModel(ctx, spec);
    const maxSteps = Math.min(spec.max_steps || network.config.max_steps || 12, ctx.maxSteps || Infinity);
    let finalText = "";
    for (let step = 0; step < maxSteps; step++) {
      if (isTopFrontMan) {
        applyPendingSteering(ctx.turnControl, (text) => messages.push({ role: "user", content: text }));
      }
      const onContentDelta = isTopFrontMan ? (t) => ctx.onAnswerDelta?.(t) : void 0;
      const attempt = await runInterruptibleModelCall(isTopFrontMan ? ctx.turnControl : null, (signal) => llm.chat({ model, messages, tools: toolSchemas, origin, parentSpan: agentSpan, onContentDelta, signal }));
      if (attempt.interrupted) {
        step -= 1;
        continue;
      }
      const res = attempt.value;
      if (isTopFrontMan && ctx.turnControl?.pending.length) {
        step -= 1;
        continue;
      }
      if (res.toolCalls.length === 0) {
        finalText = res.content;
        break;
      }
      messages.push({ role: "assistant", content: res.content || null, tool_calls: res.toolCalls });
      const calls = res.toolCalls.map((tc) => {
        let args = {};
        try {
          args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
        } catch {
          args = { request: tc.function.arguments };
        }
        return { id: tc.id, name: tc.function.name, args, entry: toolByName.get(tc.function.name) };
      });
      const toolResults = await executeToolCalls(ctx, calls, agentSpan, chain);
      for (const result of toolResults) {
        messages.push({ role: "tool", tool_call_id: result.id, name: result.name, content: result.content });
        trace.note("tool_result", { parent: agentSpan, origin, tool: result.name, preview: result.content.slice(0, 200), type: ChatMessageType.AGENT_TOOL_RESULT });
      }
    }
    trace.end(agentSpan, { answerChars: finalText.length });
    return finalText;
  } catch (err) {
    trace.fail(agentSpan, err);
    throw err;
  }
}
async function dispatchRest(ctx, entry, args, parentSpan) {
  const { trace } = ctx;
  const url2 = entry.spec.args?.url;
  if (!url2) return `Error: REST tool '${entry.ref}' has no configured URL.`;
  const method = (entry.spec.args?.method || "GET").toUpperCase();
  const headers = {};
  const token = ctx.slyData?.backend_token;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const span = trace.start("rest_call", {
    parent: parentSpan,
    origin: ctx.displayOrigin,
    tool: entry.ref,
    toolKind: "REST (backend)",
    method,
    url: url2,
    headers: token ? { Authorization: "Bearer <redacted>" } : {}
  });
  try {
    const resp = await fetch(url2, { method, headers });
    const text = await resp.text();
    if (!resp.ok) throw new Error(`REST ${resp.status}`);
    trace.end(span, { status: "ok", httpStatus: resp.status, preview: text.slice(0, 200) });
    return text;
  } catch (err) {
    trace.fail(span, err);
    return `Error calling ${url2}: ${err.message}`;
  }
}

// ../reference-runtime/runtime/mcp.js
var PROTOCOL_VERSION = "2025-06-18";
var McpClient = class {
  constructor({ url: url2, trace, headers, onProgress } = {}) {
    this.url = url2;
    this.trace = trace;
    this.headers = headers || {};
    this.onProgress = onProgress;
    this.sessionId = null;
    this.initialized = null;
    this.rpcId = 0;
  }
  async _rpc(method, params, { parentSpan, notification = false } = {}) {
    const span = this.trace?.start("mcp_call", {
      parent: parentSpan,
      peerOrigin: hostOf2(this.url),
      url: this.url,
      method,
      args: params
    });
    try {
      const body = { jsonrpc: "2.0", method, params: params || {} };
      if (!notification) body.id = ++this.rpcId;
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": PROTOCOL_VERSION,
        ...this.headers
      };
      if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;
      const resp = await fetch(this.url, { method: "POST", headers, body: JSON.stringify(body) });
      const sid = resp.headers.get("Mcp-Session-Id");
      if (sid) this.sessionId = sid;
      if (notification) {
        this.trace?.end(span, { status: "ok", notification: true });
        return null;
      }
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`MCP HTTP ${resp.status}: ${text.slice(0, 200)}`);
      }
      const json2 = await readJsonRpcResponse(resp, body.id, (notice) => {
        const params2 = notice.params || {};
        const message = params2.message || params2.data?.message || (typeof params2.data === "string" ? params2.data : "");
        const progress = params2.progress ?? params2.data ?? params2;
        this.trace?.note("tool_progress", {
          parent: span,
          peerOrigin: hostOf2(this.url),
          toolKind: "MCP",
          method: notice.method,
          progress,
          message
        });
        this.onProgress?.({ method: notice.method, progress, message, params: params2 });
      });
      if (json2.error) throw new Error(`MCP error ${json2.error.code}: ${json2.error.message}`);
      this.trace?.end(span, { status: "ok" });
      return json2.result;
    } catch (err) {
      this.trace?.fail(span, err);
      throw err;
    }
  }
  async ensureInit(parentSpan) {
    if (this.initialized) return this.initialized;
    this.initialized = (async () => {
      await this._rpc("initialize", {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "neuro-san-web", title: "neuro-san-web MCP client", version: "0.1.0" }
      }, { parentSpan });
      await this._rpc("notifications/initialized", {}, { parentSpan, notification: true });
    })();
    return this.initialized;
  }
  async listTools(parentSpan) {
    await this.ensureInit(parentSpan);
    const result = await this._rpc("tools/list", {}, { parentSpan });
    return result?.tools || [];
  }
  async callTool(name, args, parentSpan) {
    await this.ensureInit(parentSpan);
    const result = await this._rpc("tools/call", { name, arguments: args || {} }, { parentSpan });
    const parts = (result?.content || []).map((c) => c.type === "text" ? c.text : JSON.stringify(c));
    const text = parts.join("\n");
    return result?.isError ? `MCP tool error: ${text}` : text;
  }
};
async function readJsonRpcResponse(resp, expectId, onNotification) {
  const contentType = resp.headers?.get?.("content-type") || "";
  if (!/text\/event-stream/i.test(contentType) || !resp.body?.getReader) {
    const text = await resp.text();
    return parseMaybeSse(text, expectId, onNotification);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fallback = null;
  const accept = (payload) => {
    if (!payload || payload === "[DONE]") return null;
    let json2;
    try {
      json2 = JSON.parse(payload);
    } catch {
      return null;
    }
    if (!("result" in json2) && !("error" in json2)) {
      onNotification?.(json2);
      return null;
    }
    if (expectId == null || json2.id === expectId) return json2;
    if (!fallback) fallback = json2;
    return null;
  };
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, "\n");
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const payload = block.split("\n").filter((line) => line.trimStart().startsWith("data:")).map((line) => line.slice(line.indexOf(":") + 1).trimStart()).join("\n");
      const response = accept(payload);
      if (response) {
        try {
          await reader.cancel();
        } catch {
        }
        return response;
      }
    }
    if (done) break;
  }
  if (buffer.trim()) {
    const payload = buffer.split("\n").filter((line) => line.trimStart().startsWith("data:")).map((line) => line.slice(line.indexOf(":") + 1).trimStart()).join("\n");
    const response = accept(payload);
    if (response) return response;
  }
  if (fallback) return fallback;
  throw new Error("unparseable MCP response");
}
function parseMaybeSse(text, expectId, onNotification) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  let fallback = null;
  for (const line of trimmed.split("\n")) {
    const l = line.trim();
    if (!l.startsWith("data:")) continue;
    const payload = l.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    let json2;
    try {
      json2 = JSON.parse(payload);
    } catch {
      continue;
    }
    if (!("result" in json2) && !("error" in json2)) {
      onNotification?.(json2);
      continue;
    }
    if (expectId == null || json2.id === expectId) return json2;
    if (!fallback) fallback = json2;
  }
  if (fallback) return fallback;
  throw new Error("unparseable MCP response");
}
function hostOf2(url2) {
  try {
    return new URL(url2).host;
  } catch {
    return url2;
  }
}

// ../reference-runtime/runtime/execution-stream.js
var AsyncEventQueue = class {
  constructor() {
    this.values = [];
    this.waiters = [];
    this.closed = false;
    this.error = null;
  }
  push(value) {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter.resolve({ value, done: false });
    else this.values.push(value);
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this._flush();
  }
  fail(error) {
    if (this.closed) return;
    this.error = error instanceof Error ? error : new Error(String(error));
    this.closed = true;
    this._flush();
  }
  _flush() {
    if (this.values.length) return;
    while (this.waiters.length) {
      const waiter = this.waiters.shift();
      if (this.error) waiter.reject(this.error);
      else waiter.resolve({ value: void 0, done: true });
    }
  }
  next() {
    if (this.values.length) {
      const value = this.values.shift();
      if (!this.values.length && this.closed) this._flush();
      return Promise.resolve({ value, done: false });
    }
    if (this.error) return Promise.reject(this.error);
    if (this.closed) return Promise.resolve({ value: void 0, done: true });
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }
  [Symbol.asyncIterator]() {
    return this;
  }
};
function preview(value, limit = 240) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return text.length > limit ? `${text.slice(0, limit - 1)}\u2026` : text;
}
function createTurnEventStream(trace, runTurn, streamToken) {
  const queue = new AsyncEventQueue();
  const spans = /* @__PURE__ */ new Map();
  const included = /* @__PURE__ */ new Set();
  let runId = null;
  const nearest = (id, kind) => {
    let current = id;
    while (current) {
      const span = spans.get(current);
      if (!span) return null;
      if (span.kind === kind) return span;
      current = span.parent;
    }
    return null;
  };
  const base = (type, ev, extra = {}) => ({
    type,
    seq: ev.seq,
    timestamp: ev.wall,
    turnId: runId,
    id: ev.id || `${type}:${ev.seq}`,
    parentId: ev.parent ?? null,
    ...extra
  });
  const onTrace = (message) => {
    const ev = message.detail;
    if (ev.phase === "start" && ev.kind === "run" && runId === null && (!streamToken || ev.streamToken === streamToken)) {
      runId = ev.id;
      included.add(ev.id);
      spans.set(ev.id, ev);
      queue.push(base("turn.started", ev, { input: ev.input || "" }));
      return;
    }
    if (runId === null) return;
    const belongs = included.has(ev.id) || ev.parent && included.has(ev.parent);
    if (!belongs) return;
    if (ev.phase === "start" && ev.id) {
      included.add(ev.id);
      spans.set(ev.id, ev);
    } else if (ev.id && spans.has(ev.id)) {
      spans.set(ev.id, { ...spans.get(ev.id), ...ev });
    }
    const agent = nearest(ev.id || ev.parent, "agent");
    const tool = nearest(ev.id || ev.parent, "tool");
    const source = agent ? {
      origin: agent.origin,
      network: agent.network,
      agent: agent.agent,
      invocationId: agent.invocation
    } : void 0;
    if (ev.phase === "start" && ev.kind === "agent") {
      queue.push(base("agent.started", ev, {
        source: { origin: ev.origin, network: ev.network, agent: ev.agent, invocationId: ev.invocation },
        visibility: "user"
      }));
    } else if (ev.phase === "update" && ev.kind === "model_call" && ev.streamChunk) {
      queue.push(base("agent.output.delta", ev, {
        source,
        delta: ev.streamChunk,
        // Root answer deltas are user-facing; downstream working text stays
        // available to developer consumers without leaking into the main UI.
        visibility: agent?.isTopFrontMan ? "user" : "developer"
      }));
    } else if (ev.phase === "start" && ev.kind === "tool") {
      queue.push(base("tool.started", ev, {
        source,
        tool: { name: ev.tool, callId: ev.callId, kind: ev.toolKind },
        visibility: "user"
      }));
    } else if (ev.phase === "note" && ev.kind === "tool_progress") {
      queue.push(base("tool.progress", ev, {
        source,
        tool: { name: ev.tool || tool?.tool, callId: ev.callId || tool?.callId, kind: ev.toolKind || tool?.toolKind },
        progress: ev.progress,
        message: ev.message || "",
        visibility: "user"
      }));
    } else if (ev.phase === "end" && ev.kind === "tool") {
      queue.push(base(ev.status === "error" ? "tool.failed" : "tool.completed", ev, {
        source,
        tool: { name: ev.tool, callId: ev.callId, kind: ev.toolKind },
        resultPreview: preview(ev.resultPreview || ev.error || ""),
        error: ev.status === "error" ? ev.error : void 0,
        visibility: "user"
      }));
    } else if (ev.phase === "note" && ev.kind === "agent_result") {
      queue.push(base("agent.completed", ev, {
        source: { origin: ev.origin, network: ev.network, agent: ev.agent, invocationId: ev.invocation },
        resultPreview: preview(ev.text || ""),
        visibility: "user"
      }));
    } else if (ev.phase === "end" && ev.status === "error" && ev.kind === "agent") {
      queue.push(base("agent.failed", ev, { source, error: ev.error, visibility: "user" }));
    } else if (ev.phase === "note" && ev.kind === "steering") {
      queue.push(base(ev.state === "applied" ? "turn.steering.applied" : "turn.steering.received", ev, {
        input: ev.input || "",
        count: ev.count || 1,
        visibility: "user"
      }));
    }
  };
  trace.addEventListener("event", onTrace);
  Promise.resolve().then(async () => {
    try {
      const result = await runTurn();
      queue.push({
        type: "turn.completed",
        seq: Number.MAX_SAFE_INTEGER,
        timestamp: Date.now(),
        turnId: result.turnId || runId,
        id: `${result.turnId || runId}:completed`,
        parentId: result.turnId || runId,
        result,
        visibility: "user"
      });
      queue.close();
    } catch (error) {
      queue.push({
        type: "turn.failed",
        seq: Number.MAX_SAFE_INTEGER,
        timestamp: Date.now(),
        turnId: runId,
        id: `${runId || "turn"}:failed`,
        parentId: runId,
        error: String(error?.message || error),
        visibility: "user"
      });
      queue.fail(error);
    } finally {
      trace.removeEventListener("event", onTrace);
    }
  });
  return queue;
}

// ../reference-runtime/runtime/form-actions.js
var secret = /password|passwd|secret|token|csrf|authorization|cookie|credit.?card|card.?number|cvv|cvc|otp/i;
var unsafe = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
var controls = (form) => [...form.elements].filter((e) => e.name && !e.matches(":disabled"));
var label = (e) => (e.getAttribute("aria-label") || [...e.labels || []].map((l) => l.textContent).join(" ") || e.name || "").trim().slice(0, 200);
var hash = (text) => {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
};
function ownUrl(path, base) {
  const url2 = new URL(path, base);
  if (!["http:", "https:"].includes(url2.protocol) || url2.origin !== location.origin || url2.username || url2.password) throw new Error("Form pages and endpoints must be on the owning origin.");
  url2.hash = "";
  return url2;
}
async function boundedText(response) {
  if (!response.body) return "";
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > 1024 * 1024) throw new Error("Form page/response exceeds 1 MB.");
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
}
async function pageDocument(url2, signal) {
  const response = await fetch(url2, { credentials: "same-origin", cache: "no-store", redirect: "error", signal });
  if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) throw new Error("Form page unavailable or not HTML; sign in on the owning site if needed.");
  const doc = new DOMParser().parseFromString(await boundedText(response), "text/html");
  const base = ownUrl(doc.querySelector("base[href]")?.getAttribute("href") || url2, url2);
  return { doc, base };
}
function describe(form, pageUrl, base, index, submitIndex) {
  if (form.closest("[data-nsdeploy-ignore],[data-nsdeploy-ui]")) throw new Error("Excluded by site owner or agent UI.");
  const all = controls(form);
  if (form.hasAttribute("onsubmit") || [...form.elements].some((e) => [...e.attributes].some((a) => /^on/i.test(a.name)))) throw new Error("Inline JavaScript form requires a registered module.");
  if (all.some((e) => ["password", "file", "image"].includes(e.type) || /cc-|one-time-code|password/.test(e.autocomplete || ""))) throw new Error("Sensitive/file controls require the site's own UI.");
  const submitters = [...form.elements].filter((e) => e.type === "submit" && !e.matches(":disabled"));
  const submitter = submitters[submitIndex];
  const attr = (name2) => submitter?.getAttribute(`form${name2}`) ?? form.getAttribute(name2);
  if (!attr("action")) throw new Error("No explicit native action; JavaScript-only forms require a registered module.");
  const endpoint = ownUrl(attr("action"), base).href;
  const method = (attr("method") || "get").toUpperCase();
  const enctype = (attr("enctype") || "application/x-www-form-urlencoded").toLowerCase();
  if (!["GET", "POST"].includes(method) || !["application/x-www-form-urlencoded", "multipart/form-data"].includes(enctype)) throw new Error("Unsupported native form method/encoding.");
  const fields = /* @__PURE__ */ new Map();
  for (const e of all) {
    if (["hidden", "submit", "button", "reset"].includes(e.type) || e.readOnly) continue;
    if (secret.test(e.name) || unsafe.has(e.name)) throw new Error("Sensitive or unsafe field name requires the site's own UI.");
    if (!["INPUT", "SELECT", "TEXTAREA"].includes(e.tagName)) throw new Error("Custom controls require a registered module.");
    if (!fields.has(e.name)) fields.set(e.name, []);
    fields.get(e.name).push(e);
  }
  const properties = /* @__PURE__ */ Object.create(null), required = [];
  for (const [name2, group] of fields) {
    const e = group[0];
    let s = { type: "string", title: label(e) };
    if (group.every((c) => c.type === "radio")) s.enum = group.map((c) => c.value);
    else if (group.every((c) => c.type === "checkbox")) {
      s = group.length === 1 ? { ...s, type: "boolean" } : { ...s, type: "array", items: { type: "string", enum: group.map((c) => c.value) } };
    } else if (group.length > 1) throw new Error("Repeated non-choice field names require a registered module.");
    else if (e.tagName === "SELECT") {
      const values = [...e.options].filter((o) => !o.disabled && !o.parentElement?.disabled).map((o) => o.value);
      if (!values.length) throw new Error("Empty select requires application data.");
      s = e.multiple ? { ...s, type: "array", items: { type: "string", enum: values } } : { ...s, enum: values };
    } else if (e.type === "number" || e.type === "range") {
      s.type = "number";
      for (const [attr2, key] of [["min", "minimum"], ["max", "maximum"]]) if (e.getAttribute(attr2) && Number.isFinite(Number(e.getAttribute(attr2)))) s[key] = Number(e.getAttribute(attr2));
    } else {
      if (["date", "email"].includes(e.type)) s.format = e.type;
      for (const [attr2, key] of [["minlength", "minLength"], ["maxlength", "maxLength"]]) if (e.hasAttribute(attr2)) s[key] = Number(e.getAttribute(attr2));
    }
    properties[name2] = s;
    if (group.some((c) => c.required)) required.push(name2);
  }
  const inputSchema = { type: "object", properties, required };
  if (all.some((e) => (e.type === "hidden" || e.readOnly) && fields.has(e.name))) throw new Error("Hidden/fixed fields overlap editable fields; use a registered module.");
  const effect = form.getAttribute("data-nsdeploy-effect") === "read" ? "read" : "write";
  const identity = `${pageUrl}|${form.id || index}|${submitIndex}`;
  const name = `form_${hash(identity)}`;
  const title = form.getAttribute("aria-label") || form.getAttribute("name") || form.id || submitter?.textContent || submitter?.value || `Form ${index + 1}`;
  const description = `${title.trim().slice(0, 200)}: ${method} ${new URL(endpoint).pathname}. Native form on ${new URL(pageUrl).pathname}. Returns a server response; business success must be verified from its content.`;
  const signature = JSON.stringify({
    endpoint,
    method,
    enctype,
    inputSchema,
    effect,
    hidden: all.filter((e) => e.type === "hidden").map((e) => [e.name, secret.test(e.name) ? null : e.value]),
    fixed: all.filter((e) => e.readOnly).map((e) => [e.name, e.value]),
    submit: submitter ? [submitter.name, submitter.value] : null
  });
  return { name, description, inputSchema, effect, signature, endpoint, method, enctype, form, fields, submitter };
}
function fill(def, args) {
  validateData(def.inputSchema, args);
  for (const [name, group] of def.fields) {
    const value = args[name];
    for (const e of group) {
      if (e.type === "checkbox") e.checked = group.length === 1 ? value === true : (value || []).includes(e.value);
      else if (e.type === "radio") e.checked = value === e.value;
      else if (e.tagName === "SELECT" && e.multiple) for (const o of e.options) o.selected = (value || []).includes(o.value);
      else e.value = value == null ? "" : String(value);
    }
  }
  if (!HTMLFormElement.prototype.checkValidity.call(def.form)) throw new Error("The website's native form validation rejected these values. Nothing was submitted.");
}
function responseEvidence(text, contentType, hiddenValues) {
  const redact = (value) => {
    let result = value;
    for (const v of hiddenValues) if (v.length >= 4) result = result.split(v).join("[redacted]");
    return result;
  };
  if (contentType.includes("json")) {
    const data = JSON.parse(text, (key, value) => secret.test(key) || unsafe.has(key) ? void 0 : value);
    return { format: "json", text: redact(JSON.stringify(data)).slice(0, 12e3) };
  }
  const doc = new DOMParser().parseFromString(text, "text/html");
  doc.querySelectorAll("script,style,template,form,input,textarea,select,[hidden]").forEach((e) => e.remove());
  return { format: "text", text: redact(doc.body.textContent.replace(/\s+/g, " ").trim()).slice(0, 12e3) };
}
async function registerFormActions(actions, { pages = [], callerOrigins = [], base = location.href, report = () => {
} } = {}) {
  let count = 0;
  for (const path of pages) {
    try {
      const url2 = ownUrl(path, base).href;
      const source = await pageDocument(url2, AbortSignal.timeout(15e3));
      const forms = [...source.doc.forms];
      if (!forms.length) report({ page: path, reason: "No native forms found. Client-rendered/JavaScript-only pages need a registered module." });
      for (let index = 0; index < forms.length; index++) {
        const n = Math.max(1, [...forms[index].elements].filter((e) => e.type === "submit" && !e.matches(":disabled")).length);
        for (let submitIndex = 0; submitIndex < n; submitIndex++) {
          try {
            const def = describe(forms[index], url2, source.base, index, submitIndex);
            actions.register({
              name: def.name,
              description: def.description,
              inputSchema: def.inputSchema,
              effect: def.effect,
              availability: "bridge",
              callerOrigins,
              async execute(args, { signal }) {
                const fresh = await pageDocument(url2, signal || AbortSignal.timeout(15e3));
                const form = def.form.id ? fresh.doc.getElementById(def.form.id) : fresh.doc.forms[index];
                if (!form || form.tagName !== "FORM") throw new Error("Form disappeared; refresh the agent page.");
                const current = describe(form, url2, fresh.base, index, submitIndex);
                if (current.signature !== def.signature) throw new Error("Form changed since review; refresh the agent page. Nothing was submitted.");
                return submitNativeForm(current, args, signal);
              }
            });
            count++;
          } catch (error) {
            report({ page: path, form: index + 1, reason: error.message });
          }
        }
      }
    } catch (error) {
      report({ page: path, reason: error.message });
    }
  }
  return count;
}
async function submitNativeForm(current, args, signal) {
  fill(current, args);
  const data = new FormData(current.form, current.submitter);
  const endpoint = new URL(current.endpoint);
  const options2 = { method: current.method, credentials: "same-origin", redirect: "error", signal };
  if (current.method === "GET") endpoint.search = new URLSearchParams(data).toString();
  else options2.body = current.enctype === "multipart/form-data" ? data : new URLSearchParams(data);
  const response = await fetch(endpoint, options2);
  if (!response.ok) throw new Error(`Website returned HTTP ${response.status}; check the site before retrying.`);
  const evidence2 = responseEvidence(
    await boundedText(response),
    response.headers.get("content-type") || "",
    controls(current.form).filter((e) => e.type === "hidden" || e.readOnly).map((e) => e.value)
  );
  return { outcome: "response_received", businessOutcome: "unverified", httpStatus: response.status, evidence: evidence2 };
}
function watchHostForms(registry, scope, { doc = document, onChange = () => {
} } = {}) {
  const ids = /* @__PURE__ */ new WeakMap(), owned = /* @__PURE__ */ new Set();
  let serial = 0, timer;
  const refresh = () => {
    clearTimeout(timer);
    const before = [...owned].join("|");
    for (const ref of owned) registry.entries.delete(ref);
    owned.clear();
    registry.discoveryIssues = registry.discoveryIssues.filter((i) => !(i.base === scope.base && i.network === scope.network && i.source === "host"));
    const report = (reason) => registry.discoveryIssues.push({ ...scope, source: "host", page: "Host page", reason });
    let page, base;
    try {
      page = ownUrl(doc.URL, doc.URL).href;
      base = ownUrl(doc.baseURI, page);
    } catch (error) {
      report(error.message);
      onChange();
      return 0;
    }
    const forms = [...doc.forms].filter((f) => !f.closest("[data-nsdeploy-ui],[data-nsdeploy-ignore]"));
    for (const form of forms) {
      if (!ids.has(form)) ids.set(form, ++serial);
      const index = ids.get(form);
      const n = Math.max(1, [...form.elements].filter((e) => e.type === "submit" && !e.matches(":disabled")).length);
      for (let submitIndex = 0; submitIndex < n; submitIndex++) {
        try {
          const def = describe(form, page, base, index, submitIndex);
          const name = `host_${index}_${submitIndex}_${hash(page + def.signature)}`;
          owned.add(registry.register(scope, {
            name,
            description: def.description,
            inputSchema: def.inputSchema,
            effect: def.effect,
            availability: "local-only",
            async execute(args, { signal } = {}) {
              if (!form.isConnected || ownUrl(doc.URL, doc.URL).href !== page) throw new Error("Host form disappeared or page changed; request a new proposal.");
              const current = describe(form, page, ownUrl(doc.baseURI, page), index, submitIndex);
              if (current.signature !== def.signature) throw new Error("Form changed since review. Nothing was submitted.");
              const copy = doc.cloneNode(true);
              const originals = doc.querySelectorAll("input,textarea,select");
              const copies = copy.querySelectorAll("input,textarea,select");
              originals.forEach((e, i) => {
                if (e.type !== "file") copies[i].value = e.value;
                if (e.tagName === "INPUT") copies[i].checked = e.checked;
                if (e.tagName === "SELECT") [...e.options].forEach((o, j) => {
                  copies[i].options[j].selected = o.selected;
                });
              });
              const cloned = copy.forms[[...doc.forms].indexOf(form)];
              return submitNativeForm(describe(cloned, page, base, index, submitIndex), args, signal);
            }
          }));
        } catch (error) {
          report(error.message);
        }
      }
    }
    if (!owned.size) report("No native host forms connected. Embed the widget beside existing native forms or register JavaScript actions.");
    if (before !== [...owned].join("|")) onChange();
    return owned.size;
  };
  refresh();
  const observer = new MutationObserver((records) => {
    if (records.some((r) => !r.target.parentElement?.closest("[data-nsdeploy-ui]") && !r.target.closest?.("[data-nsdeploy-ui]"))) {
      clearTimeout(timer);
      timer = setTimeout(refresh, 50);
    }
  });
  observer.observe(doc.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  const dispose = () => {
    observer.disconnect();
    clearTimeout(timer);
    for (const ref of owned) registry.entries.delete(ref);
    owned.clear();
  };
  window.addEventListener("pagehide", dispose, { once: true });
  return { refresh, dispose };
}

// ../reference-runtime/runtime/web-crypto.js
var fallbackSequence = 0;
function randomUuid(cryptoImpl = globalThis.crypto) {
  if (typeof cryptoImpl?.randomUUID === "function") return cryptoImpl.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof cryptoImpl?.getRandomValues === "function") cryptoImpl.getRandomValues(bytes);
  else {
    const stamp = Date.now() + ++fallbackSequence;
    for (let i = 0; i < bytes.length; i++) bytes[i] = (Math.random() * 256 ^ stamp >>> i % 6 * 8) & 255;
  }
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}
function fallbackSha256(bytes) {
  const constants = [
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ];
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 128;
  const bitLength = BigInt(bytes.length) * 8n;
  for (let i = 0; i < 8; i++) padded[paddedLength - 1 - i] = Number(bitLength >> BigInt(i * 8) & 255n);
  const hash2 = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
  const words = new Uint32Array(64);
  const rotate = (value, amount) => value >>> amount | value << 32 - amount;
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const base = offset + i * 4;
      words[i] = padded[base] << 24 | padded[base + 1] << 16 | padded[base + 2] << 8 | padded[base + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotate(words[i - 15], 7) ^ rotate(words[i - 15], 18) ^ words[i - 15] >>> 3;
      const s1 = rotate(words[i - 2], 17) ^ rotate(words[i - 2], 19) ^ words[i - 2] >>> 10;
      words[i] = words[i - 16] + s0 + words[i - 7] + s1 >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash2;
    for (let i = 0; i < 64; i++) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const t1 = h + s1 + (e & f ^ ~e & g) + constants[i] + words[i] >>> 0;
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const t2 = s0 + (a & b ^ a & c ^ b & c) >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    for (const [i, value] of [a, b, c, d, e, f, g, h].entries()) hash2[i] = hash2[i] + value >>> 0;
  }
  return [...hash2].map((value) => value.toString(16).padStart(8, "0")).join("");
}
async function sha256Hex(value, cryptoImpl = globalThis.crypto) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  if (typeof cryptoImpl?.subtle?.digest === "function") {
    const digest = await cryptoImpl.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return fallbackSha256(bytes);
}

// ../reference-runtime/runtime/discovered-actions.js
function url(value) {
  const u = new URL(value);
  if (!["https:", "http:"].includes(u.protocol) || u.username || u.password || u.hash || value.includes("\\")) throw new Error("Invalid discovered endpoint.");
  return u;
}
async function read(response, limit = 65536) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error("Action response exceeded its size limit; outcome may be unknown.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
var options = (signal) => ({ signal, credentials: "omit", mode: "cors", redirect: "error", cache: "no-store", referrerPolicy: "no-referrer" });
function canonical2(value) {
  if (Array.isArray(value)) return value.map(canonical2);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical2(value[k])]));
  return value;
}
async function formFingerprint(form) {
  const attributes = (node) => Object.fromEntries([...node.attributes].map((a) => [a.name, a.value]));
  const contract = { attributes: attributes(form), controls: [...form.querySelectorAll("input,select,textarea,button,option")].map((n) => ({
    tag: n.tagName.toLowerCase(),
    attributes: attributes(n),
    ...n.tagName === "OPTION" ? { text: n.textContent } : {}
  })) };
  return sha256Hex(JSON.stringify(canonical2(contract)));
}
async function formRequest(request, args, signal) {
  const response = await fetch(url(request.page), options(signal));
  if (!response.ok) throw new Error(`Cannot refresh source form: HTTP ${response.status}. No submission sent.`);
  const doc = new DOMParser().parseFromString(await read(response, 2e6), "text/html");
  const source = doc.forms[request.index];
  if (!source || await formFingerprint(source) !== request.fingerprint) throw new Error("Source form changed. Rebuild with --action-refresh and review it. No submission sent.");
  const form = document.importNode(source, true);
  for (const node of form.querySelectorAll("input,textarea,select")) {
    if (!node.name || node.disabled) continue;
    const value = args[node.name];
    if (node.type === "checkbox" || node.type === "radio") node.checked = (Array.isArray(value) ? value : [value]).includes(node.value);
    else if (node.tagName === "SELECT" && node.multiple) {
      for (const option of node.options) option.selected = (value || []).includes(option.value);
    } else {
      const supplied = value === void 0 ? "" : String(value);
      node.value = supplied;
      if (node.value !== supplied) throw new Error(`Invalid native form value for ${node.name}. No submission sent.`);
    }
  }
  if (!form.checkValidity()) throw new Error("Form values violate the source website's constraints. No submission sent.");
  const data = new URLSearchParams(new FormData(form));
  const endpoint = url(request.url);
  if (request.method === "GET") {
    endpoint.search = data.toString();
    return { endpoint, init: {} };
  }
  return { endpoint, init: { body: data } };
}
function apiRequest(request, args) {
  let template = request.url;
  for (const field of request.bindings.filter((f) => f.in === "path")) {
    const value = String(args[field.name]);
    if (!/^[-a-zA-Z0-9_.~]+$/.test(value) || [".", ".."].includes(value)) throw new Error("Unsafe API path parameter.");
    template = template.replaceAll(`{${field.name}}`, encodeURIComponent(value));
  }
  if (/[{}]/.test(template)) throw new Error("Unresolved API path parameter.");
  const endpoint = url(template), body = {};
  if (endpoint.origin !== url(request.url).origin) throw new Error("API endpoint origin changed.");
  for (const field of request.bindings) {
    if (!Object.hasOwn(args, field.name)) continue;
    let value = args[field.name];
    if (field.in === "query") endpoint.searchParams.set(field.name, String(value));
    if (field.in === "body") {
      if (request.jsonFields.includes(field.name)) {
        value = cloneData(JSON.parse(value));
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field.name} must contain a JSON object.`);
      }
      body[field.name] = value;
    }
  }
  return { endpoint, init: request.body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {} };
}
function evidence(text, contentType) {
  if (contentType.includes("json")) {
    try {
      return JSON.parse(text, (key, value) => /password|secret|token|authorization|cookie|api.?key/i.test(key) ? "[redacted]" : value);
    } catch {
      return { note: "Response declared JSON but could not be parsed." };
    }
  }
  if (contentType.includes("html")) {
    const doc = new DOMParser().parseFromString(text, "text/html");
    doc.querySelectorAll("script,style,form,iframe,object").forEach((n) => n.remove());
    return doc.body.textContent.trim().slice(0, 16e3);
  }
  return text.slice(0, 16e3);
}
function registerDiscoveredActions(actions, document2, callerOrigins = []) {
  if (document2.version !== 1 || !Array.isArray(document2.actions) || document2.actions.length > 100) throw new Error("Invalid discovered action catalog.");
  for (const candidate of document2.actions) {
    if (candidate.enabled !== true) continue;
    const action = cloneData(candidate), request = action.request;
    url(request.url);
    if (!["form", "http"].includes(request.kind) || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(request.method)) throw new Error("Unsupported discovered request.");
    if (request.kind === "form" && (url(request.page).origin !== url(request.url).origin || !["GET", "POST"].includes(request.method))) throw new Error("Invalid form destination.");
    actions.register({
      name: action.name,
      description: action.description,
      inputSchema: action.inputSchema,
      effect: action.effect,
      availability: action.effect === "read" ? "bridge" : "top-level",
      callerOrigins,
      execute: async (args, { signal }) => {
        validateData(action.inputSchema, args);
        const { endpoint, init } = request.kind === "form" ? await formRequest(request, args, signal) : apiRequest(request, args);
        const response = await fetch(endpoint, { ...options(signal), method: request.method, ...init });
        const text = await read(response, 48e3);
        return {
          state: "response_received",
          businessOutcome: "unverified",
          httpStatus: response.status,
          httpOk: response.ok,
          method: request.method,
          url: endpoint.href,
          data: evidence(text, response.headers.get("content-type") || "")
        };
      }
    });
  }
}
async function loadDiscoveredActions(actions, catalogUrl, callerOrigins = []) {
  const response = await fetch(catalogUrl, options());
  if (!response.ok) throw new Error(`Discovered action catalog unavailable: HTTP ${response.status}.`);
  registerDiscoveredActions(actions, JSON.parse(await read(response, 2e6)), callerOrigins);
}

// ../reference-runtime/runtime/action-transport.js
var protocol = "nsdeploy-actions-v1";
function sameOriginAsset(base, path) {
  const url2 = new URL(path, `${base.replace(/\/$/, "")}/`);
  if (!["http:", "https:"].includes(url2.protocol) || url2.origin !== new URL(base).origin || url2.username || url2.password) throw new Error("Action assets must belong to their publishing origin.");
  return url2.href;
}
async function loadActionModule(registry, scope, manifest, { bridge = false } = {}) {
  if (!manifest.actions) return;
  if (new URL(scope.base).origin !== location.origin) throw new Error("Executable action adapters must run on their own origin.");
  if (manifest.actions.version !== 1) throw new Error("Unsupported action protocol.");
  const actions = { register: (definition) => registry.register(scope, definition) };
  if (manifest.actions.catalog) await loadDiscoveredActions(actions, sameOriginAsset(scope.base, manifest.actions.catalog), manifest.actions.callerOrigins || []);
  for (const path of new Set([manifest.actions.module, ...manifest.actions.modules || []].filter(Boolean))) {
    const module = await import(sameOriginAsset(scope.base, path));
    if (typeof module.registerActions !== "function") throw new Error("Action modules must export registerActions.");
    await module.registerActions(actions);
  }
  await registerFormActions(actions, {
    pages: manifest.actions.pages || [],
    callerOrigins: manifest.actions.callerOrigins || [],
    base: scope.base,
    report: (issue) => {
      registry.discoveryIssues.push({ ...scope, ...issue });
      console.warn("Action discovery:", issue);
    }
  });
  if (manifest.actions.hostPage && !bridge) {
    registry.hostForms?.dispose();
    registry.hostForms = watchHostForms(registry, scope, { onChange: () => registry.onChange?.() });
  }
  if (!registry.catalog(scope).length && !(manifest.actions.hostPage && !bridge)) {
    registry.discoveryIssues.push({ ...scope, page: "Action sources", reason: "No website actions connected. Check configured routes/modules on the actual application origin; a generated agent page supplies no business actions." });
  }
}
function openActionWindow(url2, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Action was cancelled."));
      return;
    }
    const dialog = document.createElement("dialog");
    const text = document.createElement("p");
    text.textContent = `Continue at ${new URL(url2).origin} to authorize this action. Sign in there if needed.`;
    const open = document.createElement("button");
    open.textContent = "Open action site";
    const cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    const cleanup = () => {
      dialog.close();
      dialog.remove();
      signal?.removeEventListener("abort", stop);
    };
    const stop = () => {
      cleanup();
      reject(new Error("Action window cancelled; action not started."));
    };
    open.onclick = () => {
      const popup = window.open(url2, "_blank", "popup,width=700,height=650");
      if (!popup) {
        text.textContent = "Allow popups for this page, then try again.";
        return;
      }
      cleanup();
      resolve(popup);
    };
    cancel.onclick = stop;
    signal?.addEventListener("abort", stop, { once: true });
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      stop();
    });
    dialog.append(text, open, cancel);
    document.body.append(dialog);
    dialog.showModal();
  });
}
var ActionBridgeClient = class {
  constructor(url2) {
    this.url = url2;
    this.pending = /* @__PURE__ */ new Map();
    this.seq = 0;
  }
  async connect(popup = false, signal) {
    if (this.port) return;
    const origin = new URL(this.url).origin;
    let peer;
    const ready = new Promise((resolve, reject) => {
      this.rejectHandshake = reject;
      this.handshakeCleanup = () => {
        clearTimeout(timer);
        window.removeEventListener("message", receive);
      };
      const receive = (event) => {
        if (event.source !== peer || event.origin !== origin || event.data?.protocol !== protocol || event.data?.type !== "ready") return;
        const channel = new MessageChannel();
        this.port = channel.port1;
        this.port.onmessage = ({ data }) => {
          const p = this.pending.get(data?.id);
          if (!p) return;
          this.pending.delete(data.id);
          clearTimeout(p.timer);
          data.ok ? p.resolve(data.value) : p.reject(new Error(data.error));
        };
        peer.postMessage({ protocol, type: "connect" }, origin, [channel.port2]);
        this.handshakeCleanup();
        this.rejectHandshake = null;
        resolve();
      };
      const timer = setTimeout(() => {
        this.handshakeCleanup();
        reject(new Error("Action bridge unavailable. Check framing policy, callerOrigins and login; no action was sent."));
      }, popup ? 12e4 : 1e4);
      window.addEventListener("message", receive);
    });
    ready.catch(() => {
    });
    try {
      if (popup) {
        peer = await openActionWindow(this.url, signal);
        this.popup = peer;
      } else {
        this.frame = document.createElement("iframe");
        this.frame.hidden = true;
        this.frame.title = "Site action bridge";
        this.frame.sandbox = "allow-scripts allow-same-origin";
        this.frame.src = this.url;
        document.body.append(this.frame);
        peer = this.frame.contentWindow;
      }
      await ready;
      if (this.popup) this.closeWatch = setInterval(() => {
        if (this.popup.closed) this.dispose();
      }, 500);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  request(type, payload = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Action response timed out; outcome unknown. Check the site before retrying."));
      }, type === "execute" ? 18e4 : 15e3);
      this.pending.set(id, { resolve, reject, timer });
      this.port.postMessage({ ...cloneData(payload), id, type });
    });
  }
  dispose() {
    clearInterval(this.closeWatch);
    this.rejectHandshake?.(new Error("Action bridge closed."));
    this.rejectHandshake = null;
    this.handshakeCleanup?.();
    this.port?.close();
    this.port = null;
    this.frame?.remove();
    this.popup?.close();
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("Action bridge closed; outcome unknown."));
    }
    this.pending.clear();
  }
};
async function registerRemoteActions(registry, scope, manifest) {
  if (!manifest.actions) return;
  if (manifest.actions.version !== 1) throw new Error("Unsupported action protocol.");
  const url2 = sameOriginAsset(scope.base, manifest.actions.bridge);
  registry.remoteLoads ||= /* @__PURE__ */ new Map();
  const key = `${scope.base}::${scope.network}`;
  if (registry.remoteLoads.has(key)) return registry.remoteLoads.get(key);
  const loading = discoverRemoteActions(registry, scope, url2);
  registry.remoteLoads.set(key, loading);
  try {
    await loading;
  } catch (error) {
    registry.remoteLoads.delete(key);
    throw error;
  } finally {
    registry.onChange?.();
  }
}
async function discoverRemoteActions(registry, scope, url2) {
  const client = new ActionBridgeClient(url2);
  const registered = [];
  try {
    try {
      await client.connect();
    } catch {
      await client.connect(true);
    }
    const catalog = await client.request("catalog");
    if (!Array.isArray(catalog) || catalog.length > 100) throw new Error("Invalid remote action catalog.");
    if (!catalog.length) registry.discoveryIssues.push({ ...scope, page: "Remote action bridge", reason: "No actions exposed to this caller. Check the remote site's action sources and callerOrigins; host-page forms are local only." });
    for (const definition of catalog) registered.push(registry.register(scope, definition, async (args, { requestId, signal }) => {
      const executor = new ActionBridgeClient(url2);
      const abort = () => executor.dispose();
      signal?.addEventListener("abort", abort, { once: true });
      try {
        if (signal?.aborted) throw new Error("Action was cancelled.");
        await executor.connect(definition.effect !== "read" || definition.availability === "top-level", signal);
        if (signal?.aborted) throw new Error("Action was cancelled.");
        return await executor.request("execute", { name: definition.name, args, requestId });
      } finally {
        signal?.removeEventListener("abort", abort);
        executor.dispose();
      }
    }));
  } catch (error) {
    for (const ref of registered) registry.entries.delete(ref);
    throw error;
  } finally {
    client.dispose();
  }
}

// ../reference-runtime/runtime/engine.js
function normOrigin(url2) {
  try {
    return new URL(url2).origin;
  } catch {
    return String(url2 || "");
  }
}
function sameRouter(left, right) {
  try {
    const normalize = (value) => {
      const url2 = new URL(value);
      const loopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url2.hostname);
      const host = loopback ? "loopback" : url2.hostname.toLowerCase();
      return `${url2.protocol}//${host}:${url2.port}${url2.pathname.replace(/\/$/, "")}${url2.search}`;
    };
    return normalize(left) === normalize(right);
  } catch {
    return String(left || "").replace(/\/$/, "") === String(right || "").replace(/\/$/, "");
  }
}
async function isPublishedMockRouter(router, fetchImpl = fetch) {
  try {
    const url2 = new URL(router);
    const response = await fetchImpl(`${url2.origin}/agent-manifest.json`, { cache: "no-store" });
    if (!response.ok) return false;
    const manifest = await response.json();
    const declared = manifest?.llm_router || {};
    return declared.mock === true && sameRouter(router, declared.base_url);
  } catch {
    return false;
  }
}
function selectTopRouter(manifest, routerOverride, byokKey, modelOverride = "") {
  const declared = manifest?.llm_router || {};
  const hasRealKey = !!(byokKey && byokKey !== "demo");
  const hasExplicitModel = !!String(modelOverride || "").trim();
  let requested = String(routerOverride || "").replace(/\/$/, "");
  const requestedMock = requested && declared.mock === true && sameRouter(requested, declared.base_url);
  if ((hasRealKey || hasExplicitModel) && (!requested || requestedMock)) {
    if (!declared.byok_router) {
      throw new Error("A real API key is configured, but this site publishes no AI provider route.");
    }
    requested = declared.byok_router;
    return { baseUrl: requested, mock: false, upgradedToByok: true };
  }
  if (requested) {
    return { baseUrl: requested, mock: declared.mock === true && sameRouter(requested, declared.base_url), upgradedToByok: false };
  }
  return { baseUrl: declared.base_url || "", mock: declared.mock === true, upgradedToByok: false };
}
function manifestAllowsPeer(target, manifest, runtimeAllowedPeers = /* @__PURE__ */ new Set()) {
  const targetOrigin = normOrigin(target);
  const policy = manifest?.peer_policy || manifest?.web_policy;
  if (policy?.mode === "open") {
    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return false;
    }
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const denied = (policy.deny_origins || policy.denied_origins || []).map(normOrigin);
    if (denied.includes(targetOrigin)) return false;
    return true;
  }
  const declared = (manifest?.allowed_peers || []).map(normOrigin);
  return declared.includes(targetOrigin) || runtimeAllowedPeers.has(targetOrigin);
}
function selectPeerRouter(callerRouter) {
  if (!callerRouter?.baseUrl) {
    throw new Error("The caller has no active LLM router to use for this peer network.");
  }
  return { baseUrl: callerRouter.baseUrl, mock: callerRouter.mock === true };
}
var Engine = class {
  constructor({ originUrl, trace, sandboxWorkerUrl, byokKey, routerOverride } = {}) {
    this.originUrl = (originUrl || (typeof location !== "undefined" ? location.origin : "")).replace(/\/$/, "");
    this.trace = trace || new TraceBus();
    this.sandboxWorkerUrl = sandboxWorkerUrl || "/runtime/sandbox-worker.js";
    this.byokKey = byokKey || "";
    this.routerOverride = routerOverride || "";
    this.modelOverride = normalizeModelName(arguments[0] && arguments[0].modelOverride);
    this.registry = new RemoteRegistry({ trace: this.trace });
    this.sandbox = new ToolSandbox({ workerUrl: this.sandboxWorkerUrl, trace: this.trace });
    this.top = null;
    this.agentRunner = null;
    this.history = [];
    this.consent = /* @__PURE__ */ new Map();
    this.consentTail = Promise.resolve();
    this.onConsent = null;
    this.onLinkRequired = null;
    this.runtimeAllowedPeers = /* @__PURE__ */ new Set();
    this.streamSequence = 0;
    this.actions = new ActionRegistry();
    this.actionPresentations = /* @__PURE__ */ new Map();
    this.actionSubmissions = /* @__PURE__ */ new Map();
    this.onActionConfirm = async () => false;
  }
  // Clear the multi-turn conversation history (start a new chat).
  resetHistory() {
    this.history = [];
    this.actionPresentations.clear();
    this.actionSubmissions.clear();
  }
  // Ask the user to approve contacting another hosted network. Remembers
  // "always" per origin; defaults to allow when no UI hook is attached (headless).
  async requestConsent(info) {
    const decide = async () => {
      if (this.consent.get(info.peerOrigin) === "always") return "allow";
      if (typeof this.onConsent !== "function") return "allow";
      const decision = await this.onConsent(info);
      if (decision === "always") {
        this.consent.set(info.peerOrigin, "always");
        return "allow";
      }
      return decision || "allow";
    };
    const pending = this.consentTail.then(decide, decide);
    this.consentTail = pending.then(() => void 0, () => void 0);
    return pending;
  }
  // Load the prebuilt LangChain.js AgentRunner bundle and use it as the loop.
  async enableLangChain() {
    const mod = await import("./agent-runner-stub-6AP4374J.mjs");
    this.agentRunner = mod.runAgentLangChain || mod.default;
    return this.agentRunner;
  }
  // Compile the origin's own published front network.
  async loadTop() {
    const span = this.trace.start("compile", { origin: hostOf3(this.originUrl), what: "top network" });
    try {
      const { manifest, base } = await fetchManifest(this.originUrl);
      const entry = manifest.networks[0];
      this.top = { manifest, base };
      const hasConfiguredModel = !!String(this.modelOverride || "").trim();
      const hasRealKey = !!(this.byokKey && this.byokKey !== "demo");
      if ((hasConfiguredModel || hasRealKey) && this.routerOverride && !sameRouter(this.routerOverride, manifest.llm_router?.base_url) && await isPublishedMockRouter(this.routerOverride)) {
        const oldRouter = this.routerOverride;
        this.routerOverride = manifest.llm_router?.byok_router || "";
        this.trace.note("router_correction", {
          origin: hostOf3(base),
          from: oldRouter,
          to: this.routerOverride,
          reason: "saved router is another nsDeploy site's published mock endpoint"
        });
      }
      const { network, bundleUrl, integrity, llm, validation: v } = await this._compile(base, manifest, entry, { isTop: true });
      this.top = { network, base, bundleUrl, integrity, manifest, llm };
      const loadActions = typeof location !== "undefined" && new URL(base).origin !== location.origin ? registerRemoteActions : loadActionModule;
      await loadActions(this.actions, { base, network: network.name }, manifest);
      this.trace.note("action_catalog", {
        count: this.actions.catalog({ base, network: network.name }).length,
        issues: this.actions.discoveryIssues
      });
      this.mockLLM = llm.mock;
      this.byokRouter = manifest.llm_router?.byok_router || "";
      this.trace.end(span, {
        network: network.name,
        frontMan: network.findFrontMan(),
        errors: v.errors,
        warnings: v.warnings,
        peers: v.externals || []
      });
      return { network, manifest, validation: v };
    } catch (err) {
      this.trace.fail(span, err);
      throw err;
    }
  }
  async _compile(base, manifest, entry, { isTop = false } = {}) {
    const hoconUrl = resolveUrl(base, entry.hocon);
    const text = await fetchText(hoconUrl);
    const config = parseHocon(text);
    const publishedLinks = await this._loadPublishedLinks(base, entry.name || entry.hocon);
    config.links = { ...config.links || {}, ...publishedLinks };
    const network = new AgentNetwork(config, entry.name || entry.hocon);
    const validation = validateNetwork(network);
    if (validation.errors && validation.errors.length) {
      throw new Error(`Network '${network.name}' (${hostOf3(base)}) failed validation: ${validation.errors.join("; ")}`);
    }
    const bundleUrl = manifest.coded_tools?.bundle ? resolveUrl(base, manifest.coded_tools.bundle) : null;
    const integrity = manifest.coded_tools?.integrity || null;
    let routerBase;
    let mock;
    if (isTop) {
      const selected = selectTopRouter(manifest, this.routerOverride, this.byokKey, this.modelOverride);
      routerBase = selected.baseUrl;
      mock = selected.mock;
      this.routerOverride = selected.upgradedToByok ? routerBase : this.routerOverride;
      this.userRouter = { baseUrl: routerBase, mock };
    } else {
      const selected = selectPeerRouter(this.userRouter);
      routerBase = selected.baseUrl;
      mock = selected.mock;
    }
    const llm = new LlmClient({ baseUrl: routerBase, apiKey: this.byokKey, trace: this.trace, mock });
    return { network, bundleUrl, integrity, llm, hoconUrl, validation };
  }
  // Every hop is constrained by the immediate caller's published manifest. The
  // user still approves each remote call, so a peer cannot silently expand access.
  _assertAllowedPeer(target, sourceManifest) {
    const manifest = sourceManifest || this.top?.manifest;
    if (!manifestAllowsPeer(target, manifest, this.runtimeAllowedPeers)) {
      const source = manifest?.networks?.[0]?.name || "calling network";
      throw new Error(`Policy: ${hostOf3(target)} is not in ${source}'s allowed_peers; refusing to contact it.`);
    }
  }
  async _loadPublishedLinks(base, networkName) {
    try {
      const resp = await fetch(resolveUrl(base, "/links.json"), { cache: "no-store" });
      if (!resp.ok) return {};
      const doc = await resp.json();
      return doc?.networks?.[networkName] || {};
    } catch {
      return {};
    }
  }
  _linkKey(base, networkName, reference) {
    return `nsdeploy-link-v1::${base}::${networkName}::${reference}`;
  }
  _storedLink(base, networkName, reference) {
    try {
      return localStorage.getItem(this._linkKey(base, networkName, reference)) || "";
    } catch {
      return "";
    }
  }
  async _persistLink(base, networkName, reference, target) {
    try {
      localStorage.setItem(this._linkKey(base, networkName, reference), target);
    } catch {
    }
    if (this.top?.manifest?.deployment?.mode === "static") return;
    try {
      await fetch(resolveUrl(base, "/_nsdeploy/links"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network: networkName, reference, target })
      });
    } catch {
    }
  }
  async _normalizeLinkTarget(reference, rawTarget) {
    let parsed;
    try {
      parsed = new URL(String(rawTarget || "").trim());
    } catch {
      throw new Error("Enter a complete http:// or https:// nsDeploy site URL.");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Linked network URLs must use http or https.");
    }
    const requested = parsed.pathname.endsWith("/") ? "" : parsed.pathname.split("/").filter(Boolean).pop() || "";
    const origin = (requested ? new URL("./", parsed).href : `${parsed.origin}${parsed.pathname}`).replace(/\/$/, "");
    const { manifest } = await fetchManifest(origin);
    const networks = manifest.networks || [];
    const norm = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    let entry = requested ? networks.find((item) => item.name === requested) : null;
    if (!entry) entry = networks.find((item) => norm(item.name) === norm(reference));
    if (!entry) {
      const matchedExport = (manifest.linking?.exports || []).find(
        (item) => (item.aliases || []).some((alias) => norm(alias) === norm(reference))
      );
      if (matchedExport) entry = networks.find((item) => item.name === matchedExport.network);
    }
    if (!entry && networks.length === 1) entry = networks[0];
    if (!entry) {
      const choices = networks.map((item) => item.name).join(", ") || "none";
      throw new Error(`No unique network matching '${reference}' at ${origin}. Published networks: ${choices}.`);
    }
    return `${origin}/${entry.name}`;
  }
  async resolveLink(reference, network, base, parentSpan) {
    let target = network.getLink(reference) || this._storedLink(base, network.name, reference);
    let needsValidation = false;
    if (!target) {
      if (typeof this.onLinkRequired !== "function") {
        throw new Error(`Agent-network link '${reference}' is unresolved. Supply a peer nsDeploy URL.`);
      }
      target = await this.onLinkRequired({
        reference,
        sourceNetwork: network.name,
        sourceOrigin: base,
        parentSpan
      });
      if (!target) return null;
      needsValidation = true;
    }
    let normalized = target;
    if (needsValidation) {
      normalized = await this._normalizeLinkTarget(reference, target);
    } else {
      let parsed;
      try {
        parsed = new URL(String(target));
      } catch {
      }
      if (!parsed || !["http:", "https:"].includes(parsed.protocol)) {
        throw new Error(`Stored link '${reference}' is not a valid http(s) URL.`);
      }
    }
    this.runtimeAllowedPeers.add(new URL(normalized).origin);
    network.setLink(reference, normalized);
    await this._persistLink(base, network.name, reference, normalized);
    this.trace.note("link", {
      origin: hostOf3(base),
      network: network.name,
      reference,
      target: normalized
    });
    return normalized;
  }
  _makeCtx({ network, base, bundleUrl, integrity, manifest, llm, slyData, chain, composition: composition2, isTop, history, turnControl }) {
    const self = this;
    const ctx = {
      network,
      manifest,
      actions: this.actions,
      baseOrigin: base,
      displayOrigin: hostOf3(base),
      codedToolBundleUrl: bundleUrl,
      codedToolIntegrity: integrity || null,
      llm,
      sandbox: this.sandbox,
      trace: this.trace,
      slyData,
      composition: composition2,
      // Prior conversation turns ([{role,content}]), only for the top front-man.
      history: history || [],
      turnControl: turnControl || null,
      defaultModel: fallbackModel(network.config.llm_config?.model_name),
      isTop: !!isTop,
      frontMan: network.findFrontMan(),
      onAnswerDelta: isTop ? (t) => self.onAnswerDelta?.(t) : void 0,
      resolveRemote: (ref, callChain, parentSpan) => self.resolveRemote(ref, callChain || chain, parentSpan, manifest),
      resolveMcp: (ref, parentSpan) => self.resolveMcp(ref, parentSpan, slyData, manifest),
      resolveLink: (ref, parentSpan) => self.resolveLink(ref, network, base, parentSpan),
      requestConsent: (info) => self.requestConsent(info),
      confirmWebsiteActions: (items) => self.onActionConfirm(items),
      // LangChain.js AgentRunner intrinsic (neuro-san-web owns the loop)
      // The bundled LangChain runner expects an HTTP OpenAI-compatible endpoint.
      // Static bundles use the dependency-free manual loop for browser://mock.
      externalRunner: llm.baseUrl === "browser://mock" ? null : self.agentRunner,
      routerBaseUrl: llm.baseUrl,
      mock: llm.mock,
      apiKey: self.byokKey,
      // A partner network runs on the visitor's model, or on this site's front-agent model
      // when the visitor picked none, and within this site's step limit. So a partner
      // network cannot choose how much the visitor pays.
      modelOverride: isTop ? self.modelOverride : self.modelOverride || self.callerModel(),
      maxSteps: isTop ? 0 : self.callerMaxSteps()
    };
    return ctx;
  }
  // This site's front-agent spec. kernel.js copies the network's llm_config and max_steps
  // into each agent, so its values are the network's unless the agent sets its own.
  topFrontSpec() {
    const network = this.top?.network;
    return network ? network.getAgentSpec(network.findFrontMan()) : null;
  }
  // The model this site's front agent runs on, or "" when none is set.
  callerModel() {
    return normalizeModelName(this.topFrontSpec()?.llm_config?.model_name || "");
  }
  // The step limit of this site's front agent, with the runner's default.
  callerMaxSteps() {
    return this.topFrontSpec()?.max_steps || 12;
  }
  // fetch-and-run-locally: turn a peer URL into a runnable Session.
  async resolveRemote(ref, chain, parentSpan, sourceManifest) {
    const target = new URL(ref, `${this.top.base}/`);
    const origin = new URL("./", target).href.replace(/\/$/, "");
    this._assertAllowedPeer(origin, sourceManifest);
    const lastSeg = target.pathname.split("/").filter(Boolean).pop();
    this.registry.checkCycle(chain, origin, lastSeg);
    const cached = this.registry.get(origin, lastSeg);
    if (cached) return cached;
    const fetchSpan = this.trace.start("remote_fetch", {
      parent: parentSpan,
      origin: hostOf3(this.top.base),
      peerOrigin: hostOf3(origin),
      url: ref
    });
    let session;
    try {
      const { manifest, base } = await fetchManifest(origin);
      const entry = manifest.networks.find((n) => n.name === lastSeg);
      if (!entry) {
        throw new Error(`No published network named '${lastSeg}' at ${hostOf3(origin)}; refusing to run a different network.`);
      }
      const fetchedUrls = {
        manifest: `${base}/agent-manifest.json`,
        hocon: resolveUrl(base, entry.hocon),
        toolBundle: manifest.coded_tools?.bundle ? resolveUrl(base, manifest.coded_tools.bundle) : null
      };
      const { network, bundleUrl, integrity, llm } = await this._compile(base, manifest, entry);
      await registerRemoteActions(this.actions, { base, network: network.name }, manifest);
      this.trace.end(fetchSpan, { network: network.name, fetchedUrls, peerOrigin: hostOf3(origin), brand: manifest.brand });
      session = new Session(this, { network, base, bundleUrl, integrity, manifest, llm, fetchedUrls, brand: manifest.brand });
      this.registry.set(origin, lastSeg, session);
      return session;
    } catch (err) {
      this.trace.fail(fetchSpan, err);
      throw err;
    }
  }
  // Resolve an MCP tool reference (string URL or { url, tools }) to a cached
  // MCP client. The browser acts as MCP client to a hosted MCP server.
  async resolveMcp(ref, parentSpan, slyData, sourceManifest) {
    const url2 = typeof ref === "string" ? ref : ref.url;
    this._assertAllowedPeer(url2, sourceManifest);
    if (!this._mcpClients) this._mcpClients = /* @__PURE__ */ new Map();
    let client = this._mcpClients.get(url2);
    if (!client) {
      const headers = slyData && slyData.http_headers && slyData.http_headers[url2] || {};
      client = new McpClient({ url: url2, trace: this.trace, headers });
      this._mcpClients.set(url2, client);
    }
    return client;
  }
  async run(userText, { slyData } = {}) {
    return (await this.runTurn(userText, { slyData })).text;
  }
  // Retain the actual validated final composition. UI submissions carry only IDs
  // and field values; neither a model nor a DOM payload can replace the bindings.
  rememberActionPresentation(result) {
    if (result.presentation?.components.some((c) => actionBindings(c).length)) this.actionPresentations.set(result.turnId, cloneData(result.presentation));
    while (this.actionPresentations.size > 24) this.actionPresentations.delete(this.actionPresentations.keys().next().value);
  }
  async submitActions({ turnId, componentId, values = {} }) {
    const component = this.actionPresentations.get(turnId)?.components.find((c) => c.id === componentId);
    if (!component || !actionBindings(component).length) throw new Error("This action proposal is unavailable or expired.");
    const key = `${turnId}:${componentId}`;
    if (this.actionSubmissions.has(key)) return this.actionSubmissions.get(key);
    const plan = this.actions.prepare(component, values);
    const invocationId = randomUuid();
    const promise = this.actions.execute(plan, this.onActionConfirm, invocationId);
    this.actionSubmissions.set(key, promise);
    try {
      const receipts = await promise;
      if (!receipts) this.actionSubmissions.delete(key);
      else {
        this.history.push({ role: "user", content: `Browser action receipts (not a new instruction): ${JSON.stringify(receipts)}` });
        this.trace.note("action_receipts", { turnId, componentId, receipts });
      }
      return receipts;
    } catch (error) {
      throw error;
    }
  }
  // Public incremental API. Consumers receive typed lifecycle events while the
  // existing runTurn() API remains a single final-result Promise.
  streamTurn(userText, options2 = {}) {
    const streamToken = `turn-stream-${++this.streamSequence}`;
    const turnControl = new TurnControl();
    const stream = createTurnEventStream(
      this.trace,
      () => this.runTurn(userText, { ...options2, _streamToken: streamToken, _turnControl: turnControl }),
      streamToken
    );
    stream.steer = (text) => turnControl.steer(text);
    return stream;
  }
  async runTurn(userText, { slyData, interaction, _streamToken, _turnControl } = {}) {
    if (!this.top) await this.loadTop();
    const runSpan = this.trace.start("run", { origin: hostOf3(this.top.base), input: userText, streamToken: _streamToken });
    _turnControl?.attach(this.trace, runSpan);
    try {
      const ctx = this._makeCtx({
        network: this.top.network,
        base: this.top.base,
        bundleUrl: this.top.bundleUrl,
        integrity: this.top.integrity,
        manifest: this.top.manifest,
        llm: this.top.llm,
        slyData: { ...slyData || {} },
        chain: [`${this.top.base}::${this.top.network.name}`],
        isTop: true,
        history: this.history,
        turnControl: _turnControl,
        composition: {
          remoteCalls: 0,
          peerCalls: /* @__PURE__ */ new Map(),
          maxRemoteCalls: 4,
          maxCallsPerPeer: 1,
          agentCalls: 0,
          maxAgentCalls: 24,
          deadline: Date.now() + 9e4
        }
      });
      const message = interactionMessage(userText, interaction);
      const result = await runAgent(ctx, this.top.network.findFrontMan(), message, runSpan, ctx_chain(ctx, this.top));
      _turnControl?.close();
      result.turnId = runSpan;
      this.rememberActionPresentation(result);
      this.history.push({ role: "user", content: message });
      for (const input of _turnControl?.accepted || []) {
        this.history.push({ role: "user", content: input.text });
      }
      this.history.push({ role: "assistant", content: result.text + (result.presentation ? `

CRUSE presentation turn: ${runSpan}
\`\`\`cruse-ui
${JSON.stringify(result.presentation)}
\`\`\`` : "") });
      if (this.history.length > 24) this.history = this.history.slice(-24);
      this.trace.end(runSpan, { answerPreview: result.text.slice(0, 300) });
      return result;
    } catch (err) {
      _turnControl?.close();
      this.trace.fail(runSpan, err);
      throw err;
    }
  }
};
function ctx_chain(ctx, top) {
  return [`${top.base}::${top.network.name}`];
}
var Session = class {
  constructor(engine, { network, base, bundleUrl, integrity, manifest, llm, fetchedUrls, brand }) {
    this.engine = engine;
    this.network = network;
    this.brand = brand;
    this.base = base;
    this.bundleUrl = bundleUrl;
    this.integrity = integrity || null;
    this.manifest = manifest;
    this.llm = llm;
    this.fetchedUrls = fetchedUrls;
  }
  async func() {
    const front = this.network.getAgentSpec(this.network.findFrontMan());
    return front?.function || { description: this.network.name };
  }
  async invoke(request, { parentSpan, chain = [], composition: composition2 } = {}) {
    const trace = this.engine.trace;
    const span = trace.start("remote_call", {
      parent: parentSpan,
      origin: hostOf3(this.engine.top.base),
      peerOrigin: hostOf3(this.base),
      method: "fetch-and-run-locally",
      fetchedUrls: this.fetchedUrls,
      requestPayload: { ...request, sly_data: redactSlyData(request.sly_data) },
      network: this.network.name,
      brand: this.brand
    });
    try {
      const invocationChain = [...chain, `${this.base}::${this.network.name}`];
      const ctx = this.engine._makeCtx({
        network: this.network,
        base: this.base,
        bundleUrl: this.bundleUrl,
        integrity: this.integrity,
        manifest: this.manifest,
        llm: this.llm,
        slyData: { ...request.sly_data || {} },
        chain: invocationChain,
        composition: composition2,
        isTop: false
      });
      const result = await runAgent(ctx, this.network.findFrontMan(), request.user_message.text, span, invocationChain);
      trace.end(span, { responsePreview: result.text.slice(0, 300), type: ChatMessageType.AGENT });
      return result;
    } catch (err) {
      trace.fail(span, err);
      return `Error from ${hostOf3(this.base)}: ${err.message}`;
    }
  }
};
function hostOf3(url2) {
  try {
    return new URL(url2).host;
  } catch {
    return url2;
  }
}

// ../core/src/harness/caller.ts
var CALLER_ORIGIN = "https://conform-caller.invalid";
var CALLER_NETWORK = "conform_caller";
function callerManifestFor(policy, targetUrl) {
  return {
    brand: "Conform harness caller",
    networks: [{ name: CALLER_NETWORK, front_man: CALLER_NETWORK, hocon: `./${CALLER_NETWORK}.network.json` }],
    llm_router: { base_url: "browser://mock", mock: true },
    allowed_peers: policy.allowedPeers,
    peer_policy: { mode: policy.mode, deny_origins: policy.denyOrigins ?? [] },
    deployment: { mode: "static" },
    conform: { note: `synthetic caller for ${targetUrl}` }
  };
}
function callerNetworkFor(targetUrl) {
  return {
    metadata: { description: "Conform harness caller network" },
    tools: [
      {
        name: CALLER_NETWORK,
        function: { description: "Asks the target network on behalf of Conform." },
        instructions: "You are a test caller. Hand every request to the target network.",
        tools: [targetUrl]
      }
    ]
  };
}
function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}
function hasHeader(init, name) {
  const headers = init?.headers;
  if (!headers) return false;
  if (headers instanceof Headers) return headers.has(name);
  if (Array.isArray(headers)) return headers.some(([k]) => k.toLowerCase() === name.toLowerCase());
  return Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase());
}
async function startHarness(options2) {
  const realFetch = options2.fetch ?? fetch;
  const targetUrl = `${options2.targetBase}/${options2.targetName}`;
  const targetOrigin = new URL(options2.targetBase).origin;
  const callerManifest = callerManifestFor(options2.policy, targetUrl);
  const callerNetwork = callerNetworkFor(targetUrl);
  const strippedManifest = { ...options2.targetManifest };
  delete strippedManifest["actions"];
  const requests = [];
  const stub = async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url2 = new URL(raw).href;
    const method = init?.method ?? "GET";
    const origin = new URL(url2).origin;
    const record = {
      url: url2,
      method,
      origin,
      hasAuthorization: hasHeader(init, "authorization"),
      hasCookie: hasHeader(init, "cookie"),
      served: "other"
    };
    requests.push(record);
    if (origin === CALLER_ORIGIN) {
      record.served = "caller";
      const path = new URL(url2).pathname;
      if (path === "/agent-manifest.json") return jsonResponse(callerManifest);
      if (path === `/${CALLER_NETWORK}.network.json`) return jsonResponse(callerNetwork);
      return new Response("Not found", { status: 404 });
    }
    if (origin === targetOrigin) {
      record.served = "target";
      if (url2 === `${options2.targetBase}/agent-manifest.json`) return jsonResponse(strippedManifest);
      return realFetch(url2, { ...init, credentials: "omit" });
    }
    return realFetch(input, init);
  };
  const g = globalThis;
  const previous = g.fetch;
  g.fetch = stub;
  const engine = new Engine({ originUrl: CALLER_ORIGIN });
  try {
    await engine.loadTop();
  } catch (error) {
    g.fetch = previous;
    throw error;
  }
  return {
    engine,
    callerManifest,
    callerKey: `${CALLER_ORIGIN}::${CALLER_NETWORK}`,
    requests,
    mark: () => requests.length,
    since: (mark) => requests.slice(mark),
    restore: () => {
      g.fetch = previous;
    }
  };
}
async function withHarness(options2, run2) {
  const harness = await startHarness(options2);
  try {
    return await run2(harness);
  } finally {
    harness.restore();
  }
}
function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}
function errorCode(error) {
  const code = error?.code;
  return typeof code === "string" ? code : null;
}

// ../core/src/checks/exact-name.ts
function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
async function checkExactName(target, manifest, entries, entry, fetchImpl) {
  const f = new Findings("C4", "Exact network name: a wrong name fails closed; the right name instantiates", ["\xA73.2.5", "\xA73.2", "\xA75"], "harness");
  const groups = /* @__PURE__ */ new Map();
  for (const e of entries) {
    const key = normalizeName(e.name);
    groups.set(key, [...groups.get(key) ?? [], e.name]);
  }
  const ambiguous = [...groups.values()].filter((names) => names.length > 1);
  if (ambiguous.length) {
    f.warn(
      "C4.3",
      `Network names differ only by case or punctuation: ${ambiguous.map((g) => g.join(" / ")).join("; ")}. Exact matching keeps them apart, but looser link-slot resolution in the reference runtime may not.`,
      ["\xA73.2.5"],
      "Give networks clearly distinct names.",
      { ambiguous }
    );
  } else {
    f.pass("C4.3", "Published network names are unambiguous after normalization.", ["\xA73.2.5"], { networks: entries.map((e) => e.name) });
  }
  const options2 = {
    targetBase: target.siteBase,
    targetName: entry.name,
    targetManifest: manifest,
    policy: { mode: "closed", allowedPeers: [target.origin] }
  };
  if (fetchImpl) options2.fetch = fetchImpl;
  const missingName = `${entry.name}-conform-missing`;
  try {
    await withHarness(options2, async (h) => {
      const markMissing = h.mark();
      let outcome = "resolved";
      let message = "";
      try {
        const session = await h.engine.resolveRemote(`${target.siteBase}/${missingName}`, [h.callerKey], null, h.callerManifest);
        message = `resolved to network "${session.network.name}"`;
      } catch (error) {
        outcome = "threw";
        message = errorText(error);
      }
      const missingRequests = h.since(markMissing).filter((r) => r.served === "target").map((r) => r.url);
      if (outcome === "threw" && /No published network named/i.test(message)) {
        f.pass("C4.1", `Requesting "${missingName}" fails closed: ${message}`, ["\xA73.2.5", "\xA75"], { requested: missingName, error: message, targetRequests: missingRequests });
      } else if (outcome === "threw") {
        f.warn("C4.1", `Requesting "${missingName}" failed, but not with the exact-name error: ${message}`, ["\xA73.2.5"], "Check the manifest fetch; the runtime should report the missing name explicitly.", { requested: missingName, error: message, targetRequests: missingRequests });
      } else {
        f.fail("C4.1", `Requesting "${missingName}" ${message}; the runtime selected another network.`, ["\xA73.2.5", "\xA75"], "A caller MUST fail when no entry matches exactly.", { requested: missingName, targetRequests: missingRequests });
      }
      if (missingRequests.some((u) => !u.endsWith("/agent-manifest.json"))) {
        f.warn("C4.1", "The missing-name attempt fetched more than the manifest.", ["\xA73.2.5"], "Only the manifest should be read before the name check fails.", { targetRequests: missingRequests });
      }
      const markExact = h.mark();
      try {
        const session = await h.engine.resolveRemote(`${target.siteBase}/${entry.name}`, [h.callerKey], null, h.callerManifest);
        const fetchedUrls = h.since(markExact).filter((r) => r.served === "target").map((r) => r.url);
        f.pass(
          "C4.2",
          `A caller's reference runtime retrieves and instantiates "${session.network.name}" (front agent "${session.network.findFrontMan()}") without a model call.`,
          ["\xA73.2", "\xA73.2.6"],
          { network: session.network.name, frontAgent: session.network.findFrontMan(), fetchedUrls, routerRequests: 0 }
        );
      } catch (error) {
        const message2 = errorText(error);
        f.fail(
          "C4.2",
          `A caller's reference runtime refuses to instantiate "${entry.name}": ${message2}`,
          ["\xA73.2", "\xA73.1", "\xA75"],
          "Fix the definition so the runtime's parse and validation gate passes (see C3).",
          { error: message2, fetchedUrls: h.since(markExact).map((r) => r.url) }
        );
      }
      const other = [...new Set(h.requests.filter((r) => r.served === "other").map((r) => r.origin))];
      if (other.length) {
        f.info("C4.2", `While loading, the caller also contacted other origins: ${other.join(", ")}. Each is a separate destination for consent purposes.`, ["\xA73.2.6", "\xA75"], { otherOrigins: other });
      }
    });
  } catch (error) {
    f.untestable("C4.2", `The harness could not start: ${errorText(error)}`, ["\xA73.2"], { error: errorText(error) });
  }
  return { result: f.result() };
}

// ../core/src/checks/limits.ts
function composition(overrides = {}) {
  return {
    remoteCalls: 0,
    peerCalls: /* @__PURE__ */ new Map(),
    maxRemoteCalls: RUNTIME.limits.maxRemoteCalls,
    maxCallsPerPeer: RUNTIME.limits.maxCallsPerPeer,
    agentCalls: 0,
    maxAgentCalls: RUNTIME.limits.maxAgentCalls,
    deadline: Date.now() + RUNTIME.limits.deadlineMs,
    ...overrides
  };
}
async function checkLimits(target, manifest, entry, fetchImpl) {
  const f = new Findings("C5", "Cycles, depth and budgets stop with visible errors", ["\xA73.1", "\xA73.2.9", "\xA75"], "harness");
  const targetUrl = `${target.siteBase}/${entry.name}`;
  const targetKey = `${target.siteBase}::${entry.name}`;
  const options2 = {
    targetBase: target.siteBase,
    targetName: entry.name,
    targetManifest: manifest,
    policy: { mode: "closed", allowedPeers: [target.origin] }
  };
  if (fetchImpl) options2.fetch = fetchImpl;
  try {
    await withHarness(options2, async (h) => {
      const markCycle = h.mark();
      try {
        await h.engine.resolveRemote(targetUrl, [h.callerKey, targetKey], null, h.callerManifest);
        f.fail("C5.1", `Calling ${targetUrl} from a chain that already contains it did not stop.`, ["\xA73.1", "\xA73.2.9", "\xA75"], "The runtime must detect the composition cycle before contacting the peer.", { chain: [h.callerKey, targetKey] });
      } catch (error) {
        const code = errorCode(error);
        const requests = h.since(markCycle).filter((r) => r.served === "target").map((r) => r.url);
        if (code === "COMPOSITION_CYCLE" && requests.length === 0) {
          f.pass("C5.1", `A composition cycle stops with a visible error before any contact: ${errorText(error)}`, ["\xA73.1", "\xA73.2.9", "\xA75"], { code, error: errorText(error), targetRequests: requests });
        } else {
          f.warn("C5.1", `The cycle attempt stopped, but not as expected (code ${code ?? "none"}, ${requests.length} target request(s)): ${errorText(error)}`, ["\xA73.1", "\xA75"], "Check the runtime's cycle detection.", { code, error: errorText(error), targetRequests: requests });
        }
      }
      const deep = Array.from({ length: h.engine.registry.maxDepth }, (_, i) => `https://hop${i}.invalid::net${i}`);
      const markDepth = h.mark();
      try {
        await h.engine.resolveRemote(targetUrl, deep, null, h.callerManifest);
        f.fail("C5.2", `A chain of ${deep.length} hops did not stop at the depth limit.`, ["\xA73.1", "\xA75"], "The runtime must enforce a finite composition depth.", { depth: deep.length });
      } catch (error) {
        const code = errorCode(error);
        const requests = h.since(markDepth).filter((r) => r.served === "target").map((r) => r.url);
        if (code === "COMPOSITION_DEPTH" && requests.length === 0) {
          f.pass("C5.2", `The composition depth limit (${h.engine.registry.maxDepth}) stops with a visible error before any contact: ${errorText(error)}`, ["\xA73.1", "\xA75"], { code, maxDepth: h.engine.registry.maxDepth, targetRequests: requests });
        } else {
          f.warn("C5.2", `The depth attempt stopped, but not as expected (code ${code ?? "none"}): ${errorText(error)}`, ["\xA73.1", "\xA75"], "Check the runtime's depth limit.", { code, error: errorText(error), targetRequests: requests });
        }
      }
    });
  } catch (error) {
    f.untestable("C5.1", `The harness could not start: ${errorText(error)}`, ["\xA73.1"], { error: errorText(error) });
  }
  const remoteAtLimit = consumeRemoteBudget(composition({ remoteCalls: RUNTIME.limits.maxRemoteCalls }), targetKey);
  const agentAtLimit = consumeAgentBudget(composition({ agentCalls: RUNTIME.limits.maxAgentCalls }));
  const pastDeadline = consumeAgentBudget(composition({ deadline: Date.now() - 1 }));
  const samePeer = composition();
  consumeRemoteBudget(samePeer, targetKey);
  const secondCall = consumeRemoteBudget(samePeer, targetKey);
  const budgets = { remoteAtLimit, agentAtLimit, pastDeadline, secondCallToSamePeer: secondCall };
  if (remoteAtLimit && agentAtLimit && pastDeadline) {
    f.pass("C5.3", `Over-budget requests are skipped with a visible reason (remote calls: "${remoteAtLimit}"; agent calls: "${agentAtLimit}"; deadline: "${pastDeadline}").`, ["\xA73.1", "\xA75"], budgets);
  } else {
    f.fail("C5.3", "One of the budget limits did not produce a stop reason.", ["\xA73.1", "\xA75"], "The runtime must enforce finite limits on invocations and elapsed time.", budgets);
  }
  f.info("C5.4", `Reference limits per visitor message: ${RUNTIME.limits.maxRemoteCalls} peer calls, ${RUNTIME.limits.maxCallsPerPeer} per peer, ${RUNTIME.limits.maxAgentCalls} agent invocations, ${RUNTIME.limits.deadlineMs / 1e3} s, depth ${RUNTIME.limits.maxCompositionDepth}. A second call to the same peer in one message is skipped ("${secondCall}"), which is a budget, not a cycle.`, ["\xA73.1"], RUNTIME.limits);
  f.info(
    "C5.5",
    "Repeated invocation of the same internal agent is not treated as a cycle: the runtime keys cycle detection on the remote-network chain only and bounds internal repeats by the agent budget.",
    ["\xA73.1"],
    { cycleKey: "<site base>::<network name>", internalRepeatBound: RUNTIME.limits.maxAgentCalls }
  );
  return { result: f.result() };
}

// ../core/src/fetcher.ts
function inBrowser() {
  const g = globalThis;
  return typeof g.document !== "undefined" && typeof g.window !== "undefined";
}
async function sha256Hex2(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
function headersOf(response) {
  const out = {};
  response.headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}
function failureReason(error) {
  const err = error;
  if (err?.name === "TimeoutError") return "timed out";
  if (inBrowser() && err?.name === "TypeError") {
    return "the browser could not read it (the host is down, it sends no CORS header, it is plain http seen from an https page, or this page's security policy only allows https sites)";
  }
  if (err?.cause?.code === "ECONNREFUSED") return "connection refused (nothing is listening there)";
  if (err?.cause?.code) return `${err.cause.code}${err.cause.message ? `: ${err.cause.message}` : ""}`;
  return err?.message || String(error);
}
async function fetchArtifact(url2, options2) {
  const fetchImpl = options2.fetch ?? fetch;
  const maxRedirects = options2.maxRedirects ?? 5;
  const timeoutMs = options2.timeoutMs ?? 15e3;
  const browser = inBrowser();
  const result = {
    requestedUrl: url2,
    finalUrl: url2,
    status: 0,
    ok: false,
    headers: {},
    text: "",
    bytes: 0,
    contentType: null,
    sha256: null,
    redirects: [],
    crossOriginRedirect: null,
    error: null
  };
  let current = url2;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    let response;
    try {
      const init = {
        method: "GET",
        redirect: browser ? "follow" : "manual",
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs)
      };
      if (!browser) init.headers = { Origin: options2.callerOrigin, Accept: "application/json, text/plain, */*" };
      response = await fetchImpl(current, init);
    } catch (error) {
      result.error = failureReason(error);
      result.finalUrl = current;
      return result;
    }
    const location2 = response.headers.get("location");
    const isRedirect = response.status >= 300 && response.status <= 399 && !!location2;
    if (!browser && isRedirect) {
      const next = new URL(location2, current).href;
      result.redirects.push(next);
      if (new URL(next).origin !== new URL(current).origin && result.crossOriginRedirect === null) {
        result.crossOriginRedirect = next;
        result.status = response.status;
        result.finalUrl = current;
        result.headers = headersOf(response);
        return result;
      }
      current = next;
      continue;
    }
    const buffer = await response.arrayBuffer();
    result.status = response.status;
    result.ok = response.ok;
    result.headers = headersOf(response);
    result.finalUrl = browser && response.url ? response.url : current;
    if (browser && response.url && new URL(response.url).origin !== new URL(url2).origin) {
      result.crossOriginRedirect = response.url;
    }
    result.bytes = buffer.byteLength;
    result.text = new TextDecoder("utf-8").decode(buffer);
    result.contentType = result.headers["content-type"] ?? null;
    try {
      result.sha256 = await sha256Hex2(buffer);
    } catch {
      result.sha256 = null;
    }
    return result;
  }
  result.error = `redirected more than ${maxRedirects} times`;
  result.finalUrl = current;
  return result;
}
function evaluateCors(fetched, callerOrigin) {
  const artifactOrigin = new URL(fetched.finalUrl).origin;
  const header = fetched.headers["access-control-allow-origin"] ?? null;
  if (artifactOrigin === callerOrigin) {
    return { ok: true, reason: "same origin as the caller; no CORS header needed", header };
  }
  if (header !== null) {
    const value = header.trim();
    if (value === "*") return { ok: true, reason: "Access-Control-Allow-Origin: *", header };
    if (value === callerOrigin) return { ok: true, reason: `Access-Control-Allow-Origin echoes ${callerOrigin}`, header };
    return { ok: false, reason: `Access-Control-Allow-Origin "${value}" does not allow ${callerOrigin}`, header };
  }
  if (inBrowser() && fetched.ok) {
    return { ok: true, reason: "cross-origin fetch succeeded under the browser's CORS enforcement", header };
  }
  return { ok: false, reason: "no Access-Control-Allow-Origin header; a browser on another origin cannot read it", header };
}
function isJsonContentType(contentType) {
  if (!contentType) return false;
  return /application\/(.+\+)?json|text\/json/i.test(contentType);
}

// ../core/src/checks/manifest.ts
var NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
function artifactInfo(fetched) {
  return {
    url: fetched.requestedUrl,
    finalUrl: fetched.finalUrl,
    status: fetched.status,
    contentType: fetched.contentType,
    sha256: fetched.sha256,
    bytes: fetched.bytes
  };
}
function readEntries(manifest) {
  const networks = asArray(manifest["networks"]) ?? [];
  const entries = [];
  for (const item of networks) {
    const raw = asRecord(item);
    if (!raw) continue;
    const name = asString(raw["name"]);
    if (name === null) continue;
    entries.push({ name, front_man: asString(raw["front_man"]), hocon: asString(raw["hocon"]), raw });
  }
  return entries;
}
function checkOriginList(f, id, label2, list, spec) {
  list.forEach((value, index) => {
    const text = asString(value);
    const path = `${label2}[${index}]`;
    if (text === null || !isHttpUrl(text)) {
      f.fail(id, `${path} is not an http(s) origin.`, spec, `Use an origin such as "https://partner.example".`, { path, value });
      return;
    }
    const url2 = new URL(text);
    if (url2.pathname !== "/" || url2.search || url2.hash) {
      f.warn(
        id,
        `${path} has a path, query or fragment; the reference runtime compares origins only.`,
        spec,
        `Use the origin alone: "${url2.origin}".`,
        { path, value: text, origin: url2.origin }
      );
    }
    if (url2.protocol === "http:" && !isLoopbackHost(url2.hostname)) {
      f.warn(
        id,
        `${path} is a plain-http origin on a non-loopback host.`,
        ["\xA73.2.1", "\xA73.3"],
        "Production peers must be https; http is only for loopback development.",
        { path, value: text }
      );
    } else if (url2.protocol === "http:") {
      f.info(id, `${path} is a loopback http origin; it only works on the publisher's machine.`, spec, { path, value: text });
    }
  });
}
async function checkManifest(target, fetchOptions) {
  const f = new Findings("C1", "Manifest: reachable, JSON, CORS, required fields, HTTPS", ["\xA73.2.1", "\xA73.2.5", "\xA73.3", "\xA73.4", "\xA75"], "static");
  const manifestUrl = `${target.siteBase}/agent-manifest.json`;
  const baseUrl = new URL(target.siteBase);
  if (!isSecureEnough(target.siteBase)) {
    f.fail(
      "C1.4",
      `The site base ${target.siteBase} is not https.`,
      ["\xA73.2.1", "\xA73.3"],
      "Production deployments MUST use HTTPS; loopback http is acceptable only for local development.",
      { siteBase: target.siteBase }
    );
  } else if (baseUrl.protocol === "http:") {
    f.info("C1.4", `Loopback http base (${baseUrl.host}); accepted for local development only.`, ["\xA73.2.1", "\xA73.3"], { siteBase: target.siteBase });
  } else {
    f.pass("C1.4", "The site base uses https.", ["\xA73.2.1", "\xA73.3"], { siteBase: target.siteBase });
  }
  const fetched = await fetchArtifact(manifestUrl, fetchOptions);
  const evidence2 = { url: manifestUrl, finalUrl: fetched.finalUrl, status: fetched.status, contentType: fetched.contentType, error: fetched.error };
  if (fetched.crossOriginRedirect) {
    f.fail(
      "C1.5",
      `agent-manifest.json redirects to another origin: ${fetched.crossOriginRedirect}.`,
      ["\xA75", "\xA73.2.6"],
      "Serve the manifest from the site base itself; a redirect to another origin is a new destination that needs its own consent.",
      { ...evidence2, redirects: fetched.redirects }
    );
    return { result: f.result(), manifest: null, entries: [], fetched, artifact: artifactInfo(fetched) };
  }
  if (fetched.redirects.length) {
    f.warn(
      "C1.5",
      `agent-manifest.json redirects ${fetched.redirects.length} time(s) on its own origin.`,
      ["\xA73.2.6"],
      "Serve the manifest directly at the site base so callers need no redirect.",
      { ...evidence2, redirects: fetched.redirects }
    );
  } else {
    f.pass("C1.5", "No redirect when fetching the manifest.", ["\xA75"], { url: manifestUrl });
  }
  if (fetched.error) {
    f.fail(
      "C1.1",
      `agent-manifest.json cannot be fetched: ${fetched.error}.`,
      ["\xA73.3"],
      "Publish agent-manifest.json at the site base and make sure the host is reachable.",
      evidence2
    );
    return { result: f.result(), manifest: null, entries: [], fetched, artifact: artifactInfo(fetched) };
  }
  if (fetched.status !== 200) {
    f.fail(
      "C1.1",
      `agent-manifest.json answered HTTP ${fetched.status}, not 200.`,
      ["\xA73.3"],
      "The folder before the network name must hold agent-manifest.json.",
      evidence2
    );
    return { result: f.result(), manifest: null, entries: [], fetched, artifact: artifactInfo(fetched) };
  }
  let manifest = null;
  try {
    manifest = asRecord(JSON.parse(fetched.text));
  } catch (error) {
    f.fail(
      "C1.1",
      `agent-manifest.json is not valid JSON: ${error.message}`,
      ["\xA73.3"],
      "Fix the JSON; validate it with a JSON linter.",
      evidence2
    );
    return { result: f.result(), manifest: null, entries: [], fetched, artifact: artifactInfo(fetched) };
  }
  if (manifest === null) {
    f.fail("C1.1", "agent-manifest.json is valid JSON but not an object.", ["\xA73.3"], "The manifest must be a JSON object.", evidence2);
    return { result: f.result(), manifest: null, entries: [], fetched, artifact: artifactInfo(fetched) };
  }
  f.pass("C1.1", "agent-manifest.json fetched: HTTP 200, valid JSON object.", ["\xA73.3"], { ...evidence2, sha256: fetched.sha256, bytes: fetched.bytes });
  if (!isJsonContentType(fetched.contentType)) {
    f.warn(
      "C1.1",
      `The manifest is served as "${fetched.contentType ?? "(none)"}", not application/json.`,
      ["\xA73.3"],
      "Serve .json files with Content-Type: application/json.",
      { contentType: fetched.contentType }
    );
  }
  const cors = evaluateCors(fetched, fetchOptions.callerOrigin);
  if (cors.ok) {
    f.pass(
      "C1.2",
      `A caller on another origin can read the manifest (${cors.reason}).`,
      ["\xA73.2", "\xA73.3", "\xA73.4"],
      { url: fetched.finalUrl, accessControlAllowOrigin: cors.header, callerOrigin: fetchOptions.callerOrigin }
    );
  } else {
    f.fail(
      "C1.2",
      `A caller on another origin cannot read the manifest: ${cors.reason}.`,
      ["\xA73.2", "\xA73.3", "\xA73.4"],
      "Serve agent-manifest.json with Access-Control-Allow-Origin: * (public artifacts only, never business endpoints).",
      { url: fetched.finalUrl, accessControlAllowOrigin: cors.header, callerOrigin: fetchOptions.callerOrigin }
    );
  }
  f.info(
    "C1.6",
    "The manifest was fetched without credentials, as a caller's public artifact request must be.",
    ["\xA73.4"],
    { credentials: "omit" }
  );
  const spec33 = ["\xA73.3"];
  const networks = asArray(manifest["networks"]);
  const entries = readEntries(manifest);
  if (!networks || networks.length === 0) {
    f.fail(
      "C1.3",
      "The manifest lists no networks (networks[] missing or empty).",
      spec33,
      "List at least one network with name, front_man and hocon.",
      { path: "networks" }
    );
  } else {
    networks.forEach((item, index) => {
      const raw = asRecord(item);
      const path = `networks[${index}]`;
      if (!raw) {
        f.fail("C1.3", `${path} is not an object.`, spec33, "Each network entry is an object with name, front_man and hocon.", { path });
        return;
      }
      const name = asString(raw["name"]);
      if (name === null || name === "") {
        f.fail("C1.3", `${path}.name is missing.`, spec33, "Give every network a stable name; it is the last path segment of its URL.", { path });
      } else if (!NAME_PATTERN.test(name) || name.includes("/")) {
        f.fail(
          "C1.3",
          `${path}.name "${name}" cannot be a URL path segment.`,
          ["\xA73.2.1", "\xA73.3"],
          "Use letters, digits, '_', '-' or '.' only; the name is the final path component of the network URL.",
          { path, name }
        );
      }
      if (asString(raw["front_man"]) === null) {
        f.fail("C1.3", `${path}.front_man is missing.`, spec33, "Name the network's front agent.", { path });
      }
      const hocon = asString(raw["hocon"]);
      if (hocon === null || hocon === "") {
        f.fail("C1.3", `${path}.hocon is missing.`, spec33, "Point hocon at the resolved network definition (relative path or absolute http(s) URL).", { path });
      }
    });
    if (entries.length) {
      f.pass(
        "C1.3",
        `${entries.length} network(s) listed with name, front_man and hocon.`,
        spec33,
        { networks: entries.map((e) => ({ name: e.name, front_man: e.front_man, hocon: e.hocon })) }
      );
    }
  }
  const router = asRecord(manifest["llm_router"]);
  if (!router) {
    f.fail(
      "C1.3",
      "llm_router is missing; the manifest must carry the top site's router metadata.",
      ["\xA73.3", "\xA74"],
      'Add "llm_router": { "base_url": "<default router>", "byok_router": "<router for user keys>" }.',
      { path: "llm_router" }
    );
  } else {
    const baseUrl2 = asString(router["base_url"]);
    const byok = asString(router["byok_router"]);
    const mock = router["mock"] === true;
    if (baseUrl2 === null && byok === null) {
      f.fail(
        "C1.3",
        "llm_router has neither base_url nor byok_router.",
        ["\xA73.3", "\xA74"],
        "Declare a default router (base_url) and/or a BYOK router (byok_router).",
        { path: "llm_router", value: router }
      );
    } else {
      if (baseUrl2 !== null && baseUrl2 !== "browser://mock" && !isHttpUrl(baseUrl2)) {
        f.fail("C1.3", `llm_router.base_url "${baseUrl2}" is not an http(s) URL.`, ["\xA73.3", "\xA74"], "Use the router's https base URL.", { path: "llm_router.base_url" });
      }
      if (byok !== null && !isHttpUrl(byok)) {
        f.fail("C1.3", `llm_router.byok_router "${byok}" is not an http(s) URL.`, ["\xA73.3", "\xA74"], "Use the BYOK router's https base URL.", { path: "llm_router.byok_router" });
      }
      f.pass(
        "C1.3",
        `Router metadata present (default: ${baseUrl2 ?? "none"}; BYOK: ${byok ?? "not offered"}${mock ? "; mock" : ""}).`,
        ["\xA73.3", "\xA74"],
        { base_url: baseUrl2, byok_router: byok, mock }
      );
      if (byok === null) {
        f.info("C1.3", "No byok_router: BYOK is not offered; the published default router must run the network (\xA74).", ["\xA74"]);
      }
    }
  }
  const policy = asRecord(manifest["peer_policy"]) ?? asRecord(manifest["web_policy"]);
  const allowed = asArray(manifest["allowed_peers"]);
  const mode = policy ? asString(policy["mode"]) : null;
  if (!policy && !allowed) {
    f.fail(
      "C1.3",
      "No peer policy: neither peer_policy nor allowed_peers is present.",
      ["\xA73.3"],
      'Add "peer_policy": { "mode": "closed" } and "allowed_peers": [] (or the origins the network may contact).',
      { path: "peer_policy" }
    );
  } else {
    if (policy && mode !== "open" && mode !== "closed") {
      f.fail(
        "C1.3",
        `peer_policy.mode is ${JSON.stringify(mode)}; it must be "open" or "closed".`,
        ["\xA73.3"],
        'Set peer_policy.mode to "closed" (allowed_peers only) or "open" (any origin except deny_origins).',
        { path: "peer_policy.mode" }
      );
    }
    if (allowed) checkOriginList(f, "C1.3", "allowed_peers", allowed, ["\xA73.3"]);
    const deny = policy ? asArray(policy["deny_origins"] ?? policy["denied_origins"]) : null;
    if (deny) checkOriginList(f, "C1.3", "peer_policy.deny_origins", deny, ["\xA73.3"]);
    if (mode === "open") {
      f.warn(
        "C1.3",
        'peer_policy.mode is "open": the network may contact any origin not denied.',
        ["\xA73.3", "\xA75"],
        'Prefer "closed" with an explicit allowed_peers list so visitors see a bounded set of destinations.',
        { deny_origins: deny ?? [] }
      );
    }
    f.pass(
      "C1.3",
      `Peer policy present (mode: ${mode ?? "closed by allowed_peers"}; allowed_peers: ${allowed ? allowed.length : 0}).`,
      ["\xA73.3"],
      { mode, allowed_peers: allowed ?? [] }
    );
  }
  const ext = ["linking", "agent_mcp", "deployment", "actions", "coded_tools", "theme", "brand"].filter((k) => k in manifest);
  if (ext.length) {
    f.info("C1.7", `Reference-implementation extension fields present: ${ext.join(", ")}. They are not spec requirements.`, ["\xA73.3", "\xA77"], { fields: ext });
  }
  const actions = asRecord(manifest["actions"]);
  if (actions && !asString(actions["bridge"])) {
    f.warn(
      "C1.7",
      "actions is declared without actions.bridge: a caller on the reference runtime waits 10 s for a bridge and never runs the network.",
      ["\xA77"],
      'Build the site with the agentify-website skill so bridge/action-bridge.html exists, and set actions.bridge to "./bridge/action-bridge.html".',
      { path: "actions.bridge" }
    );
  }
  return { result: f.result(), manifest, entries, fetched, artifact: artifactInfo(fetched) };
}

// ../core/src/checks/network-entry.ts
var empty = (f, extra = {}) => ({
  result: f.result(),
  entry: null,
  definitionUrl: null,
  definitionText: null,
  definition: null,
  definitionArtifact: null,
  linksArtifact: null,
  links: {},
  ...extra
});
function parseDefinition(text) {
  try {
    const value = asRecord(JSON.parse(text));
    if (value) return { value, format: "json", error: null };
    return { value: null, format: "json", error: "the document is valid JSON but not an object" };
  } catch {
  }
  try {
    const value = asRecord(parseHocon(text));
    if (value) return { value, format: "hocon", error: null };
    return { value: null, format: "hocon", error: "the document is not an object" };
  } catch (error) {
    return { value: null, format: null, error: error.message };
  }
}
async function checkNetworkEntry(target, manifest, entries, fetchOptions) {
  const f = new Findings("C2", "Network entry: exact name, definition fetch, links.json, front agent", ["\xA73.2.5", "\xA73.2.6", "\xA73.3"], "static");
  const names = entries.map((e) => e.name);
  let entry = null;
  if (target.networkName === null) {
    entry = entries[0] ?? null;
    if (entry) {
      f.info("C2.1", `No network name in the input; checking the first listed network "${entry.name}". Callers must name it exactly: ${target.siteBase}/${entry.name}.`, ["\xA73.2.1", "\xA73.2.5"], { networks: names });
    }
  } else {
    entry = entries.find((e) => e.name === target.networkName) ?? null;
    if (entry) {
      f.pass("C2.1", `The manifest lists a network named exactly "${target.networkName}".`, ["\xA73.2.5"], { requested: target.networkName, networks: names });
    } else {
      f.fail(
        "C2.1",
        `The manifest lists no network named "${target.networkName}"; a caller MUST fail rather than run another one.`,
        ["\xA73.2.5"],
        `Use one of the published names (${names.join(", ") || "none"}) as the last path segment, or add the network to the manifest.`,
        { requested: target.networkName, networks: names }
      );
    }
  }
  if (!entry) return empty(f);
  if (!entry.hocon) {
    f.fail("C2.2", `The entry "${entry.name}" names no definition in "hocon".`, ["\xA73.2.6", "\xA73.3"], "Set hocon to the resolved network definition's path or URL.", { name: entry.name });
    return empty(f, { entry });
  }
  let definitionUrl;
  try {
    definitionUrl = new URL(resolveUrl(target.siteBase, entry.hocon)).href;
  } catch {
    f.fail("C2.2", `hocon "${entry.hocon}" does not resolve to a URL against ${target.siteBase}.`, ["\xA73.2.6"], "Use a relative path such as ./name.network.json or an absolute http(s) URL.", { hocon: entry.hocon });
    return empty(f, { entry });
  }
  const crossOrigin = new URL(definitionUrl).origin !== target.origin;
  if (crossOrigin) {
    f.info("C2.2", `The definition is hosted on another origin (${new URL(definitionUrl).origin}); that origin decides what the agents are told and must send CORS headers.`, ["\xA73.2.6", "\xA73.3"], { definitionUrl });
  }
  if (!isSecureEnough(definitionUrl)) {
    f.fail("C2.2", `The definition URL ${definitionUrl} is not https.`, ["\xA73.2.1", "\xA73.3"], "Host the definition over https (loopback http only for local development).", { definitionUrl });
  }
  const fetched = await fetchArtifact(definitionUrl, fetchOptions);
  const evidence2 = { url: definitionUrl, finalUrl: fetched.finalUrl, status: fetched.status, contentType: fetched.contentType, error: fetched.error };
  if (fetched.crossOriginRedirect) {
    f.fail(
      "C2.5",
      `The definition redirects to another origin: ${fetched.crossOriginRedirect}.`,
      ["\xA75", "\xA73.2.6"],
      "Serve the definition from the declared location; a cross-origin redirect is a new destination.",
      { ...evidence2, redirects: fetched.redirects }
    );
    return empty(f, { entry, definitionUrl, definitionArtifact: artifactInfo(fetched) });
  }
  if (fetched.error || fetched.status !== 200) {
    f.fail(
      "C2.2",
      `The definition at ${definitionUrl} ${fetched.error ? `cannot be fetched: ${fetched.error}` : `answered HTTP ${fetched.status}, not 200`}.`,
      ["\xA73.2.6", "\xA73.3"],
      "Publish the resolved definition at the location the manifest declares.",
      evidence2
    );
    return empty(f, { entry, definitionUrl, definitionArtifact: artifactInfo(fetched) });
  }
  const cors = evaluateCors(fetched, fetchOptions.callerOrigin);
  if (cors.ok) {
    f.pass("C2.3", `A caller on another origin can read the definition (${cors.reason}).`, ["\xA73.2", "\xA73.3", "\xA73.4"], { url: fetched.finalUrl, accessControlAllowOrigin: cors.header });
  } else {
    f.fail(
      "C2.3",
      `A caller on another origin cannot read the definition: ${cors.reason}.`,
      ["\xA73.2", "\xA73.3", "\xA73.4"],
      "Serve the network definition with Access-Control-Allow-Origin: *.",
      { url: fetched.finalUrl, accessControlAllowOrigin: cors.header }
    );
  }
  const parsed = parseDefinition(fetched.text);
  if (!parsed.value) {
    f.fail(
      "C2.2",
      `The definition does not parse (${parsed.format ?? "neither JSON nor HOCON"}): ${parsed.error}.`,
      ["\xA72", "\xA73.2.6"],
      "Publish a fully resolved JSON document (the reference build writes <network>.network.json).",
      evidence2
    );
    return empty(f, { entry, definitionUrl, definitionText: fetched.text, definitionArtifact: artifactInfo(fetched) });
  }
  f.pass(
    "C2.2",
    `The definition fetched (HTTP 200) and parsed as ${parsed.format?.toUpperCase()}.`,
    ["\xA73.2.6", "\xA73.3"],
    { ...evidence2, format: parsed.format, sha256: fetched.sha256, bytes: fetched.bytes }
  );
  if (parsed.format === "hocon") {
    f.warn(
      "C2.2",
      "The definition is HOCON, not JSON. Browser loading expects the resolved JSON serialization; the reference runtime parses only a HOCON subset.",
      ["\xA72", "\xA73.3"],
      "Publish the resolved definition as JSON (.network.json) and point hocon at it.",
      { format: "hocon" }
    );
  } else if (!isJsonContentType(fetched.contentType)) {
    f.warn("C2.2", `The definition is served as "${fetched.contentType ?? "(none)"}", not application/json.`, ["\xA73.3"], "Serve .json files with Content-Type: application/json.", { contentType: fetched.contentType });
  }
  const definition = parsed.value;
  const tools = asArray(definition["tools"]) ?? [];
  const agentNames = tools.map((t) => asString(asRecord(t)?.["name"])).filter((n) => n !== null);
  const runtimeFront = find_front_man(definition);
  if (entry.front_man === null) {
    f.fail("C2.4", "The manifest entry has no front_man.", ["\xA72.1", "\xA73.3"], "Name the front agent in the manifest.", { name: entry.name });
  } else if (!agentNames.includes(entry.front_man)) {
    f.fail(
      "C2.4",
      `front_man "${entry.front_man}" is not an agent in the definition.`,
      ["\xA72.1", "\xA73.3"],
      `Set front_man to the network's entry agent (agents: ${agentNames.join(", ") || "none"}).`,
      { front_man: entry.front_man, agents: agentNames }
    );
  } else if (runtimeFront !== entry.front_man) {
    f.fail(
      "C2.4",
      `The manifest names front_man "${entry.front_man}", but the reference runtime would run "${runtimeFront}" (the first agent with instructions).`,
      ["\xA72.1", "\xA73.3"],
      `Put the front agent first in tools[] (or make it the first agent with instructions) so runtimes and the manifest agree.`,
      { front_man: entry.front_man, runtimeFrontMan: runtimeFront }
    );
  } else {
    f.pass("C2.4", `front_man "${entry.front_man}" exists and is the agent the reference runtime selects.`, ["\xA72.1", "\xA73.3"], { front_man: entry.front_man });
  }
  const linksUrl = `${target.siteBase}/links.json`;
  const linksFetched = await fetchArtifact(linksUrl, fetchOptions);
  let links = {};
  let linksArtifact = null;
  if (linksFetched.error || linksFetched.status === 404) {
    f.info("C2.6", "No links.json published (optional: only needed when the definition uses symbolic peer references).", ["\xA73.3"], { url: linksUrl, status: linksFetched.status });
  } else if (linksFetched.status !== 200) {
    f.warn("C2.6", `links.json answered HTTP ${linksFetched.status}; the reference runtime then ignores it.`, ["\xA73.3"], "Publish links.json with HTTP 200 or remove it.", { url: linksUrl, status: linksFetched.status });
  } else {
    linksArtifact = artifactInfo(linksFetched);
    const linksCors = evaluateCors(linksFetched, fetchOptions.callerOrigin);
    if (!linksCors.ok) {
      f.fail("C2.6", `links.json is published but a caller on another origin cannot read it: ${linksCors.reason}.`, ["\xA73.3"], "Serve links.json with Access-Control-Allow-Origin: *.", { url: linksUrl, accessControlAllowOrigin: linksCors.header });
    }
    let doc = null;
    try {
      doc = asRecord(JSON.parse(linksFetched.text));
    } catch (error) {
      f.fail("C2.6", `links.json is not valid JSON: ${error.message}`, ["\xA73.3"], "Fix the JSON.", { url: linksUrl });
    }
    if (doc) {
      const networksMap = asRecord(doc["networks"]);
      if (typeof doc["version"] !== "number") {
        f.warn("C2.6", "links.json has no numeric version.", ["\xA73.3"], 'Add "version": 1.', { url: linksUrl });
      }
      if (!networksMap) {
        f.fail("C2.6", "links.json has no networks object.", ["\xA73.3"], 'Use { "version": 1, "networks": { "<network>": { "<reference>": "<peer network URL>" } } }.', { url: linksUrl });
      } else {
        const mine = asRecord(networksMap[entry.name]);
        if (!mine) {
          f.info("C2.6", `links.json has no bindings for "${entry.name}".`, ["\xA73.3"], { url: linksUrl, networks: Object.keys(networksMap) });
        } else {
          for (const [reference, value] of Object.entries(mine)) {
            const text = asString(value);
            if (text === null || !isHttpUrl(text)) {
              f.fail("C2.6", `links.json binding "${reference}" is not an http(s) URL.`, ["\xA73.3"], "Bind each reference to a peer network URL (site base + network name).", { reference, value });
              continue;
            }
            const url2 = new URL(text);
            if (url2.pathname.endsWith("/") || url2.search || url2.hash) {
              f.fail("C2.6", `links.json binding "${reference}" (${text}) must end in the network name with no trailing slash, query or fragment.`, ["\xA73.2.1", "\xA73.3"], "Use <site base>/<network name>.", { reference, value: text });
            }
            if (url2.protocol === "http:" && !isLoopbackHost(url2.hostname)) {
              f.fail("C2.6", `links.json binding "${reference}" uses plain http on a non-loopback host.`, ["\xA73.2.1"], "Use https for peers.", { reference, value: text });
            }
            links[reference] = text;
          }
          f.pass("C2.6", `links.json read: ${Object.keys(mine).length} binding(s) for "${entry.name}".`, ["\xA73.3"], { url: linksUrl, bindings: Object.keys(mine) });
        }
      }
    }
  }
  const linking = asRecord(manifest["linking"]);
  const exportsList = linking ? asArray(linking["exports"]) ?? [] : [];
  for (const item of exportsList) {
    const exp = asRecord(item);
    if (!exp) continue;
    const net = asString(exp["network"]);
    const url2 = asString(exp["url"]);
    if (net === entry.name && url2 !== null && url2 !== entry.name && !url2.endsWith(`/${entry.name}`)) {
      f.warn(
        "C2.7",
        `linking.exports for "${entry.name}" has url "${url2}", which differs from the network name.`,
        ["\xA73.2.5", "\xA77"],
        "Keep the export url equal to the network name so URL-based resolution and discovery metadata agree.",
        { url: url2, network: net }
      );
    }
  }
  return {
    result: f.result(),
    entry,
    definitionUrl,
    definitionText: fetched.text,
    definition,
    definitionArtifact: artifactInfo(fetched),
    linksArtifact,
    links
  };
}

// ../core/src/checks/origin-policy.ts
async function checkOriginPolicy(target, manifest, entry, externals, fetchImpl) {
  const f = new Findings("C6", "Denied origins fail closed; peer references match the peer policy", ["\xA72.1", "\xA73.2.9", "\xA73.3", "\xA75"], "harness");
  const targetUrl = `${target.siteBase}/${entry.name}`;
  const closed = { targetBase: target.siteBase, targetName: entry.name, targetManifest: manifest, policy: { mode: "closed", allowedPeers: [] } };
  const denied = { targetBase: target.siteBase, targetName: entry.name, targetManifest: manifest, policy: { mode: "open", allowedPeers: [], denyOrigins: [target.origin] } };
  if (fetchImpl) {
    closed.fetch = fetchImpl;
    denied.fetch = fetchImpl;
  }
  for (const [id, options2, label2] of [["C6.1", closed, "a closed policy that does not list the site"], ["C6.2", denied, "an open policy that denies the site"]]) {
    try {
      await withHarness(options2, async (h) => {
        const mark = h.mark();
        try {
          await h.engine.resolveRemote(targetUrl, [h.callerKey], null, h.callerManifest);
          f.fail(id, `Under ${label2}, the runtime still loaded ${targetUrl}.`, ["\xA73.2.9", "\xA75"], "The per-hop policy gate must refuse origins outside the caller's allowed_peers.", { policy: options2.policy });
        } catch (error) {
          const requests = h.since(mark).filter((r) => r.served === "target").map((r) => r.url);
          const message = errorText(error);
          if (/^Policy:/.test(message) && requests.length === 0) {
            f.pass(id, `Under ${label2}, the call is refused with a visible error before any contact: ${message}`, ["\xA73.2.9", "\xA75"], { policy: options2.policy, error: message, targetRequests: requests });
          } else {
            f.warn(id, `Under ${label2}, the call stopped but not as expected (${requests.length} target request(s)): ${message}`, ["\xA73.2.9", "\xA75"], "Check the runtime's policy gate.", { policy: options2.policy, error: message, targetRequests: requests });
          }
        }
      });
    } catch (error) {
      f.untestable(id, `The harness could not start: ${errorText(error)}`, ["\xA73.2.9"], { error: errorText(error) });
    }
  }
  const policy = asRecord(manifest["peer_policy"]) ?? asRecord(manifest["web_policy"]);
  const mode = policy ? asString(policy["mode"]) : null;
  const allowed = (asArray(manifest["allowed_peers"]) ?? []).map((v) => typeof v === "string" ? originOf(v) : null).filter((v) => v !== null);
  const referencedOrigins = /* @__PURE__ */ new Set();
  let problems = 0;
  for (const ext of externals) {
    if (ext.origin === null) continue;
    if (ext.origin === target.origin) {
      f.info("C6.3", `"${ext.agent}" references ${ext.kind} ${ext.ref} on the site's own origin (no consent card in the reference runtime).`, ["\xA73.2.4"], { ...ext });
      continue;
    }
    referencedOrigins.add(ext.origin);
    const ok = manifestAllowsPeer(ext.ref, manifest);
    if (!ok) {
      problems += 1;
      f.fail(
        "C6.3",
        `"${ext.agent}" references ${ext.kind} ${ext.ref}, but the site's peer policy (mode ${mode ?? "closed"}) does not allow ${ext.origin}; the site's own runtime refuses the call (fail closed).`,
        ["\xA72.1", "\xA73.3", "\xA75"],
        `Add "${ext.origin}" to allowed_peers, or remove the reference.`,
        { ...ext, allowed_peers: allowed, mode }
      );
    }
  }
  if (problems === 0) {
    if (referencedOrigins.size) {
      f.pass("C6.3", `Every external reference (${[...referencedOrigins].join(", ")}) is allowed by the site's peer policy.`, ["\xA73.3"], { referencedOrigins: [...referencedOrigins], allowed_peers: allowed, mode });
    } else {
      f.pass("C6.3", "The network references no other origin.", ["\xA73.3"], { allowed_peers: allowed, mode });
    }
  }
  const unused = allowed.filter((o) => !referencedOrigins.has(o) && o !== target.origin);
  if (unused.length) {
    f.info("C6.4", `allowed_peers lists origins no agent references: ${unused.join(", ")}.`, ["\xA73.3"], { unused });
  }
  return { result: f.result() };
}

// ../core/src/harness/turn.ts
var ROUTER_ORIGIN = "https://router.conform-harness.invalid";
var ROUTER = `${ROUTER_ORIGIN}/v1`;
var PEER_ROUTER_ORIGIN = "https://peer-router.conform-harness.invalid";
var CALLER_MARKER = "CONFORM-HARNESS-CALLER";
var PEER_ANSWER = "PEER_ANSWER: the target network ran in the caller's browser.";
var ALLOWED_FIELD = "conform_allowed_field";
var MODEL = "conform-scripted-model";
var TURN_TIMEOUT_MS = 3e4;
function randomToken() {
  return crypto.randomUUID().replace(/-/g, "");
}
function headerEntries(init) {
  const headers = init?.headers;
  if (!headers) return [];
  if (headers instanceof Headers) return [...headers.entries()];
  if (Array.isArray(headers)) return headers.map(([k, v]) => [String(k), String(v)]);
  return Object.entries(headers).map(([k, v]) => [k, String(v)]);
}
function sse(model, delta, finish) {
  const chunk = { id: "chatcmpl-conform", object: "chat.completion.chunk", model, choices: [{ index: 0, delta, finish_reason: finish }] };
  const usage = { id: "chatcmpl-conform", object: "chat.completion.chunk", model, choices: [], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
  const text = `data: ${JSON.stringify(chunk)}

data: ${JSON.stringify(usage)}

data: [DONE]

`;
  return new Response(text, { status: 200, headers: { "content-type": "text/event-stream" } });
}
function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}
async function runScriptedTurn(options2) {
  const key = `sk-conform-canary-${randomToken()}`;
  const privateValue = `conform-private-${randomToken()}`;
  const realFetch = options2.fetch ?? fetch;
  const targetUrl = `${options2.targetBase}/${options2.targetName}`;
  const targetOrigin = new URL(options2.targetBase).origin;
  const result = {
    requests: [],
    consents: [],
    answer: null,
    error: null,
    keyInTrace: false,
    privateInTrace: false,
    remotePayloadKeys: [],
    peerToolResult: null,
    peerRan: false
  };
  const callerAgent = {
    name: CALLER_NETWORK,
    function: { description: "Asks the target network on behalf of Conform." },
    instructions: `${CALLER_MARKER}. You are a test caller. Hand every request to the target network.`,
    tools: [targetUrl]
  };
  if (options2.allowField) callerAgent["allow"] = { to_downstream: { sly_data: [ALLOWED_FIELD] } };
  const callerNetwork = { metadata: { description: "Conform harness caller" }, tools: [callerAgent] };
  const callerManifest = {
    brand: "Conform harness caller",
    networks: [{ name: CALLER_NETWORK, front_man: CALLER_NETWORK, hocon: `./${CALLER_NETWORK}.network.json` }],
    llm_router: { base_url: ROUTER, mock: false, byok_router: ROUTER },
    allowed_peers: [targetOrigin],
    peer_policy: { mode: "closed", deny_origins: [] },
    deployment: { mode: "static" }
  };
  const servedTarget = { ...options2.targetManifest };
  delete servedTarget["actions"];
  if (options2.peerRouterOverride) {
    servedTarget["llm_router"] = { base_url: `${PEER_ROUTER_ORIGIN}/v1`, mock: false, byok_router: `${PEER_ROUTER_ORIGIN}/v1` };
  }
  const router = (body) => {
    const model = body.model ?? MODEL;
    const messages = body.messages ?? [];
    const system = messages.filter((m) => m.role === "system").map((m) => String(m.content ?? "")).join("\n");
    if (!system.includes(CALLER_MARKER)) {
      result.peerRan = true;
      return { role: "peer", response: sse(model, { role: "assistant", content: PEER_ANSWER }, "stop") };
    }
    const toolMessage = [...messages].reverse().find((m) => m.role === "tool");
    if (toolMessage) {
      result.peerToolResult = String(toolMessage.content ?? "").slice(0, 2e3);
      return { role: "caller", response: sse(model, { role: "assistant", content: `CALLER_FINAL: ${result.peerToolResult.slice(0, 200)}` }, "stop") };
    }
    const handoff = (body.tools ?? []).map((t) => t.function).find((f) => f?.description?.startsWith("Hand off to the"));
    if (!handoff?.name) {
      return { role: "caller", response: sse(model, { role: "assistant", content: "CALLER_FINAL: no hand-off tool was offered." }, "stop") };
    }
    const call = { index: 0, id: "call_conform_1", type: "function", function: { name: handoff.name, arguments: JSON.stringify({ request: "What does this site offer? (Conform conformance check)" }) } };
    return { role: "caller", response: sse(model, { role: "assistant", tool_calls: [call] }, "tool_calls") };
  };
  const stub = async (input, init) => {
    const url2 = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const parsed = new URL(url2);
    const headers = headerEntries(init);
    const authorization = headers.find(([k]) => k.toLowerCase() === "authorization")?.[1] ?? null;
    const body = typeof init?.body === "string" ? init.body : "";
    const record = {
      kind: "other",
      origin: parsed.origin,
      method: init?.method ?? "GET",
      path: parsed.pathname,
      hasAuthorization: authorization !== null,
      keyInAuthorization: authorization !== null && authorization.includes(key),
      hasCookie: headers.some(([k]) => k.toLowerCase() === "cookie"),
      keyInUrl: url2.includes(key),
      keyInOtherHeaders: headers.some(([k, v]) => k.toLowerCase() !== "authorization" && v.includes(key)),
      keyInBody: body.includes(key),
      privateInBody: body.includes(privateValue)
    };
    result.requests.push(record);
    if (parsed.origin === CALLER_ORIGIN) {
      record.kind = "caller";
      if (parsed.pathname === "/agent-manifest.json") return json(callerManifest);
      if (parsed.pathname === `/${CALLER_NETWORK}.network.json`) return json(callerNetwork);
      return new Response("Not found", { status: 404 });
    }
    if (parsed.origin === ROUTER_ORIGIN) {
      record.kind = "router";
      if (record.method === "POST" && parsed.pathname === "/v1/chat/completions") {
        let parsedBody = {};
        try {
          parsedBody = JSON.parse(body);
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const answer = router(parsedBody);
        record.role = answer.role;
        return answer.response;
      }
      return new Response("Not found", { status: 404 });
    }
    if (parsed.origin === PEER_ROUTER_ORIGIN) {
      record.kind = "peer-router";
      return new Response("The peer's router must never be used", { status: 502 });
    }
    if (parsed.origin === targetOrigin) {
      record.kind = "target";
      if (url2 === `${options2.targetBase}/agent-manifest.json`) return json(servedTarget);
      const forwarded = { method: record.method, credentials: "omit", cache: "no-store" };
      if (init?.headers) forwarded.headers = init.headers;
      if (init?.body !== void 0 && init.body !== null) forwarded.body = init.body;
      return realFetch(url2, forwarded);
    }
    return new Response("Blocked by the Conform harness", { status: 502 });
  };
  const g = globalThis;
  const previous = g.fetch;
  g.fetch = stub;
  const engine = new Engine({ originUrl: CALLER_ORIGIN, byokKey: key, routerOverride: ROUTER, modelOverride: MODEL });
  engine.onConsent = async (info) => {
    result.consents.push({
      kind: String(info["kind"] ?? ""),
      peerOrigin: String(info["peerOrigin"] ?? ""),
      peerLabel: String(info["peerLabel"] ?? ""),
      requestText: String(info["requestText"] ?? ""),
      targetRequestsBefore: result.requests.filter((r) => r.kind === "target").length
    });
    return options2.consent;
  };
  const slyData = { conform_private_canary: privateValue };
  if (options2.allowField) slyData[ALLOWED_FIELD] = "allowed-value";
  try {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`the turn did not finish within ${TURN_TIMEOUT_MS / 1e3} s`)), TURN_TIMEOUT_MS);
    });
    try {
      const turn = engine.runTurn("Ask the target network what it offers.", { slyData });
      const answer = await Promise.race([turn, timeout]);
      result.answer = answer.text;
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    g.fetch = previous;
  }
  const events = engine.trace.events;
  let traceText = "";
  try {
    traceText = JSON.stringify(events);
  } catch {
    traceText = "";
  }
  result.keyInTrace = traceText.includes(key);
  result.privateInTrace = traceText.includes(privateValue);
  for (const event of events) {
    if (event["kind"] === "remote_call") {
      const payload = event["requestPayload"];
      result.remotePayloadKeys.push(Object.keys(payload?.sly_data ?? {}));
    }
  }
  return result;
}

// ../core/src/checks/runtime-trust.ts
function unique(keys) {
  const seen = /* @__PURE__ */ new Set();
  return keys.filter((k) => {
    const id = JSON.stringify(k);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
function requestSummary(turn) {
  const count = (kind) => turn.requests.filter((r) => r.kind === kind).length;
  return {
    routerRequests: count("router"),
    siteRequests: turn.requests.filter((r) => r.kind === "target").map((r) => `${r.method} ${r.path}`),
    peerRouterRequests: count("peer-router"),
    otherOriginRequests: count("other")
  };
}
function untestableAll(f, id, spec, turn) {
  f.untestable(
    id,
    `The site's network did not run in the caller's runtime${turn.error ? `: ${turn.error}` : ""}. Fix C4 first.`,
    spec,
    { error: turn.error, ...requestSummary(turn) }
  );
}
function checkKey(allow, override) {
  const f = new Findings("C7", "The visitor's key never reaches the site, and the site cannot change the router", ["\xA73.2.2", "\xA73.4", "\xA74", "\xA76"], "harness");
  if (!allow.peerRan) {
    untestableAll(f, "C7.1", ["\xA73.2.2", "\xA74"], allow);
    return f.result();
  }
  const leaks = allow.requests.filter((r) => r.kind !== "router" && (r.keyInAuthorization || r.keyInUrl || r.keyInOtherHeaders || r.keyInBody));
  const siteCreds = allow.requests.filter((r) => r.kind === "target" && (r.hasAuthorization || r.hasCookie));
  const routerOk = allow.requests.filter((r) => r.kind === "router" && r.method === "POST").every((r) => r.keyInAuthorization);
  if (leaks.length === 0 && siteCreds.length === 0 && routerOk) {
    f.pass(
      "C7.1",
      `With a visitor key active, only the caller's router received it (in the Authorization header). The site received ${allow.requests.filter((r) => r.kind === "target").length} request(s) for its public files, with no Authorization header, no cookie and no key in any URL, header or body.`,
      ["\xA73.2.2", "\xA73.4", "\xA74", "\xA76"],
      requestSummary(allow)
    );
  } else {
    f.fail(
      "C7.1",
      "The visitor's key or credentials reached something other than the caller's router.",
      ["\xA73.2.2", "\xA73.4", "\xA74"],
      "A runtime must attach the key only to model requests sent to the selected router.",
      { leaks: leaks.map((r) => ({ kind: r.kind, origin: r.origin, path: r.path })), siteRequestsWithCredentials: siteCreds.map((r) => r.path), ...requestSummary(allow) }
    );
  }
  const peerCalls = allow.requests.filter((r) => r.kind === "router" && r.role === "peer").length;
  f.pass("C7.2", `The site's network ran locally in the caller's browser on the caller's router (${peerCalls} model request(s) from the site's agents, all to the caller's router).`, ["\xA73.2.2", "\xA76"], { peerModelRequests: peerCalls });
  if (!override.peerRan) {
    f.untestable("C7.3", `The router-override run did not reach the site's network${override.error ? `: ${override.error}` : ""}.`, ["\xA74"], requestSummary(override));
  } else if (override.requests.some((r) => r.kind === "peer-router")) {
    f.fail(
      "C7.3",
      "When the site's manifest names its own router, the caller's runtime used it.",
      ["\xA73.2.2", "\xA74"],
      "Router metadata in a peer manifest is informational during composition and MUST NOT override the caller's router.",
      requestSummary(override)
    );
  } else {
    f.pass("C7.3", "Served with a manifest that names a different router, the site's network still ran only on the caller's router; the named router was never contacted.", ["\xA73.2.2", "\xA74"], requestSummary(override));
  }
  const inPrompts = allow.requests.some((r) => r.kind === "router" && r.keyInBody);
  if (allow.keyInTrace || inPrompts) {
    f.fail(
      "C7.4",
      `The key appears in ${allow.keyInTrace ? "the runtime's trace" : ""}${allow.keyInTrace && inPrompts ? " and " : ""}${inPrompts ? "a prompt" : ""}.`,
      ["\xA74"],
      "Keep the key out of prompts, traces and analytics.",
      { keyInTrace: allow.keyInTrace, keyInPrompt: inPrompts }
    );
  } else {
    f.pass("C7.4", "The key appears in no prompt and nowhere in the runtime's trace.", ["\xA74"], { keyInTrace: false, keyInPrompt: false });
  }
  f.info("C7.5", "This proves what a caller on the reference runtime does with the site as a peer. It cannot prove what the site's own page does with its visitors' keys; that depends on the runtime the site ships (C10, planned).", ["\xA74"]);
  return f.result();
}
function checkPrivate(allow, allowField, definition) {
  const f = new Findings("C8", "Private context stays with the caller unless a field is explicitly allowed", ["\xA72.1", "\xA73.2.7", "\xA75", "\xA76"], "harness");
  if (!allow.peerRan) {
    untestableAll(f, "C8.1", ["\xA73.2.7"], allow);
    return f.result();
  }
  const sent = unique(allow.remotePayloadKeys);
  const atSite = allow.requests.some((r) => (r.kind === "target" || r.kind === "router" && r.role === "peer") && r.privateInBody);
  if (sent.every((k) => k.length === 0) && !atSite) {
    f.pass(
      "C8.1",
      "With no allow rule, the site's network received no private-context fields, and the private value never appeared in its prompts or requests.",
      ["\xA73.2.7", "\xA75", "\xA76"],
      { fieldsSentToSite: sent, privateValueAtSite: false }
    );
  } else {
    f.fail(
      "C8.1",
      "Private context reached the site's network without an allow rule.",
      ["\xA73.2.7", "\xA75"],
      "Private-context fields MUST NOT pass between network invocations by default.",
      { fieldsSentToSite: sent, privateValueAtSite: atSite }
    );
  }
  if (!allowField.peerRan) {
    f.untestable("C8.2", "The allow-rule run did not reach the site's network.", ["\xA75"], requestSummary(allowField));
  } else {
    const keys = unique(allowField.remotePayloadKeys);
    const ok = keys.length > 0 && keys.every((k) => k.length === 1 && k[0] === ALLOWED_FIELD);
    const leaked = allowField.requests.some((r) => (r.kind === "target" || r.kind === "router" && r.role === "peer") && r.privateInBody);
    if (ok && !leaked) {
      f.pass("C8.2", `With the caller allowing only "${ALLOWED_FIELD}", exactly that field crossed to the site's network and the other private value did not.`, ["\xA75", "\xA76"], { fieldsSentToSite: keys });
    } else {
      f.fail(
        "C8.2",
        "The caller's allow rule did not limit private context to the named field.",
        ["\xA75"],
        "Only explicitly named fields may be forwarded under an applicable allow rule.",
        { fieldsSentToSite: keys, otherPrivateValueAtSite: leaked }
      );
    }
  }
  const upstream = [];
  for (const agent of asArray(definition["tools"]) ?? []) {
    const spec = asRecord(agent);
    const fields = asRecord(asRecord(spec?.["allow"])?.["to_upstream"])?.["sly_data"];
    if (fields !== void 0) upstream.push({ agent: spec?.["name"], fields });
  }
  if (upstream.length) {
    f.info("C8.3", `The site's network declares upstream private-context rules; a caller only keeps fields its own network permits.`, ["\xA73.2.7"], { upstream });
  } else {
    f.info("C8.3", "The site's network declares no upstream private-context fields, so its answers return only through the ordinary tool-result text.", ["\xA73.2.7"]);
  }
  if (allow.privateInTrace) {
    f.warn("C8.4", "The private value appears in the runtime's trace.", ["\xA75"], "Traces should not expose private context; check the runtime's redaction.", {});
  }
  return f.result();
}
async function pageConsentWiring(target, fetchOptions) {
  if (inBrowser()) return { status: "unknown", detail: { reason: "a browser on another origin cannot read the site's page and scripts (no CORS on pages)" } };
  const page = await fetchArtifact(`${target.siteBase}/`, fetchOptions);
  if (page.status !== 200 || !/html/i.test(page.contentType ?? "")) return { status: "unknown", detail: { url: `${target.siteBase}/`, status: page.status } };
  const sources = [...page.text.matchAll(/<script\b[^>]*\btype\s*=\s*["']?module["']?[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]).slice(0, 6);
  const scanned = [];
  const haystacks = [page.text];
  const queue = sources.map((src) => new URL(src, `${target.siteBase}/`).href);
  const seen = /* @__PURE__ */ new Set();
  while (queue.length && scanned.length < 12) {
    const href = queue.shift();
    if (seen.has(href)) continue;
    seen.add(href);
    let url2;
    try {
      url2 = new URL(href);
    } catch {
      continue;
    }
    if (url2.origin !== target.origin) continue;
    const script = await fetchArtifact(url2.href, fetchOptions);
    if (script.status !== 200 || script.bytes >= 15e5) continue;
    scanned.push(url2.pathname);
    haystacks.push(script.text);
    if (sources.some((src) => new URL(src, `${target.siteBase}/`).href === href)) {
      for (const m of script.text.matchAll(/(?:import\(\s*|from\s*)["']([^"']+\.m?js)["']/g)) {
        try {
          queue.push(new URL(m[1], url2).href);
        } catch {
        }
      }
    }
  }
  const all = haystacks.join("\n");
  const bootsRuntime = /runtime\/index\.js/.test(all) && /\bboot\s*\(/.test(all);
  const customConsent = /\bonConsent\b/.test(all);
  const detail = { page: `${target.siteBase}/`, scannedScripts: scanned, bootsReferenceRuntime: bootsRuntime, setsOnConsent: customConsent };
  return { status: bootsRuntime || customConsent ? "found" : "missing", detail };
}
async function checkConsent(allow, decline, target, fetchOptions) {
  const f = new Findings("C9", "Consent comes before every contact, and a decline sends nothing", ["\xA73.2.4", "\xA75", "\xA76"], "harness");
  const first = allow.consents[0];
  const host = new URL(target.siteBase).host;
  if (!first) {
    f.fail(
      "C9.1",
      "The caller's runtime contacted the site without asking for consent.",
      ["\xA73.2.4", "\xA75"],
      "An interactive runtime MUST obtain the user's approval before each contact with a third-party origin.",
      requestSummary(allow)
    );
  } else if (first.targetRequestsBefore === 0 && first.peerOrigin === host && first.requestText.trim()) {
    f.pass(
      "C9.1",
      `Consent was requested before any request to the site, naming the destination (${first.peerOrigin}) and the request text.`,
      ["\xA73.2.4", "\xA75", "\xA76"],
      { peerOrigin: first.peerOrigin, peerLabel: first.peerLabel, requestPreview: first.requestText.slice(0, 80), siteRequestsBeforeConsent: 0 }
    );
  } else {
    f.fail(
      "C9.1",
      "Consent did not precede the first contact or did not name the destination.",
      ["\xA73.2.4", "\xA75"],
      "Identify the destination origin and purpose, and ask before the first request.",
      { consent: first }
    );
  }
  const declinedRequests = decline.requests.filter((r) => r.kind === "target").length;
  if (decline.consents.length && declinedRequests === 0) {
    f.pass(
      "C9.2",
      "When the visitor declines, the site receives no request at all and the caller is told the contact was declined.",
      ["\xA73.2.4", "\xA75"],
      { siteRequestsAfterDecline: 0, toolResult: decline.peerToolResult?.slice(0, 120) ?? null }
    );
  } else {
    f.fail("C9.2", `After a decline the site still received ${declinedRequests} request(s).`, ["\xA73.2.4", "\xA75"], "A declined contact must send nothing.", requestSummary(decline));
  }
  const wiring = await pageConsentWiring(target, fetchOptions);
  if (wiring.status === "found") {
    f.pass("C9.3", "The site's page boots the reference runtime UI or sets its own consent handler, so its visitors get a consent card.", ["\xA73.2.4"], wiring.detail);
  } else if (wiring.status === "missing") {
    f.warn(
      "C9.3",
      "The site's home page does not visibly boot the reference runtime UI or set a consent handler. The reference engine allows every contact when no handler is attached.",
      ["\xA73.2.4"],
      "Boot the runtime with its UI (runtime/index.js boot()) or set engine.onConsent before the first message.",
      wiring.detail
    );
  } else {
    f.info("C9.3", "Could not read the site's page to see how its own visitors are asked (the CLI can read it); check the consent card in a browser.", ["\xA73.2.4"], wiring.detail);
  }
  return f.result();
}
async function checkRuntimeTrust(target, manifest, entry, definition, fetchOptions, fetchImpl) {
  const base = { targetBase: target.siteBase, targetName: entry.name, targetManifest: manifest };
  const withFetch = fetchImpl ? { fetch: fetchImpl } : {};
  const timed = async (options2) => {
    const started = performance.now();
    const turn = await runScriptedTurn(options2);
    return [turn, Math.round(performance.now() - started)];
  };
  const [allow, tAllow] = await timed({ ...base, ...withFetch, consent: "allow" });
  const [decline, tDecline] = await timed({ ...base, ...withFetch, consent: "decline" });
  const [extra, tExtra] = await timed({ ...base, ...withFetch, consent: "allow", allowField: true, peerRouterOverride: true });
  const c7 = checkKey(allow, extra);
  c7.durationMs += tAllow + tExtra;
  const c8 = checkPrivate(allow, extra, definition);
  c8.durationMs += tAllow + tExtra;
  const c9 = await checkConsent(allow, decline, target, fetchOptions);
  c9.durationMs += tAllow + tDecline;
  return { c7, c8, c9 };
}

// ../core/src/report.ts
function summarize(checks) {
  const summary = { total: 0, pass: 0, fail: 0, warn: 0, info: 0, untestable: 0, worst: "pass" };
  const statuses = [];
  for (const check of checks) {
    for (const finding of check.findings) {
      summary.total += 1;
      summary[finding.status] += 1;
      statuses.push(finding.status);
    }
  }
  summary.worst = worstStatus(statuses);
  return summary;
}

// ../core/src/index.ts
var DEFAULT_CALLER_ORIGIN = "https://conform.example";
function callerOriginFor(options2) {
  if (options2.callerOrigin) return options2.callerOrigin;
  const g = globalThis;
  if (inBrowser() && g.location?.origin) return g.location.origin;
  return DEFAULT_CALLER_ORIGIN;
}
async function checkNetwork(input, options2 = {}) {
  const startedAt = (/* @__PURE__ */ new Date()).toISOString();
  const callerOrigin = callerOriginFor(options2);
  const { target, problems } = parseInput(input);
  const checks = [];
  const push = (result) => {
    checks.push(result);
    try {
      options2.onCheck?.(result, checks.length - 1);
    } catch {
    }
  };
  const artifacts = {};
  const fetchOptions = { callerOrigin };
  if (options2.fetch) fetchOptions.fetch = options2.fetch;
  if (options2.timeoutMs !== void 0) fetchOptions.timeoutMs = options2.timeoutMs;
  let site = null;
  const finish = () => ({
    site,
    conform: { version: CONFORM_VERSION, spec: SPEC, runtime: RUNTIME, environment: inBrowser() ? "browser" : "node", callerOrigin },
    target,
    startedAt,
    finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
    summary: summarize(checks),
    checks,
    artifacts
  });
  if (problems.length) {
    const f = new Findings("C0", "Input", ["\xA73.2.1"], "static");
    for (const problem of problems) f.fail("C0.1", problem, ["\xA73.2.1"], "Give a network URL: the folder that holds agent-manifest.json, then the network name.", { input });
    push(f.result());
    return finish();
  }
  const c1 = await checkManifest(target, fetchOptions);
  push(c1.result);
  if (c1.artifact) artifacts.manifest = c1.artifact;
  if (!c1.manifest) return finish();
  const c2 = await checkNetworkEntry(target, c1.manifest, c1.entries, fetchOptions);
  push(c2.result);
  if (c2.definitionArtifact) artifacts.definition = c2.definitionArtifact;
  if (c2.linksArtifact) artifacts.links = c2.linksArtifact;
  if (c2.entry) {
    const text = (v, max) => typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
    const tags = Array.isArray(c2.entry.raw["tags"]) ? c2.entry.raw["tags"].filter((t) => typeof t === "string").slice(0, 8).map((t) => t.slice(0, 40)) : [];
    site = { brand: text(c1.manifest["brand"], 80), description: text(c2.entry.raw["description"], 300), tags };
  }
  if (!c2.entry || !c2.definition || c2.definitionText === null) return finish();
  if (target.networkName === null) {
    target.networkName = c2.entry.name;
    target.networkUrl = `${target.siteBase}/${c2.entry.name}`;
  }
  const c3 = checkDefinition(target, c1.manifest, c2.entry, c2.definition, c2.definitionText, c1.fetched?.text ?? "");
  push(c3.result);
  if (options2.staticOnly) return finish();
  push((await checkExactName(target, c1.manifest, c1.entries, c2.entry, options2.fetch)).result);
  push((await checkLimits(target, c1.manifest, c2.entry, options2.fetch)).result);
  push((await checkOriginPolicy(target, c1.manifest, c2.entry, c3.externals, options2.fetch)).result);
  const trust = await checkRuntimeTrust(target, c1.manifest, c2.entry, c2.definition, fetchOptions, options2.fetch);
  push(trust.c7);
  push(trust.c8);
  push(trust.c9);
  return finish();
}

// src/format.ts
var CODES = {
  bold: [1, 22],
  dim: [2, 22],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  blue: [34, 39],
  magenta: [35, 39],
  cyan: [36, 39]
};
function paint(on, style, text) {
  if (!on) return text;
  const [open, close] = CODES[style];
  return `\x1B[${open}m${text}\x1B[${close}m`;
}
var LABEL = { pass: "PASS", fail: "FAIL", warn: "WARN", info: "INFO", untestable: "N/T " };
var MARK = { pass: "\u2714", fail: "\u2716", warn: "\u25B2", info: "\xB7", untestable: "?" };
var STYLE = { pass: "green", fail: "red", warn: "yellow", info: "dim", untestable: "magenta" };
var PROBLEMS = /* @__PURE__ */ new Set(["fail", "warn", "untestable"]);
function statusTag(on, status) {
  return paint(on, STYLE[status], LABEL[status]);
}
function findingLines(f, options2) {
  const c = options2.color;
  const lines = [`    ${paint(c, STYLE[f.status], MARK[f.status])} ${paint(c, "dim", f.id.padEnd(6))} ${f.message}`];
  if (f.suggestion && (f.status === "fail" || f.status === "warn")) {
    lines.push(`      ${paint(c, "cyan", "fix:")} ${f.suggestion}`);
  }
  if (f.spec.length && (f.status === "fail" || f.status === "warn")) {
    lines.push(`      ${paint(c, "dim", `spec ${f.spec.join(", ")}`)}`);
  }
  if (options2.evidence && f.evidence) {
    lines.push(`      ${paint(c, "dim", `evidence ${JSON.stringify(f.evidence)}`)}`);
  }
  return lines;
}
function formatReport(report, options2) {
  const c = options2.color;
  const { conform, target, summary } = report;
  const out = [];
  out.push(`${paint(c, "bold", "Conform")} ${conform.version} \xB7 spec ${conform.spec.specCommit.slice(0, 7)} \xB7 ${conform.spec.profile} \xB7 runtime nsdeploy ${conform.runtime.nsdeployCommit}`);
  out.push(`${paint(c, "dim", "Target")}  ${target.networkUrl ?? target.siteBase ?? target.input}`);
  out.push(`${paint(c, "dim", "Caller")}  ${conform.callerOrigin}`);
  out.push("");
  for (const check of report.checks) {
    out.push(`${paint(c, "bold", check.id.padEnd(3))} ${statusTag(c, check.status)}  ${check.name} ${paint(c, "dim", `[${check.mode}, ${check.durationMs} ms]`)}`);
    const shown = options2.problemsOnly ? check.findings.filter((f) => PROBLEMS.has(f.status)) : check.findings;
    for (const finding of shown) out.push(...findingLines(finding, options2));
    if (options2.problemsOnly && shown.length === 0) out.push(`    ${paint(c, "dim", `${check.findings.length} finding(s), no problems`)}`);
    out.push("");
  }
  const parts = [
    paint(c, "green", `${summary.pass} pass`),
    paint(c, summary.fail ? "red" : "dim", `${summary.fail} fail`),
    paint(c, summary.warn ? "yellow" : "dim", `${summary.warn} warn`),
    paint(c, "dim", `${summary.info} info`),
    paint(c, summary.untestable ? "magenta" : "dim", `${summary.untestable} untestable`)
  ];
  out.push(`${paint(c, "bold", "Result")}  ${statusTag(c, summary.worst)}  ${parts.join(" \xB7 ")}`);
  const ran = report.checks.map((x) => x.id).join(" ");
  out.push(paint(c, "dim", `Checks run: ${ran || "none"}. Not yet automated: C10 runtime fingerprint to C14 BYOK panel.`));
  return out.join("\n");
}

// src/markdown.ts
var ICON = { pass: "\u2705", fail: "\u274C", warn: "\u26A0\uFE0F", info: "\u2139\uFE0F", untestable: "\u2754" };
function cell(text) {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
function formatMarkdown(report) {
  const s = report.summary;
  const target = report.target.networkUrl ?? report.target.siteBase ?? report.target.input;
  const lines = [
    `## ${ICON[s.worst]} Conform: ${s.worst.toUpperCase()} for \`${cell(target)}\``,
    "",
    `**${s.pass}** pass \xB7 **${s.fail}** fail \xB7 **${s.warn}** warn \xB7 ${s.info} info \xB7 ${s.untestable} untestable`,
    "",
    "| Check | Result | Problems |",
    "| --- | --- | --- |"
  ];
  for (const check of report.checks) {
    const problems2 = check.findings.filter((f) => f.status === "fail" || f.status === "warn" || f.status === "untestable");
    lines.push(`| ${check.id} ${cell(check.name)} | ${ICON[check.status]} ${check.status} | ${problems2.length ? problems2.map((p) => `${p.id}`).join(", ") : "\u2013"} |`);
  }
  const problems = report.checks.flatMap((c) => c.findings.filter((f) => f.status === "fail" || f.status === "warn" || f.status === "untestable"));
  if (problems.length) {
    lines.push("", "### What to fix", "");
    for (const p of problems) {
      lines.push(`- ${ICON[p.status]} **${p.id}** ${cell(p.message)}${p.suggestion ? `<br>Fix: ${cell(p.suggestion)}` : ""}${p.spec.length ? ` _(spec ${p.spec.join(", ")})_` : ""}`);
    }
  }
  lines.push("", `<sub>Conform ${report.conform.version} \xB7 spec ${report.conform.spec.specCommit.slice(0, 7)} (${report.conform.spec.profile}) \xB7 runtime nsdeploy ${report.conform.runtime.nsdeployCommit} \xB7 C10\u2013C14 not automated yet</sub>`, "");
  return lines.join("\n");
}

// src/run.ts
import { appendFile, writeFile } from "node:fs/promises";

// src/args.ts
var USAGE = `Usage: conform check <url> [options]

Check an Open Agentic Web site against the Worldwide Agentic Web MVP specification.

<url> is a network URL (the folder that holds agent-manifest.json, then the network
name, such as https://site.example/agents/transit), a site base ending in "/", or the
manifest URL itself.

Options:
  --json               Print the full JSON report instead of text.
  --out <file>         Also write the JSON report to <file>.
  --summary <file>     Also append a Markdown summary to <file> (for example $GITHUB_STEP_SUMMARY).
  --static-only        Run only the static checks (C1-C3); skip the runtime harness.
  --origin <origin>    The caller origin to evaluate CORS against (default https://conform.example).
  --timeout <ms>       Timeout per artifact request (default 15000).
  --fail-on <level>    Exit 1 on "fail" (default) or on "warn" and worse.
  --evidence           Show each finding's evidence in text output.
  --problems           Show only fail, warn and untestable findings in text output.
  --color / --no-color Force or disable colors (default: on for a terminal, off with NO_COLOR).
  -h, --help           Show this help.
  -v, --version        Show the version and the spec commit it checks against.

Exit codes: 0 no failing finding, 1 a finding at or above --fail-on, 2 bad usage or crash.`;
var UsageError = class extends Error {
};
var VALUE_OPTIONS = /* @__PURE__ */ new Set(["--out", "--summary", "--origin", "--timeout", "--fail-on"]);
function parseArgs(argv) {
  if (argv.length === 0) throw new UsageError("Missing command.");
  if (argv.includes("-h") || argv.includes("--help") || argv[0] === "help") return { command: "help" };
  if (argv.includes("-v") || argv.includes("--version") || argv[0] === "version") return { command: "version" };
  const [command, ...rest] = argv;
  if (command !== "check") throw new UsageError(`Unknown command "${command}". Use "conform check <url>".`);
  const args = {
    command: "check",
    url: "",
    json: false,
    out: null,
    summary: null,
    staticOnly: false,
    origin: null,
    timeoutMs: null,
    failOn: "fail",
    evidence: false,
    problemsOnly: false,
    color: null
  };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (VALUE_OPTIONS.has(arg)) {
      const value = rest[i + 1];
      if (value === void 0 || value.startsWith("--")) throw new UsageError(`${arg} needs a value.`);
      i += 1;
      if (arg === "--out") args.out = value;
      else if (arg === "--summary") args.summary = value;
      else if (arg === "--origin") {
        let url2;
        try {
          url2 = new URL(value);
        } catch {
          throw new UsageError(`--origin needs an origin such as https://my-site.example, not "${value}".`);
        }
        if (url2.protocol !== "http:" && url2.protocol !== "https:") throw new UsageError("--origin must be http or https.");
        args.origin = url2.origin;
      } else if (arg === "--timeout") {
        const n = Number(value);
        if (!Number.isInteger(n) || n <= 0) throw new UsageError("--timeout needs a positive number of milliseconds.");
        args.timeoutMs = n;
      } else {
        if (value !== "fail" && value !== "warn") throw new UsageError('--fail-on must be "fail" or "warn".');
        args.failOn = value;
      }
    } else if (arg === "--json") args.json = true;
    else if (arg === "--static-only") args.staticOnly = true;
    else if (arg === "--evidence") args.evidence = true;
    else if (arg === "--problems") args.problemsOnly = true;
    else if (arg === "--color") args.color = true;
    else if (arg === "--no-color") args.color = false;
    else if (arg.startsWith("-")) throw new UsageError(`Unknown option ${arg}.`);
    else if (args.url === "") args.url = arg;
    else throw new UsageError(`Unexpected argument "${arg}". Check one URL per run.`);
  }
  if (args.url === "") throw new UsageError("Give the URL to check.");
  return args;
}

// src/run.ts
function exitCodeFor(report, failOn) {
  if (report.summary.fail > 0) return 1;
  if (failOn === "warn" && report.summary.warn > 0) return 1;
  return 0;
}
function useColor(args, io) {
  if (args.color !== null) return args.color;
  if (args.json) return false;
  if (io.env["NO_COLOR"] !== void 0 && io.env["NO_COLOR"] !== "") return false;
  if (io.env["FORCE_COLOR"] && io.env["FORCE_COLOR"] !== "0") return true;
  return io.isTty;
}
async function run(argv, io) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`conform: ${error.message}

${USAGE}`);
      return 2;
    }
    throw error;
  }
  if (parsed.command === "help") {
    io.stdout(USAGE);
    return 0;
  }
  if (parsed.command === "version") {
    io.stdout(`conform ${CONFORM_VERSION} (spec ${SPEC.specCommit}, ${SPEC.profile})`);
    return 0;
  }
  const args = parsed;
  const options2 = { staticOnly: args.staticOnly };
  if (args.origin) options2.callerOrigin = args.origin;
  if (args.timeoutMs !== null) options2.timeoutMs = args.timeoutMs;
  if (io.fetch) options2.fetch = io.fetch;
  let report;
  try {
    report = await checkNetwork(args.url, options2);
  } catch (error) {
    io.stderr(`conform: the check stopped on an unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
  const json2 = JSON.stringify(report, null, 2);
  if (args.out) {
    try {
      await writeFile(args.out, `${json2}
`, "utf8");
    } catch (error) {
      io.stderr(`conform: cannot write ${args.out}: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
  }
  if (args.summary) {
    try {
      await appendFile(args.summary, formatMarkdown(report), "utf8");
    } catch (error) {
      io.stderr(`conform: cannot write ${args.summary}: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
  }
  io.stdout(args.json ? json2 : formatReport(report, { color: useColor(args, io), evidence: args.evidence, problemsOnly: args.problemsOnly }));
  if (args.out && !args.json) io.stderr(`conform: JSON report written to ${args.out}`);
  return exitCodeFor(report, args.failOn);
}

export {
  parseInput,
  CONFORM_VERSION,
  SPEC,
  RUNTIME,
  CATALOG,
  checkInfo,
  findingGuides,
  compactReport,
  compactText,
  checkNetwork,
  formatReport,
  formatMarkdown,
  run
};
