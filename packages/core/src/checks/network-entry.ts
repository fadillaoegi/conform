// C2 — the requested network entry: exact name, hocon resolves (CORS, parse), links.json, front_man
// consistent with what the reference runtime would run. Spec: §3.2.5, §3.2.6, §3.3.

import { parseHocon } from "@conform/reference-runtime/runtime/hocon.js";
import { find_front_man } from "@conform/reference-runtime/runtime/generated/graph.gen.mjs";
import { resolveUrl } from "@conform/reference-runtime/runtime/remote.js";
import { evaluateCors, fetchArtifact, isJsonContentType, type FetchOptions, type Fetched } from "../fetcher.ts";
import { asArray, asRecord, asString, Findings } from "../findings.ts";
import type { ArtifactInfo, JsonObject, NetworkEntry, Target } from "../types.ts";
import { isHttpUrl, isLoopbackHost, isSecureEnough } from "../url.ts";
import { artifactInfo } from "./manifest.ts";

export interface NetworkEntryCheck {
  result: ReturnType<Findings["result"]>;
  entry: NetworkEntry | null;
  definitionUrl: string | null;
  definitionText: string | null;
  definition: JsonObject | null;
  definitionArtifact: ArtifactInfo | null;
  linksArtifact: ArtifactInfo | null;
  /** links.json bindings for this network, reference -> URL. */
  links: Record<string, string>;
}

const empty = (f: Findings, extra: Partial<NetworkEntryCheck> = {}): NetworkEntryCheck => ({
  result: f.result(),
  entry: null,
  definitionUrl: null,
  definitionText: null,
  definition: null,
  definitionArtifact: null,
  linksArtifact: null,
  links: {},
  ...extra,
});

/** Parse a definition as JSON first (the published form), then as the HOCON subset the runtime accepts. */
export function parseDefinition(text: string): { value: JsonObject | null; format: "json" | "hocon" | null; error: string | null } {
  try {
    const value = asRecord(JSON.parse(text));
    if (value) return { value, format: "json", error: null };
    return { value: null, format: "json", error: "the document is valid JSON but not an object" };
  } catch {
    // Not JSON; try the HOCON subset.
  }
  try {
    const value = asRecord(parseHocon(text));
    if (value) return { value, format: "hocon", error: null };
    return { value: null, format: "hocon", error: "the document is not an object" };
  } catch (error) {
    return { value: null, format: null, error: (error as Error).message };
  }
}

export async function checkNetworkEntry(
  target: Target,
  manifest: JsonObject,
  entries: NetworkEntry[],
  fetchOptions: FetchOptions,
): Promise<NetworkEntryCheck> {
  const f = new Findings("C2", "Network entry: exact name, definition fetch, links.json, front agent", ["§3.2.5", "§3.2.6", "§3.3"], "static");

  // C2.1 — exact name.
  const names = entries.map((e) => e.name);
  let entry: NetworkEntry | null = null;
  if (target.networkName === null) {
    entry = entries[0] ?? null;
    if (entry) {
      f.info("C2.1", `No network name in the input; checking the first listed network "${entry.name}". Callers must name it exactly: ${target.siteBase}/${entry.name}.`, ["§3.2.1", "§3.2.5"], { networks: names });
    }
  } else {
    entry = entries.find((e) => e.name === target.networkName) ?? null;
    if (entry) {
      f.pass("C2.1", `The manifest lists a network named exactly "${target.networkName}".`, ["§3.2.5"], { requested: target.networkName, networks: names });
    } else {
      f.fail("C2.1", `The manifest lists no network named "${target.networkName}"; a caller MUST fail rather than run another one.`, ["§3.2.5"],
        `Use one of the published names (${names.join(", ") || "none"}) as the last path segment, or add the network to the manifest.`,
        { requested: target.networkName, networks: names });
    }
  }
  if (!entry) return empty(f);

  // C2.2 — hocon resolves, fetches, parses.
  if (!entry.hocon) {
    f.fail("C2.2", `The entry "${entry.name}" names no definition in "hocon".`, ["§3.2.6", "§3.3"], "Set hocon to the resolved network definition's path or URL.", { name: entry.name });
    return empty(f, { entry });
  }
  let definitionUrl: string;
  try {
    definitionUrl = new URL(resolveUrl(target.siteBase, entry.hocon)).href;
  } catch {
    f.fail("C2.2", `hocon "${entry.hocon}" does not resolve to a URL against ${target.siteBase}.`, ["§3.2.6"], "Use a relative path such as ./name.network.json or an absolute http(s) URL.", { hocon: entry.hocon });
    return empty(f, { entry });
  }
  const crossOrigin = new URL(definitionUrl).origin !== target.origin;
  if (crossOrigin) {
    f.info("C2.2", `The definition is hosted on another origin (${new URL(definitionUrl).origin}); that origin decides what the agents are told and must send CORS headers.`, ["§3.2.6", "§3.3"], { definitionUrl });
  }
  if (!isSecureEnough(definitionUrl)) {
    f.fail("C2.2", `The definition URL ${definitionUrl} is not https.`, ["§3.2.1", "§3.3"], "Host the definition over https (loopback http only for local development).", { definitionUrl });
  }
  const fetched: Fetched = await fetchArtifact(definitionUrl, fetchOptions);
  const evidence = { url: definitionUrl, finalUrl: fetched.finalUrl, status: fetched.status, contentType: fetched.contentType, error: fetched.error };
  if (fetched.crossOriginRedirect) {
    f.fail("C2.5", `The definition redirects to another origin: ${fetched.crossOriginRedirect}.`, ["§5", "§3.2.6"],
      "Serve the definition from the declared location; a cross-origin redirect is a new destination.", { ...evidence, redirects: fetched.redirects });
    return empty(f, { entry, definitionUrl, definitionArtifact: artifactInfo(fetched) });
  }
  if (fetched.error || fetched.status !== 200) {
    f.fail("C2.2", `The definition at ${definitionUrl} ${fetched.error ? `cannot be fetched: ${fetched.error}` : `answered HTTP ${fetched.status}, not 200`}.`, ["§3.2.6", "§3.3"],
      "Publish the resolved definition at the location the manifest declares.", evidence);
    return empty(f, { entry, definitionUrl, definitionArtifact: artifactInfo(fetched) });
  }
  const cors = evaluateCors(fetched, fetchOptions.callerOrigin);
  if (cors.ok) {
    f.pass("C2.3", `A caller on another origin can read the definition (${cors.reason}).`, ["§3.2", "§3.3", "§3.4"], { url: fetched.finalUrl, accessControlAllowOrigin: cors.header });
  } else {
    f.fail("C2.3", `A caller on another origin cannot read the definition: ${cors.reason}.`, ["§3.2", "§3.3", "§3.4"],
      "Serve the network definition with Access-Control-Allow-Origin: *.", { url: fetched.finalUrl, accessControlAllowOrigin: cors.header });
  }
  const parsed = parseDefinition(fetched.text);
  if (!parsed.value) {
    f.fail("C2.2", `The definition does not parse (${parsed.format ?? "neither JSON nor HOCON"}): ${parsed.error}.`, ["§2", "§3.2.6"],
      "Publish a fully resolved JSON document (the reference build writes <network>.network.json).", evidence);
    return empty(f, { entry, definitionUrl, definitionText: fetched.text, definitionArtifact: artifactInfo(fetched) });
  }
  f.pass("C2.2", `The definition fetched (HTTP 200) and parsed as ${parsed.format?.toUpperCase()}.`, ["§3.2.6", "§3.3"],
    { ...evidence, format: parsed.format, sha256: fetched.sha256, bytes: fetched.bytes });
  if (parsed.format === "hocon") {
    f.warn("C2.2", "The definition is HOCON, not JSON. Browser loading expects the resolved JSON serialization; the reference runtime parses only a HOCON subset.", ["§2", "§3.3"],
      "Publish the resolved definition as JSON (.network.json) and point hocon at it.", { format: "hocon" });
  } else if (!isJsonContentType(fetched.contentType)) {
    f.warn("C2.2", `The definition is served as "${fetched.contentType ?? "(none)"}", not application/json.`, ["§3.3"], "Serve .json files with Content-Type: application/json.", { contentType: fetched.contentType });
  }
  const definition = parsed.value;

  // C2.4 — front_man consistent with the runtime.
  const tools = asArray(definition["tools"]) ?? [];
  const agentNames = tools.map((t) => asString(asRecord(t)?.["name"])).filter((n): n is string => n !== null);
  const runtimeFront = find_front_man(definition);
  if (entry.front_man === null) {
    f.fail("C2.4", "The manifest entry has no front_man.", ["§2.1", "§3.3"], "Name the front agent in the manifest.", { name: entry.name });
  } else if (!agentNames.includes(entry.front_man)) {
    f.fail("C2.4", `front_man "${entry.front_man}" is not an agent in the definition.`, ["§2.1", "§3.3"],
      `Set front_man to the network's entry agent (agents: ${agentNames.join(", ") || "none"}).`, { front_man: entry.front_man, agents: agentNames });
  } else if (runtimeFront !== entry.front_man) {
    f.fail("C2.4", `The manifest names front_man "${entry.front_man}", but the reference runtime would run "${runtimeFront}" (the first agent with instructions).`, ["§2.1", "§3.3"],
      `Put the front agent first in tools[] (or make it the first agent with instructions) so runtimes and the manifest agree.`, { front_man: entry.front_man, runtimeFrontMan: runtimeFront });
  } else {
    f.pass("C2.4", `front_man "${entry.front_man}" exists and is the agent the reference runtime selects.`, ["§2.1", "§3.3"], { front_man: entry.front_man });
  }

  // C2.6 — links.json (optional).
  const linksUrl = `${target.siteBase}/links.json`;
  const linksFetched = await fetchArtifact(linksUrl, fetchOptions);
  let links: Record<string, string> = {};
  let linksArtifact: ArtifactInfo | null = null;
  if (linksFetched.error || linksFetched.status === 404) {
    f.info("C2.6", "No links.json published (optional: only needed when the definition uses symbolic peer references).", ["§3.3"], { url: linksUrl, status: linksFetched.status });
  } else if (linksFetched.status !== 200) {
    f.warn("C2.6", `links.json answered HTTP ${linksFetched.status}; the reference runtime then ignores it.`, ["§3.3"], "Publish links.json with HTTP 200 or remove it.", { url: linksUrl, status: linksFetched.status });
  } else {
    linksArtifact = artifactInfo(linksFetched);
    const linksCors = evaluateCors(linksFetched, fetchOptions.callerOrigin);
    if (!linksCors.ok) {
      f.fail("C2.6", `links.json is published but a caller on another origin cannot read it: ${linksCors.reason}.`, ["§3.3"], "Serve links.json with Access-Control-Allow-Origin: *.", { url: linksUrl, accessControlAllowOrigin: linksCors.header });
    }
    let doc: JsonObject | null = null;
    try {
      doc = asRecord(JSON.parse(linksFetched.text));
    } catch (error) {
      f.fail("C2.6", `links.json is not valid JSON: ${(error as Error).message}`, ["§3.3"], "Fix the JSON.", { url: linksUrl });
    }
    if (doc) {
      const networksMap = asRecord(doc["networks"]);
      if (typeof doc["version"] !== "number") {
        f.warn("C2.6", "links.json has no numeric version.", ["§3.3"], 'Add "version": 1.', { url: linksUrl });
      }
      if (!networksMap) {
        f.fail("C2.6", "links.json has no networks object.", ["§3.3"], 'Use { "version": 1, "networks": { "<network>": { "<reference>": "<peer network URL>" } } }.', { url: linksUrl });
      } else {
        const mine = asRecord(networksMap[entry.name]);
        if (!mine) {
          f.info("C2.6", `links.json has no bindings for "${entry.name}".`, ["§3.3"], { url: linksUrl, networks: Object.keys(networksMap) });
        } else {
          for (const [reference, value] of Object.entries(mine)) {
            const text = asString(value);
            if (text === null || !isHttpUrl(text)) {
              f.fail("C2.6", `links.json binding "${reference}" is not an http(s) URL.`, ["§3.3"], "Bind each reference to a peer network URL (site base + network name).", { reference, value });
              continue;
            }
            const url = new URL(text);
            if (url.pathname.endsWith("/") || url.search || url.hash) {
              f.fail("C2.6", `links.json binding "${reference}" (${text}) must end in the network name with no trailing slash, query or fragment.`, ["§3.2.1", "§3.3"], "Use <site base>/<network name>.", { reference, value: text });
            }
            if (url.protocol === "http:" && !isLoopbackHost(url.hostname)) {
              f.fail("C2.6", `links.json binding "${reference}" uses plain http on a non-loopback host.`, ["§3.2.1"], "Use https for peers.", { reference, value: text });
            }
            links[reference] = text;
          }
          f.pass("C2.6", `links.json read: ${Object.keys(mine).length} binding(s) for "${entry.name}".`, ["§3.3"], { url: linksUrl, bindings: Object.keys(mine) });
        }
      }
    }
  }

  // C2.7 — the reference runtime's linking.exports (extension): aliases must map to the same name.
  const linking = asRecord(manifest["linking"]);
  const exportsList = linking ? asArray(linking["exports"]) ?? [] : [];
  for (const item of exportsList) {
    const exp = asRecord(item);
    if (!exp) continue;
    const net = asString(exp["network"]);
    const url = asString(exp["url"]);
    if (net === entry.name && url !== null && url !== entry.name && !url.endsWith(`/${entry.name}`)) {
      f.warn("C2.7", `linking.exports for "${entry.name}" has url "${url}", which differs from the network name.`, ["§3.2.5", "§7"],
        "Keep the export url equal to the network name so URL-based resolution and discovery metadata agree.", { url, network: net });
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
    links,
  };
}
