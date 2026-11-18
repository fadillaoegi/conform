// C4 — exact-name resolution fails closed, and the site's real artifacts instantiate in a caller's
// runtime. Spec: §3.2.5, §3.2 MVP boundary, §5 (fail closed).

import { Findings } from "../findings.ts";
import { errorText, withHarness, type HarnessOptions } from "../harness/caller.ts";
import type { JsonObject, NetworkEntry, Target } from "../types.ts";

export interface ExactNameCheck {
  result: ReturnType<Findings["result"]>;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function checkExactName(
  target: Target,
  manifest: JsonObject,
  entries: NetworkEntry[],
  entry: NetworkEntry,
  fetchImpl?: HarnessOptions["fetch"],
): Promise<ExactNameCheck> {
  const f = new Findings("C4", "Exact network name: a wrong name fails closed; the right name instantiates", ["§3.2.5", "§3.2", "§5"], "harness");

  // C4.3 — static ambiguity between published names.
  const groups = new Map<string, string[]>();
  for (const e of entries) {
    const key = normalizeName(e.name);
    groups.set(key, [...(groups.get(key) ?? []), e.name]);
  }
  const ambiguous = [...groups.values()].filter((names) => names.length > 1);
  if (ambiguous.length) {
    f.warn("C4.3", `Network names differ only by case or punctuation: ${ambiguous.map((g) => g.join(" / ")).join("; ")}. Exact matching keeps them apart, but looser link-slot resolution in the reference runtime may not.`, ["§3.2.5"],
      "Give networks clearly distinct names.", { ambiguous });
  } else {
    f.pass("C4.3", "Published network names are unambiguous after normalization.", ["§3.2.5"], { networks: entries.map((e) => e.name) });
  }

  const options: HarnessOptions = {
    targetBase: target.siteBase,
    targetName: entry.name,
    targetManifest: manifest,
    policy: { mode: "closed", allowedPeers: [target.origin] },
  };
  if (fetchImpl) options.fetch = fetchImpl;
  const missingName = `${entry.name}-conform-missing`;
  try {
    await withHarness(options, async (h) => {
      // C4.1 — a name that is not published must fail, not fall back to another network.
      const markMissing = h.mark();
      let outcome: "threw" | "resolved" = "resolved";
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
        f.pass("C4.1", `Requesting "${missingName}" fails closed: ${message}`, ["§3.2.5", "§5"], { requested: missingName, error: message, targetRequests: missingRequests });
      } else if (outcome === "threw") {
        f.warn("C4.1", `Requesting "${missingName}" failed, but not with the exact-name error: ${message}`, ["§3.2.5"], "Check the manifest fetch; the runtime should report the missing name explicitly.", { requested: missingName, error: message, targetRequests: missingRequests });
      } else {
        f.fail("C4.1", `Requesting "${missingName}" ${message}; the runtime selected another network.`, ["§3.2.5", "§5"], "A caller MUST fail when no entry matches exactly.", { requested: missingName, targetRequests: missingRequests });
      }
      if (missingRequests.some((u) => !u.endsWith("/agent-manifest.json"))) {
        f.warn("C4.1", "The missing-name attempt fetched more than the manifest.", ["§3.2.5"], "Only the manifest should be read before the name check fails.", { targetRequests: missingRequests });
      }

      // C4.2 — the exact name instantiates (manifest, definition, links.json; no model call).
      const markExact = h.mark();
      try {
        const session = await h.engine.resolveRemote(`${target.siteBase}/${entry.name}`, [h.callerKey], null, h.callerManifest);
        const fetchedUrls = h.since(markExact).filter((r) => r.served === "target").map((r) => r.url);
        f.pass("C4.2", `A caller's reference runtime retrieves and instantiates "${session.network.name}" (front agent "${session.network.findFrontMan()}") without a model call.`, ["§3.2", "§3.2.6"],
          { network: session.network.name, frontAgent: session.network.findFrontMan(), fetchedUrls, routerRequests: 0 });
      } catch (error) {
        const message = errorText(error);
        f.fail("C4.2", `A caller's reference runtime refuses to instantiate "${entry.name}": ${message}`, ["§3.2", "§3.1", "§5"],
          "Fix the definition so the runtime's parse and validation gate passes (see C3).", { error: message, fetchedUrls: h.since(markExact).map((r) => r.url) });
      }
      const other = [...new Set(h.requests.filter((r) => r.served === "other").map((r) => r.origin))];
      if (other.length) {
        f.info("C4.2", `While loading, the caller also contacted other origins: ${other.join(", ")}. Each is a separate destination for consent purposes.`, ["§3.2.6", "§5"], { otherOrigins: other });
      }
    });
  } catch (error) {
    f.untestable("C4.2", `The harness could not start: ${errorText(error)}`, ["§3.2"], { error: errorText(error) });
  }
  return { result: f.result() };
}
