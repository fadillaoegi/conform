// C6 — a denied origin fails closed in the caller's runtime, and the site's own peer references are
// consistent with its peer policy. Spec: §2.1 (fail closed), §3.2.9, §3.3 (peer policy), §5.

import { manifestAllowsPeer } from "@conform/reference-runtime/runtime/engine.js";
import { asArray, asRecord, asString, Findings } from "../findings.ts";
import { errorText, withHarness, type HarnessOptions } from "../harness/caller.ts";
import type { JsonObject, NetworkEntry, Target } from "../types.ts";
import type { DefinitionCheck } from "./definition.ts";
import { originOf } from "../url.ts";

export interface OriginPolicyCheck {
  result: ReturnType<Findings["result"]>;
}

export async function checkOriginPolicy(
  target: Target,
  manifest: JsonObject,
  entry: NetworkEntry,
  externals: DefinitionCheck["externals"],
  fetchImpl?: HarnessOptions["fetch"],
): Promise<OriginPolicyCheck> {
  const f = new Findings("C6", "Denied origins fail closed; peer references match the peer policy", ["§2.1", "§3.2.9", "§3.3", "§5"], "harness");
  const targetUrl = `${target.siteBase}/${entry.name}`;

  // C6.1 — closed policy without the site: refused before any contact.
  const closed: HarnessOptions = { targetBase: target.siteBase, targetName: entry.name, targetManifest: manifest, policy: { mode: "closed", allowedPeers: [] } };
  // C6.2 — open policy with the site denied: refused before any contact.
  const denied: HarnessOptions = { targetBase: target.siteBase, targetName: entry.name, targetManifest: manifest, policy: { mode: "open", allowedPeers: [], denyOrigins: [target.origin] } };
  if (fetchImpl) {
    closed.fetch = fetchImpl;
    denied.fetch = fetchImpl;
  }
  for (const [id, options, label] of [["C6.1", closed, "a closed policy that does not list the site"], ["C6.2", denied, "an open policy that denies the site"]] as const) {
    try {
      await withHarness(options, async (h) => {
        const mark = h.mark();
        try {
          await h.engine.resolveRemote(targetUrl, [h.callerKey], null, h.callerManifest);
          f.fail(id, `Under ${label}, the runtime still loaded ${targetUrl}.`, ["§3.2.9", "§5"], "The per-hop policy gate must refuse origins outside the caller's allowed_peers.", { policy: options.policy });
        } catch (error) {
          const requests = h.since(mark).filter((r) => r.served === "target").map((r) => r.url);
          const message = errorText(error);
          if (/^Policy:/.test(message) && requests.length === 0) {
            f.pass(id, `Under ${label}, the call is refused with a visible error before any contact: ${message}`, ["§3.2.9", "§5"], { policy: options.policy, error: message, targetRequests: requests });
          } else {
            f.warn(id, `Under ${label}, the call stopped but not as expected (${requests.length} target request(s)): ${message}`, ["§3.2.9", "§5"], "Check the runtime's policy gate.", { policy: options.policy, error: message, targetRequests: requests });
          }
        }
      });
    } catch (error) {
      f.untestable(id, `The harness could not start: ${errorText(error)}`, ["§3.2.9"], { error: errorText(error) });
    }
  }

  // C6.3 — the site's own references versus its own policy (what its runtime would allow).
  const policy = asRecord(manifest["peer_policy"]) ?? asRecord(manifest["web_policy"]);
  const mode = policy ? asString(policy["mode"]) : null;
  const allowed = (asArray(manifest["allowed_peers"]) ?? []).map((v) => (typeof v === "string" ? originOf(v) : null)).filter((v): v is string => v !== null);
  const referencedOrigins = new Set<string>();
  let problems = 0;
  for (const ext of externals) {
    if (ext.origin === null) continue;
    if (ext.origin === target.origin) {
      f.info("C6.3", `"${ext.agent}" references ${ext.kind} ${ext.ref} on the site's own origin (no consent card in the reference runtime).`, ["§3.2.4"], { ...ext });
      continue;
    }
    referencedOrigins.add(ext.origin);
    const ok = manifestAllowsPeer(ext.ref, manifest);
    if (!ok) {
      problems += 1;
      f.fail("C6.3", `"${ext.agent}" references ${ext.kind} ${ext.ref}, but the site's peer policy (mode ${mode ?? "closed"}) does not allow ${ext.origin}; the site's own runtime refuses the call (fail closed).`, ["§2.1", "§3.3", "§5"],
        `Add "${ext.origin}" to allowed_peers, or remove the reference.`, { ...ext, allowed_peers: allowed, mode });
    }
  }
  if (problems === 0) {
    if (referencedOrigins.size) {
      f.pass("C6.3", `Every external reference (${[...referencedOrigins].join(", ")}) is allowed by the site's peer policy.`, ["§3.3"], { referencedOrigins: [...referencedOrigins], allowed_peers: allowed, mode });
    } else {
      f.pass("C6.3", "The network references no other origin.", ["§3.3"], { allowed_peers: allowed, mode });
    }
  }
  const unused = allowed.filter((o) => !referencedOrigins.has(o) && o !== target.origin);
  if (unused.length) {
    f.info("C6.4", `allowed_peers lists origins no agent references: ${unused.join(", ")}.`, ["§3.3"], { unused });
  }
  return { result: f.result() };
}
