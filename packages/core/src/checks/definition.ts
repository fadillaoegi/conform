// C3 — the network definition: Neuro SAN data model shape, resolvable references, front agent,
// data-only (no includes, substitutions, local paths), explicit private-context rules, no secrets.
// Spec: §2, §2.1, §2.2, §3.1 (parse and validate), §5.

import { AgentNetwork, validateNetwork } from "@conform/reference-runtime/runtime/kernel.js";
import { asArray, asRecord, asString, Findings, mask } from "../findings.ts";
import type { JsonObject, NetworkEntry, Target } from "../types.ts";
import { isLoopbackHost, originOf } from "../url.ts";

export interface DefinitionCheck {
  result: ReturnType<Findings["result"]>;
  network: AgentNetwork | null;
  runtimeErrors: string[];
  /** External references found: remote peer networks and MCP servers, with the agent that lists them. */
  externals: Array<{ agent: string; kind: "remote" | "mcp"; ref: string; origin: string | null }>;
}

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "OpenAI-style key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "Otari key", pattern: /\botk_[A-Za-z0-9_-]{10,}\b/g },
  { name: "Bearer token", pattern: /\bBearer\s+[A-Za-z0-9._-]{20,}/g },
  { name: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "JWT", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: "Anthropic key", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
];
const SECRET_KEYS = /^(api[_-]?key|apikey|secret|password|passwd|auth[_-]?token|access[_-]?token|private[_-]?key)$/i;

const DATA_ONLY_PATTERNS: Array<{ name: string; pattern: RegExp; spec: string[] }> = [
  { name: "HOCON include directive", pattern: /^\s*include\s+["'(]/m, spec: ["§2"] },
  { name: "HOCON substitution ${...}", pattern: /\$\{[^}]*\}/, spec: ["§2"] },
  { name: "file:// URL", pattern: /\bfile:\/\//i, spec: ["§2"] },
  { name: "Unix home or system path", pattern: /(^|["'\s(])\/(Users|home|opt|var|etc|tmp)\/[^\s"']+/, spec: ["§2"] },
  { name: "Windows drive path", pattern: /(^|["'\s(])[A-Za-z]:\\[^\s"']+/, spec: ["§2"] },
];

export function scanSecrets(text: string): Array<{ kind: string; sample: string }> {
  const hits: Array<{ kind: string; sample: string }> = [];
  for (const { name, pattern } of SECRET_PATTERNS) {
    for (const match of text.matchAll(pattern)) hits.push({ kind: name, sample: mask(match[0]) });
  }
  return hits;
}

function walk(value: unknown, path: string, visit: (path: string, key: string, value: unknown) => void): void {
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

export function checkDefinition(
  target: Target,
  manifest: JsonObject,
  entry: NetworkEntry,
  definition: JsonObject,
  definitionText: string,
  manifestText: string,
): DefinitionCheck {
  const f = new Findings("C3", "Definition: Neuro SAN data model, references, data-only, private context, secrets", ["§2", "§2.1", "§2.2", "§3.1", "§5"], "static");
  const externals: DefinitionCheck["externals"] = [];
  let network: AgentNetwork | null = null;
  let runtimeErrors: string[] = [];

  // C3.1 — shape: tools[] of agents with unique names.
  const tools = asArray(definition["tools"]);
  if (!tools || tools.length === 0) {
    f.fail("C3.1", "The definition has no non-empty tools[] array.", ["§2", "§2.1"], "Describe the network's agents in a top-level tools[] array.", { path: "tools" });
    return { result: f.result(), network, runtimeErrors, externals };
  }
  const agents: Array<{ name: string; spec: JsonObject; path: string }> = [];
  const seen = new Map<string, number>();
  tools.forEach((item, index) => {
    const path = `tools[${index}]`;
    const spec = asRecord(item);
    if (!spec) {
      f.fail("C3.1", `${path} is not an object.`, ["§2.1"], "Each tools[] entry describes one agent or tool.", { path });
      return;
    }
    const rawName = asString(spec["name"]);
    const name = rawName?.trim() ?? "";
    if (!name) {
      f.fail("C3.1", `${path} has no name.`, ["§2.1"], "Give every agent a unique name.", { path });
      return;
    }
    if (rawName !== name) {
      f.warn("C3.1", `${path}.name has surrounding whitespace ("${rawName}"); the runtime trims it.`, ["§2.1"], "Remove the whitespace.", { path, name: rawName });
    }
    seen.set(name, (seen.get(name) ?? 0) + 1);
    agents.push({ name, spec, path });
  });
  for (const [name, count] of seen) {
    if (count > 1) {
      f.fail("C3.1", `Agent name "${name}" is used ${count} times; names must be unique within the network.`, ["§2.1"], "Rename the duplicates.", { name, count });
    }
  }
  if (!f.hasFail()) f.pass("C3.1", `${agents.length} agent/tool definition(s) with unique names.`, ["§2.1"], { agents: agents.map((a) => a.name) });

  // C3.2 — per-agent fields.
  const agentNames = new Set(agents.map((a) => a.name));
  for (const { name, spec, path } of agents) {
    const isCoded = typeof spec["class"] === "string";
    const isToolbox = typeof spec["toolbox"] === "string";
    const instructions = spec["instructions"];
    const fn = asRecord(spec["function"]);
    if (!isCoded && !isToolbox) {
      if (typeof instructions !== "string" || instructions.trim() === "") {
        f.fail("C3.2", `Agent "${name}" has no instructions and is neither a coded tool (class) nor a toolbox tool.`, ["§2.1"],
          "Give LLM agents instructions, or declare the tool's class/toolbox.", { path, name });
      }
    }
    if (!fn || asString(fn["description"]) === null) {
      f.warn("C3.2", `"${name}" has no function.description; callers and models cannot tell when to use it.`, ["§2.1"], "Add function.description.", { path: `${path}.function.description`, name });
    } else {
      const params = fn["parameters"];
      if (params !== undefined) {
        const schema = asRecord(params);
        if (!schema || (schema["type"] !== undefined && schema["type"] !== "object")) {
          f.warn("C3.2", `"${name}".function.parameters is not a JSON Schema object with type "object".`, ["§2.1"], 'Use { "type": "object", "properties": { ... }, "required": [...] }.', { path: `${path}.function.parameters`, name });
        }
      }
    }
    if (isCoded) {
      f.info("C3.9", `"${name}" is a coded tool (class "${spec["class"]}"): an optional extension, not part of the minimum portable data profile.`, ["§2.2", "§3.2"], { path, name, class: spec["class"] });
    }
    if (spec["tools"] !== undefined && !Array.isArray(spec["tools"])) {
      f.fail("C3.2", `"${name}".tools is not an array.`, ["§2.1"], "List the agents, peer-network URLs or MCP descriptors the agent may call.", { path: `${path}.tools`, name });
    }
    const model = asString(asRecord(spec["llm_config"])?.["model_name"]);
    if (model) f.info("C3.10", `"${name}" names model "${model}" (a hint; the caller's router and model policy take precedence).`, ["§2.1", "§3.2.2"], { name, model });
  }
  if (!f.items.some((x) => x.id === "C3.2" && x.status === "fail")) {
    f.pass("C3.2", "Every LLM agent has instructions; function descriptions and schemas are well formed where present.", ["§2.1"]);
  }

  // C3.3 / C3.4 — references and front agent, through the reference runtime's validator.
  try {
    network = new AgentNetwork(structuredClone(definition), entry.name);
    const validation = validateNetwork(network);
    runtimeErrors = validation.errors;
    for (const message of validation.errors) {
      f.fail("C3.3", `Reference runtime validation: ${message}`, ["§2.1", "§3.1"], "Fix the reference so every tools[] entry names an agent in this network, a peer network URL, or an MCP descriptor.", { message });
    }
    if (validation.errors.length === 0) {
      f.pass("C3.3", "The reference runtime's validator accepts the network (shape, front agent, references).", ["§2.1", "§3.1"]);
    }
    const front = network.findFrontMan();
    if (front === null) {
      f.fail("C3.4", "No front agent: no tools[] entry has instructions.", ["§2.1"], "Give the entry agent instructions.", {});
    } else {
      f.pass("C3.4", `Front agent "${front}" found.`, ["§2.1"], { front });
    }
    for (const { name, spec } of agents) {
      const refs = asArray(spec["tools"]) ?? [];
      for (const ref of refs) {
        const kind = network.classifyTool(ref).kind;
        if (kind === "remote" && typeof ref === "string") {
          externals.push({ agent: name, kind: "remote", ref, origin: originOf(ref) });
        } else if (kind === "mcp") {
          const url = typeof ref === "string" ? ref : asString(asRecord(ref)?.["url"]) ?? "";
          externals.push({ agent: name, kind: "mcp", ref: url, origin: originOf(url) });
          if (!url) f.fail("C3.3", `"${name}" lists an MCP descriptor without a url.`, ["§2.1"], 'Use { "url": "https://.../mcp", "tools": [...] }.', { name, ref });
        } else if (kind === "link") {
          f.warn("C3.3", `"${name}" references link slot "${String(ref)}". An unbound slot makes the caller's chat ask the visitor for a URL (reference-runtime extension).`, ["§3.3", "§7"],
            "Prefer a concrete peer-network URL in tools, or bind the slot in links.json.", { name, ref });
        } else if (typeof ref === "string" && ref === name) {
          f.warn("C3.3", `"${name}" lists itself as a tool.`, ["§3.1"], "Remove the self-reference; repeated invocation is bounded by the runtime's budgets, not by the graph.", { name });
        }
      }
    }
    // Reachability from the front agent.
    if (front !== null) {
      const reached = new Set<string>();
      const queue = [front];
      while (queue.length) {
        const current = queue.pop() as string;
        if (reached.has(current)) continue;
        reached.add(current);
        const spec = agents.find((a) => a.name === current)?.spec;
        for (const ref of asArray(spec?.["tools"]) ?? []) {
          if (typeof ref === "string" && agentNames.has(ref) && !reached.has(ref)) queue.push(ref);
        }
      }
      const unreachable = agents.map((a) => a.name).filter((n) => !reached.has(n));
      if (unreachable.length) {
        f.warn("C3.7", `${unreachable.length} agent(s) are not reachable from the front agent: ${unreachable.join(", ")}.`, ["§2.1"], "Remove them or reference them from an agent that runs.", { unreachable });
      } else {
        f.pass("C3.7", "Every agent is reachable from the front agent.", ["§2.1"]);
      }
    }
  } catch (error) {
    f.fail("C3.3", `The reference runtime cannot load the definition: ${(error as Error).message}`, ["§2", "§3.1"], "Publish a resolved definition that the reference runtime's parser and filter chain accept.", {});
  }

  // C3.5 — data-only.
  const dataOnlyHits: Array<{ name: string; sample: string }> = [];
  for (const { name, pattern } of DATA_ONLY_PATTERNS) {
    const match = definitionText.match(pattern);
    if (match) dataOnlyHits.push({ name, sample: match[0].trim().slice(0, 80) });
  }
  if (dataOnlyHits.length) {
    for (const hit of dataOnlyHits) {
      f.fail("C3.5", `The published definition depends on a build-time or local feature (${hit.name}): "${hit.sample}".`, ["§2", "§2.2"],
        "Resolve includes and substitutions at build time and publish the expanded document; never reference publisher-only paths.", hit);
    }
  } else {
    f.pass("C3.5", "No include directives, substitutions, file URLs or local paths in the published definition.", ["§2", "§2.2"]);
  }
  // Unresolved {token} replacement strings after the runtime's commondefs expansion.
  if (network) {
    const strs = asRecord(asRecord(definition["commondefs"])?.["replacement_strings"]) ?? {};
    const unresolved = new Set<string>();
    for (const agent of asArray(network.config["tools"]) ?? []) {
      const instructions = asString(asRecord(agent)?.["instructions"]) ?? "";
      for (const match of instructions.matchAll(/\{([A-Za-z0-9_]+)\}/g)) {
        const token = match[1] as string;
        if (!(token in strs)) unresolved.add(token);
      }
    }
    if (unresolved.size) {
      f.warn("C3.5", `Instructions contain {token} placeholders with no commondefs.replacement_strings entry: ${[...unresolved].join(", ")}.`, ["§2"],
        "Define the tokens in commondefs.replacement_strings or remove them; the model otherwise sees the literal braces.", { unresolved: [...unresolved] });
    }
  }
  const codedTools = asRecord(manifest["coded_tools"]);
  const codedAgents = agents.filter((a) => typeof a.spec["class"] === "string").map((a) => a.name);
  if (codedAgents.length && !codedTools?.["bundle"]) {
    f.warn("C3.9", `Coded tools (${codedAgents.join(", ")}) are declared but the manifest has no coded_tools.bundle; the runtime fails closed and the tool is unavailable.`, ["§2.1", "§2.2", "§5"],
      "Publish the bundle and declare coded_tools.bundle (with an integrity digest), or remove the coded tools.", { codedAgents });
  }

  // C3.6 — private-context rules are explicit.
  const allowRules: Array<{ agent: string; direction: string; fields: unknown }> = [];
  for (const { name, spec } of agents) {
    const allow = asRecord(spec["allow"]);
    if (!allow) continue;
    for (const direction of ["to_downstream", "to_upstream"]) {
      const block = asRecord(allow[direction]);
      if (!block || !("sly_data" in block)) continue;
      const fields = block["sly_data"];
      allowRules.push({ agent: name, direction, fields });
      if (!Array.isArray(fields) || !fields.every((x) => typeof x === "string")) {
        f.fail("C3.6", `"${name}".allow.${direction}.sly_data must be an array of field names.`, ["§2.1", "§5"], 'Use e.g. "allow": { "to_downstream": { "sly_data": ["customer_id"] } }.', { agent: name, direction, fields });
      } else if (fields.includes("*")) {
        f.warn("C3.6", `"${name}".allow.${direction}.sly_data allows "*": every private-context field would cross the boundary.`, ["§2.1", "§5"], "Name the fields explicitly.", { agent: name, direction });
      }
    }
  }
  if (allowRules.length === 0) {
    f.pass("C3.6", "No allow rules: private context is deny-by-default across every boundary.", ["§2.1", "§5"]);
  } else if (!f.items.some((x) => x.id === "C3.6" && x.status === "fail")) {
    f.pass("C3.6", `${allowRules.length} explicit private-context allow rule(s).`, ["§2.1", "§5"], { rules: allowRules });
  }

  // C3.8 — secrets in public artifacts.
  const hits = [...scanSecrets(definitionText), ...scanSecrets(manifestText)];
  const keyedHits: Array<{ path: string; key: string }> = [];
  walk(definition, "definition", (path, key, value) => {
    if (SECRET_KEYS.test(key) && typeof value === "string" && value.trim() !== "") keyedHits.push({ path, key });
  });
  walk(manifest, "manifest", (path, key, value) => {
    if (SECRET_KEYS.test(key) && typeof value === "string" && value.trim() !== "") keyedHits.push({ path, key });
  });
  if (hits.length || keyedHits.length) {
    for (const hit of hits) f.fail("C3.8", `A credential-looking value (${hit.kind}) appears in a public artifact: ${hit.sample}.`, ["§2.2", "§4", "§5"], "Remove it and rotate the credential; published artifacts are public by design.", hit);
    for (const hit of keyedHits) f.fail("C3.8", `A field named "${hit.key}" with a non-empty value appears at ${hit.path}.`, ["§2.2", "§4"], "Keep credentials out of published files; use private context or a server-side capability.", hit);
  } else {
    f.pass("C3.8", "No credential-looking values in the manifest or definition.", ["§2.2", "§4", "§5"]);
  }

  // C3.11 — execution hints.
  const hints: Record<string, unknown> = {};
  for (const key of ["max_steps", "max_iterations", "max_execution_seconds", "llm_config"]) {
    if (key in definition) hints[key] = definition[key];
  }
  if (Object.keys(hints).length) {
    f.info("C3.11", `Network-level execution hints: ${Object.keys(hints).join(", ")}. Runtime-defined maximums still apply.`, ["§2.1", "§3.1"], hints);
  }

  // External references: plain-http non-loopback peers are not allowed in production.
  for (const ext of externals) {
    if (ext.origin === null) continue;
    const url = new URL(ext.origin);
    if (url.protocol === "http:" && !isLoopbackHost(url.hostname)) {
      f.fail("C3.3", `"${ext.agent}" references ${ext.kind} ${ext.ref} over plain http on a non-loopback host.`, ["§3.2.1"], "Reference peers over https.", { ...ext });
    }
  }
  void target;
  return { result: f.result(), network, runtimeErrors, externals };
}
