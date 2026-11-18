// C1 — agent-manifest.json: reachable, JSON, CORS, required fields, HTTPS, no cross-origin redirect.
// Spec: §3.2.1, §3.2.5, §3.3 (minimum public files), §3.4, §5 (explicit destinations).

import { evaluateCors, fetchArtifact, isJsonContentType, type FetchOptions, type Fetched } from "../fetcher.ts";
import { asArray, asRecord, asString, Findings } from "../findings.ts";
import type { ArtifactInfo, JsonObject, NetworkEntry, Target } from "../types.ts";
import { isHttpUrl, isLoopbackHost, isSecureEnough } from "../url.ts";

export interface ManifestCheck {
  result: ReturnType<Findings["result"]>;
  manifest: JsonObject | null;
  entries: NetworkEntry[];
  fetched: Fetched | null;
  artifact: ArtifactInfo | null;
}

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

export function artifactInfo(fetched: Fetched): ArtifactInfo {
  return {
    url: fetched.requestedUrl,
    finalUrl: fetched.finalUrl,
    status: fetched.status,
    contentType: fetched.contentType,
    sha256: fetched.sha256,
    bytes: fetched.bytes,
  };
}

export function readEntries(manifest: JsonObject): NetworkEntry[] {
  const networks = asArray(manifest["networks"]) ?? [];
  const entries: NetworkEntry[] = [];
  for (const item of networks) {
    const raw = asRecord(item);
    if (!raw) continue;
    const name = asString(raw["name"]);
    if (name === null) continue;
    entries.push({ name, front_man: asString(raw["front_man"]), hocon: asString(raw["hocon"]), raw });
  }
  return entries;
}

/** Check origin-shaped strings such as allowed_peers entries. */
function checkOriginList(f: Findings, id: string, label: string, list: unknown[], spec: string[]): void {
  list.forEach((value, index) => {
    const text = asString(value);
    const path = `${label}[${index}]`;
    if (text === null || !isHttpUrl(text)) {
      f.fail(id, `${path} is not an http(s) origin.`, spec, `Use an origin such as "https://partner.example".`, { path, value });
      return;
    }
    const url = new URL(text);
    if (url.pathname !== "/" || url.search || url.hash) {
      f.warn(id, `${path} has a path, query or fragment; the reference runtime compares origins only.`, spec,
        `Use the origin alone: "${url.origin}".`, { path, value: text, origin: url.origin });
    }
    if (url.protocol === "http:" && !isLoopbackHost(url.hostname)) {
      f.warn(id, `${path} is a plain-http origin on a non-loopback host.`, ["§3.2.1", "§3.3"],
        "Production peers must be https; http is only for loopback development.", { path, value: text });
    } else if (url.protocol === "http:") {
      f.info(id, `${path} is a loopback http origin; it only works on the publisher's machine.`, spec, { path, value: text });
    }
  });
}

export async function checkManifest(target: Target, fetchOptions: FetchOptions): Promise<ManifestCheck> {
  const f = new Findings("C1", "Manifest: reachable, JSON, CORS, required fields, HTTPS", ["§3.2.1", "§3.2.5", "§3.3", "§3.4", "§5"], "static");
  const manifestUrl = `${target.siteBase}/agent-manifest.json`;

  // C1.4 — HTTPS unless loopback.
  const baseUrl = new URL(target.siteBase);
  if (!isSecureEnough(target.siteBase)) {
    f.fail("C1.4", `The site base ${target.siteBase} is not https.`, ["§3.2.1", "§3.3"],
      "Production deployments MUST use HTTPS; loopback http is acceptable only for local development.", { siteBase: target.siteBase });
  } else if (baseUrl.protocol === "http:") {
    f.info("C1.4", `Loopback http base (${baseUrl.host}); accepted for local development only.`, ["§3.2.1", "§3.3"], { siteBase: target.siteBase });
  } else {
    f.pass("C1.4", "The site base uses https.", ["§3.2.1", "§3.3"], { siteBase: target.siteBase });
  }

  // C1.1 — GET, 200, JSON object.
  const fetched = await fetchArtifact(manifestUrl, fetchOptions);
  const evidence = { url: manifestUrl, finalUrl: fetched.finalUrl, status: fetched.status, contentType: fetched.contentType, error: fetched.error };
  if (fetched.crossOriginRedirect) {
    f.fail("C1.5", `agent-manifest.json redirects to another origin: ${fetched.crossOriginRedirect}.`, ["§5", "§3.2.6"],
      "Serve the manifest from the site base itself; a redirect to another origin is a new destination that needs its own consent.",
      { ...evidence, redirects: fetched.redirects });
    return { result: f.result(), manifest: null, entries: [], fetched, artifact: artifactInfo(fetched) };
  }
  if (fetched.redirects.length) {
    f.warn("C1.5", `agent-manifest.json redirects ${fetched.redirects.length} time(s) on its own origin.`, ["§3.2.6"],
      "Serve the manifest directly at the site base so callers need no redirect.", { ...evidence, redirects: fetched.redirects });
  } else {
    f.pass("C1.5", "No redirect when fetching the manifest.", ["§5"], { url: manifestUrl });
  }
  if (fetched.error) {
    f.fail("C1.1", `agent-manifest.json cannot be fetched: ${fetched.error}.`, ["§3.3"],
      "Publish agent-manifest.json at the site base and make sure the host is reachable.", evidence);
    return { result: f.result(), manifest: null, entries: [], fetched, artifact: artifactInfo(fetched) };
  }
  if (fetched.status !== 200) {
    f.fail("C1.1", `agent-manifest.json answered HTTP ${fetched.status}, not 200.`, ["§3.3"],
      "The folder before the network name must hold agent-manifest.json.", evidence);
    return { result: f.result(), manifest: null, entries: [], fetched, artifact: artifactInfo(fetched) };
  }
  let manifest: JsonObject | null = null;
  try {
    manifest = asRecord(JSON.parse(fetched.text));
  } catch (error) {
    f.fail("C1.1", `agent-manifest.json is not valid JSON: ${(error as Error).message}`, ["§3.3"],
      "Fix the JSON; validate it with a JSON linter.", evidence);
    return { result: f.result(), manifest: null, entries: [], fetched, artifact: artifactInfo(fetched) };
  }
  if (manifest === null) {
    f.fail("C1.1", "agent-manifest.json is valid JSON but not an object.", ["§3.3"], "The manifest must be a JSON object.", evidence);
    return { result: f.result(), manifest: null, entries: [], fetched, artifact: artifactInfo(fetched) };
  }
  f.pass("C1.1", "agent-manifest.json fetched: HTTP 200, valid JSON object.", ["§3.3"], { ...evidence, sha256: fetched.sha256, bytes: fetched.bytes });
  if (!isJsonContentType(fetched.contentType)) {
    f.warn("C1.1", `The manifest is served as "${fetched.contentType ?? "(none)"}", not application/json.`, ["§3.3"],
      "Serve .json files with Content-Type: application/json.", { contentType: fetched.contentType });
  }

  // C1.2 — CORS for callers on other origins.
  const cors = evaluateCors(fetched, fetchOptions.callerOrigin);
  if (cors.ok) {
    f.pass("C1.2", `A caller on another origin can read the manifest (${cors.reason}).`, ["§3.2", "§3.3", "§3.4"],
      { url: fetched.finalUrl, accessControlAllowOrigin: cors.header, callerOrigin: fetchOptions.callerOrigin });
  } else {
    f.fail("C1.2", `A caller on another origin cannot read the manifest: ${cors.reason}.`, ["§3.2", "§3.3", "§3.4"],
      "Serve agent-manifest.json with Access-Control-Allow-Origin: * (public artifacts only, never business endpoints).",
      { url: fetched.finalUrl, accessControlAllowOrigin: cors.header, callerOrigin: fetchOptions.callerOrigin });
  }

  // C1.6 — no credentials were needed.
  f.info("C1.6", "The manifest was fetched without credentials, as a caller's public artifact request must be.", ["§3.4"],
    { credentials: "omit" });

  // C1.3 — required fields.
  const spec33 = ["§3.3"];
  const networks = asArray(manifest["networks"]);
  const entries = readEntries(manifest);
  if (!networks || networks.length === 0) {
    f.fail("C1.3", "The manifest lists no networks (networks[] missing or empty).", spec33,
      "List at least one network with name, front_man and hocon.", { path: "networks" });
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
        f.fail("C1.3", `${path}.name "${name}" cannot be a URL path segment.`, ["§3.2.1", "§3.3"],
          "Use letters, digits, '_', '-' or '.' only; the name is the final path component of the network URL.", { path, name });
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
      f.pass("C1.3", `${entries.length} network(s) listed with name, front_man and hocon.`, spec33,
        { networks: entries.map((e) => ({ name: e.name, front_man: e.front_man, hocon: e.hocon })) });
    }
  }
  const router = asRecord(manifest["llm_router"]);
  if (!router) {
    f.fail("C1.3", "llm_router is missing; the manifest must carry the top site's router metadata.", ["§3.3", "§4"],
      'Add "llm_router": { "base_url": "<default router>", "byok_router": "<router for user keys>" }.', { path: "llm_router" });
  } else {
    const baseUrl = asString(router["base_url"]);
    const byok = asString(router["byok_router"]);
    const mock = router["mock"] === true;
    if (baseUrl === null && byok === null) {
      f.fail("C1.3", "llm_router has neither base_url nor byok_router.", ["§3.3", "§4"],
        "Declare a default router (base_url) and/or a BYOK router (byok_router).", { path: "llm_router", value: router });
    } else {
      if (baseUrl !== null && baseUrl !== "browser://mock" && !isHttpUrl(baseUrl)) {
        f.fail("C1.3", `llm_router.base_url "${baseUrl}" is not an http(s) URL.`, ["§3.3", "§4"], "Use the router's https base URL.", { path: "llm_router.base_url" });
      }
      if (byok !== null && !isHttpUrl(byok)) {
        f.fail("C1.3", `llm_router.byok_router "${byok}" is not an http(s) URL.`, ["§3.3", "§4"], "Use the BYOK router's https base URL.", { path: "llm_router.byok_router" });
      }
      f.pass("C1.3", `Router metadata present (default: ${baseUrl ?? "none"}; BYOK: ${byok ?? "not offered"}${mock ? "; mock" : ""}).`, ["§3.3", "§4"],
        { base_url: baseUrl, byok_router: byok, mock });
      if (byok === null) {
        f.info("C1.3", "No byok_router: BYOK is not offered; the published default router must run the network (§4).", ["§4"]);
      }
    }
  }
  const policy = asRecord(manifest["peer_policy"]) ?? asRecord(manifest["web_policy"]);
  const allowed = asArray(manifest["allowed_peers"]);
  const mode = policy ? asString(policy["mode"]) : null;
  if (!policy && !allowed) {
    f.fail("C1.3", "No peer policy: neither peer_policy nor allowed_peers is present.", ["§3.3"],
      'Add "peer_policy": { "mode": "closed" } and "allowed_peers": [] (or the origins the network may contact).', { path: "peer_policy" });
  } else {
    if (policy && mode !== "open" && mode !== "closed") {
      f.fail("C1.3", `peer_policy.mode is ${JSON.stringify(mode)}; it must be "open" or "closed".`, ["§3.3"],
        'Set peer_policy.mode to "closed" (allowed_peers only) or "open" (any origin except deny_origins).', { path: "peer_policy.mode" });
    }
    if (allowed) checkOriginList(f, "C1.3", "allowed_peers", allowed, ["§3.3"]);
    const deny = policy ? asArray(policy["deny_origins"] ?? policy["denied_origins"]) : null;
    if (deny) checkOriginList(f, "C1.3", "peer_policy.deny_origins", deny, ["§3.3"]);
    if (mode === "open") {
      f.warn("C1.3", "peer_policy.mode is \"open\": the network may contact any origin not denied.", ["§3.3", "§5"],
        'Prefer "closed" with an explicit allowed_peers list so visitors see a bounded set of destinations.', { deny_origins: deny ?? [] });
    }
    f.pass("C1.3", `Peer policy present (mode: ${mode ?? "closed by allowed_peers"}; allowed_peers: ${allowed ? allowed.length : 0}).`, ["§3.3"],
      { mode, allowed_peers: allowed ?? [] });
  }

  // Extensions the reference implementation adds: report as info only.
  const ext = ["linking", "agent_mcp", "deployment", "actions", "coded_tools", "theme", "brand"].filter((k) => k in manifest);
  if (ext.length) {
    f.info("C1.7", `Reference-implementation extension fields present: ${ext.join(", ")}. They are not spec requirements.`, ["§3.3", "§7"], { fields: ext });
  }
  const actions = asRecord(manifest["actions"]);
  if (actions && !asString(actions["bridge"])) {
    f.warn("C1.7", "actions is declared without actions.bridge: a caller on the reference runtime waits 10 s for a bridge and never runs the network.", ["§7"],
      'Build the site with the agentify-website skill so bridge/action-bridge.html exists, and set actions.bridge to "./bridge/action-bridge.html".', { path: "actions.bridge" });
  }

  return { result: f.result(), manifest, entries, fetched, artifact: artifactInfo(fetched) };
}
