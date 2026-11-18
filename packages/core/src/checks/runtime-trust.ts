// C7 key confinement, C8 private context, C9 consent. Three scripted turns run the site's network as a
// peer inside a synthetic caller on the pinned reference runtime (see harness/turn.ts). Spec: §3.2.2,
// §3.2.4, §3.2.7, §3.4, §4, §5, §6.

import { fetchArtifact, inBrowser, type FetchOptions } from "../fetcher.ts";
import { asArray, asRecord, Findings } from "../findings.ts";
import { ALLOWED_FIELD, runScriptedTurn, type TurnResult } from "../harness/turn.ts";
import type { FetchLike } from "../fetcher.ts";
import type { JsonObject, NetworkEntry, Target } from "../types.ts";

export interface RuntimeTrustChecks {
  c7: ReturnType<Findings["result"]>;
  c8: ReturnType<Findings["result"]>;
  c9: ReturnType<Findings["result"]>;
}

function unique(keys: string[][]): string[][] {
  const seen = new Set<string>();
  return keys.filter((k) => {
    const id = JSON.stringify(k);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function requestSummary(turn: TurnResult): Record<string, unknown> {
  const count = (kind: string) => turn.requests.filter((r) => r.kind === kind).length;
  return {
    routerRequests: count("router"),
    siteRequests: turn.requests.filter((r) => r.kind === "target").map((r) => `${r.method} ${r.path}`),
    peerRouterRequests: count("peer-router"),
    otherOriginRequests: count("other"),
  };
}

function untestableAll(f: Findings, id: string, spec: string[], turn: TurnResult): void {
  f.untestable(id, `The site's network did not run in the caller's runtime${turn.error ? `: ${turn.error}` : ""}. Fix C4 first.`, spec,
    { error: turn.error, ...requestSummary(turn) });
}

function checkKey(allow: TurnResult, override: TurnResult): ReturnType<Findings["result"]> {
  const f = new Findings("C7", "The visitor's key never reaches the site, and the site cannot change the router", ["§3.2.2", "§3.4", "§4", "§6"], "harness");
  if (!allow.peerRan) {
    untestableAll(f, "C7.1", ["§3.2.2", "§4"], allow);
    return f.result();
  }
  const leaks = allow.requests.filter((r) => r.kind !== "router" && (r.keyInAuthorization || r.keyInUrl || r.keyInOtherHeaders || r.keyInBody));
  const siteCreds = allow.requests.filter((r) => r.kind === "target" && (r.hasAuthorization || r.hasCookie));
  const routerOk = allow.requests.filter((r) => r.kind === "router" && r.method === "POST").every((r) => r.keyInAuthorization);
  if (leaks.length === 0 && siteCreds.length === 0 && routerOk) {
    f.pass("C7.1", `With a visitor key active, only the caller's router received it (in the Authorization header). The site received ${allow.requests.filter((r) => r.kind === "target").length} request(s) for its public files, with no Authorization header, no cookie and no key in any URL, header or body.`,
      ["§3.2.2", "§3.4", "§4", "§6"], requestSummary(allow));
  } else {
    f.fail("C7.1", "The visitor's key or credentials reached something other than the caller's router.", ["§3.2.2", "§3.4", "§4"],
      "A runtime must attach the key only to model requests sent to the selected router.",
      { leaks: leaks.map((r) => ({ kind: r.kind, origin: r.origin, path: r.path })), siteRequestsWithCredentials: siteCreds.map((r) => r.path), ...requestSummary(allow) });
  }
  const peerCalls = allow.requests.filter((r) => r.kind === "router" && r.role === "peer").length;
  f.pass("C7.2", `The site's network ran locally in the caller's browser on the caller's router (${peerCalls} model request(s) from the site's agents, all to the caller's router).`, ["§3.2.2", "§6"], { peerModelRequests: peerCalls });
  if (!override.peerRan) {
    f.untestable("C7.3", `The router-override run did not reach the site's network${override.error ? `: ${override.error}` : ""}.`, ["§4"], requestSummary(override));
  } else if (override.requests.some((r) => r.kind === "peer-router")) {
    f.fail("C7.3", "When the site's manifest names its own router, the caller's runtime used it.", ["§3.2.2", "§4"],
      "Router metadata in a peer manifest is informational during composition and MUST NOT override the caller's router.", requestSummary(override));
  } else {
    f.pass("C7.3", "Served with a manifest that names a different router, the site's network still ran only on the caller's router; the named router was never contacted.", ["§3.2.2", "§4"], requestSummary(override));
  }
  const inPrompts = allow.requests.some((r) => r.kind === "router" && r.keyInBody);
  if (allow.keyInTrace || inPrompts) {
    f.fail("C7.4", `The key appears in ${allow.keyInTrace ? "the runtime's trace" : ""}${allow.keyInTrace && inPrompts ? " and " : ""}${inPrompts ? "a prompt" : ""}.`, ["§4"],
      "Keep the key out of prompts, traces and analytics.", { keyInTrace: allow.keyInTrace, keyInPrompt: inPrompts });
  } else {
    f.pass("C7.4", "The key appears in no prompt and nowhere in the runtime's trace.", ["§4"], { keyInTrace: false, keyInPrompt: false });
  }
  f.info("C7.5", "This proves what a caller on the reference runtime does with the site as a peer. It cannot prove what the site's own page does with its visitors' keys; that depends on the runtime the site ships (C10, planned).", ["§4"]);
  return f.result();
}

function checkPrivate(allow: TurnResult, allowField: TurnResult, definition: JsonObject): ReturnType<Findings["result"]> {
  const f = new Findings("C8", "Private context stays with the caller unless a field is explicitly allowed", ["§2.1", "§3.2.7", "§5", "§6"], "harness");
  if (!allow.peerRan) {
    untestableAll(f, "C8.1", ["§3.2.7"], allow);
    return f.result();
  }
  const sent = unique(allow.remotePayloadKeys);
  const atSite = allow.requests.some((r) => (r.kind === "target" || (r.kind === "router" && r.role === "peer")) && r.privateInBody);
  if (sent.every((k) => k.length === 0) && !atSite) {
    f.pass("C8.1", "With no allow rule, the site's network received no private-context fields, and the private value never appeared in its prompts or requests.", ["§3.2.7", "§5", "§6"],
      { fieldsSentToSite: sent, privateValueAtSite: false });
  } else {
    f.fail("C8.1", "Private context reached the site's network without an allow rule.", ["§3.2.7", "§5"],
      "Private-context fields MUST NOT pass between network invocations by default.", { fieldsSentToSite: sent, privateValueAtSite: atSite });
  }
  if (!allowField.peerRan) {
    f.untestable("C8.2", "The allow-rule run did not reach the site's network.", ["§5"], requestSummary(allowField));
  } else {
    const keys = unique(allowField.remotePayloadKeys);
    const ok = keys.length > 0 && keys.every((k) => k.length === 1 && k[0] === ALLOWED_FIELD);
    const leaked = allowField.requests.some((r) => (r.kind === "target" || (r.kind === "router" && r.role === "peer")) && r.privateInBody);
    if (ok && !leaked) {
      f.pass("C8.2", `With the caller allowing only "${ALLOWED_FIELD}", exactly that field crossed to the site's network and the other private value did not.`, ["§5", "§6"], { fieldsSentToSite: keys });
    } else {
      f.fail("C8.2", "The caller's allow rule did not limit private context to the named field.", ["§5"],
        "Only explicitly named fields may be forwarded under an applicable allow rule.", { fieldsSentToSite: keys, otherPrivateValueAtSite: leaked });
    }
  }
  const upstream: Array<{ agent: unknown; fields: unknown }> = [];
  for (const agent of asArray(definition["tools"]) ?? []) {
    const spec = asRecord(agent);
    const fields = asRecord(asRecord(spec?.["allow"])?.["to_upstream"])?.["sly_data"];
    if (fields !== undefined) upstream.push({ agent: spec?.["name"], fields });
  }
  if (upstream.length) {
    f.info("C8.3", `The site's network declares upstream private-context rules; a caller only keeps fields its own network permits.`, ["§3.2.7"], { upstream });
  } else {
    f.info("C8.3", "The site's network declares no upstream private-context fields, so its answers return only through the ordinary tool-result text.", ["§3.2.7"]);
  }
  if (allow.privateInTrace) {
    f.warn("C8.4", "The private value appears in the runtime's trace.", ["§5"], "Traces should not expose private context; check the runtime's redaction.", {});
  }
  return f.result();
}

/** Look for the consent wiring in the site's page: the reference boot() mounts the consent card. */
async function pageConsentWiring(target: Target, fetchOptions: FetchOptions): Promise<{ status: "found" | "missing" | "unknown"; detail: Record<string, unknown> }> {
  if (inBrowser()) return { status: "unknown", detail: { reason: "a browser on another origin cannot read the site's page and scripts (no CORS on pages)" } };
  const page = await fetchArtifact(`${target.siteBase}/`, fetchOptions);
  if (page.status !== 200 || !/html/i.test(page.contentType ?? "")) return { status: "unknown", detail: { url: `${target.siteBase}/`, status: page.status } };
  const sources = [...page.text.matchAll(/<script\b[^>]*\btype\s*=\s*["']?module["']?[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1] as string).slice(0, 6);
  const scanned: string[] = [];
  const haystacks = [page.text];
  // Scan the page's module scripts and, one level down, the same-origin chunks they import.
  const queue: string[] = sources.map((src) => new URL(src, `${target.siteBase}/`).href);
  const seen = new Set<string>();
  while (queue.length && scanned.length < 12) {
    const href = queue.shift() as string;
    if (seen.has(href)) continue;
    seen.add(href);
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    if (url.origin !== target.origin) continue;
    const script = await fetchArtifact(url.href, fetchOptions);
    if (script.status !== 200 || script.bytes >= 1_500_000) continue;
    scanned.push(url.pathname);
    haystacks.push(script.text);
    if (sources.some((src) => new URL(src, `${target.siteBase}/`).href === href)) {
      for (const m of script.text.matchAll(/(?:import\(\s*|from\s*)["']([^"']+\.m?js)["']/g)) {
        try {
          queue.push(new URL(m[1] as string, url).href);
        } catch {
          // Not a URL; skip it.
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

async function checkConsent(allow: TurnResult, decline: TurnResult, target: Target, fetchOptions: FetchOptions): Promise<ReturnType<Findings["result"]>> {
  const f = new Findings("C9", "Consent comes before every contact, and a decline sends nothing", ["§3.2.4", "§5", "§6"], "harness");
  const first = allow.consents[0];
  const host = new URL(target.siteBase).host;
  if (!first) {
    f.fail("C9.1", "The caller's runtime contacted the site without asking for consent.", ["§3.2.4", "§5"],
      "An interactive runtime MUST obtain the user's approval before each contact with a third-party origin.", requestSummary(allow));
  } else if (first.targetRequestsBefore === 0 && first.peerOrigin === host && first.requestText.trim()) {
    f.pass("C9.1", `Consent was requested before any request to the site, naming the destination (${first.peerOrigin}) and the request text.`, ["§3.2.4", "§5", "§6"],
      { peerOrigin: first.peerOrigin, peerLabel: first.peerLabel, requestPreview: first.requestText.slice(0, 80), siteRequestsBeforeConsent: 0 });
  } else {
    f.fail("C9.1", "Consent did not precede the first contact or did not name the destination.", ["§3.2.4", "§5"],
      "Identify the destination origin and purpose, and ask before the first request.", { consent: first });
  }
  const declinedRequests = decline.requests.filter((r) => r.kind === "target").length;
  if (decline.consents.length && declinedRequests === 0) {
    f.pass("C9.2", "When the visitor declines, the site receives no request at all and the caller is told the contact was declined.", ["§3.2.4", "§5"],
      { siteRequestsAfterDecline: 0, toolResult: decline.peerToolResult?.slice(0, 120) ?? null });
  } else {
    f.fail("C9.2", `After a decline the site still received ${declinedRequests} request(s).`, ["§3.2.4", "§5"], "A declined contact must send nothing.", requestSummary(decline));
  }
  const wiring = await pageConsentWiring(target, fetchOptions);
  if (wiring.status === "found") {
    f.pass("C9.3", "The site's page boots the reference runtime UI or sets its own consent handler, so its visitors get a consent card.", ["§3.2.4"], wiring.detail);
  } else if (wiring.status === "missing") {
    f.warn("C9.3", "The site's home page does not visibly boot the reference runtime UI or set a consent handler. The reference engine allows every contact when no handler is attached.", ["§3.2.4"],
      "Boot the runtime with its UI (runtime/index.js boot()) or set engine.onConsent before the first message.", wiring.detail);
  } else {
    // C9.1 and C9.2 already prove the runtime behavior; this only concerns the site's own page.
    f.info("C9.3", "Could not read the site's page to see how its own visitors are asked (the CLI can read it); check the consent card in a browser.", ["§3.2.4"], wiring.detail);
  }
  return f.result();
}

export async function checkRuntimeTrust(
  target: Target,
  manifest: JsonObject,
  entry: NetworkEntry,
  definition: JsonObject,
  fetchOptions: FetchOptions,
  fetchImpl?: FetchLike,
): Promise<RuntimeTrustChecks> {
  const base = { targetBase: target.siteBase, targetName: entry.name, targetManifest: manifest };
  const withFetch = fetchImpl ? { fetch: fetchImpl } : {};
  const allow = await runScriptedTurn({ ...base, ...withFetch, consent: "allow" });
  const decline = await runScriptedTurn({ ...base, ...withFetch, consent: "decline" });
  const extra = await runScriptedTurn({ ...base, ...withFetch, consent: "allow", allowField: true, peerRouterOverride: true });
  return {
    c7: checkKey(allow, extra),
    c8: checkPrivate(allow, extra, definition),
    c9: await checkConsent(allow, decline, target, fetchOptions),
  };
}
