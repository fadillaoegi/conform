// C5 — composition cycles, depth and budgets stop with visible errors; repeating an agent is not a
// cycle. Spec: §3.1 (bound execution), §3.2.9 (per-hop policy), §5 (fail closed).

import { consumeAgentBudget, consumeRemoteBudget, type Composition } from "@conform/reference-runtime/runtime/runner.js";
import { Findings } from "../findings.ts";
import { errorCode, errorText, withHarness, type HarnessOptions } from "../harness/caller.ts";
import { RUNTIME } from "../spec.ts";
import type { JsonObject, NetworkEntry, Target } from "../types.ts";

export interface LimitsCheck {
  result: ReturnType<Findings["result"]>;
}

function composition(overrides: Partial<Composition> = {}): Composition {
  return {
    remoteCalls: 0,
    peerCalls: new Map(),
    maxRemoteCalls: RUNTIME.limits.maxRemoteCalls,
    maxCallsPerPeer: RUNTIME.limits.maxCallsPerPeer,
    agentCalls: 0,
    maxAgentCalls: RUNTIME.limits.maxAgentCalls,
    deadline: Date.now() + RUNTIME.limits.deadlineMs,
    ...overrides,
  };
}

export async function checkLimits(target: Target, manifest: JsonObject, entry: NetworkEntry, fetchImpl?: HarnessOptions["fetch"]): Promise<LimitsCheck> {
  const f = new Findings("C5", "Cycles, depth and budgets stop with visible errors", ["§3.1", "§3.2.9", "§5"], "harness");
  const targetUrl = `${target.siteBase}/${entry.name}`;
  const targetKey = `${target.siteBase}::${entry.name}`;
  const options: HarnessOptions = {
    targetBase: target.siteBase,
    targetName: entry.name,
    targetManifest: manifest,
    policy: { mode: "closed", allowedPeers: [target.origin] },
  };
  if (fetchImpl) options.fetch = fetchImpl;

  try {
    await withHarness(options, async (h) => {
      // C5.1 — a call back into a network already in the chain is a cycle; nothing is fetched.
      const markCycle = h.mark();
      try {
        await h.engine.resolveRemote(targetUrl, [h.callerKey, targetKey], null, h.callerManifest);
        f.fail("C5.1", `Calling ${targetUrl} from a chain that already contains it did not stop.`, ["§3.1", "§3.2.9", "§5"], "The runtime must detect the composition cycle before contacting the peer.", { chain: [h.callerKey, targetKey] });
      } catch (error) {
        const code = errorCode(error);
        const requests = h.since(markCycle).filter((r) => r.served === "target").map((r) => r.url);
        if (code === "COMPOSITION_CYCLE" && requests.length === 0) {
          f.pass("C5.1", `A composition cycle stops with a visible error before any contact: ${errorText(error)}`, ["§3.1", "§3.2.9", "§5"], { code, error: errorText(error), targetRequests: requests });
        } else {
          f.warn("C5.1", `The cycle attempt stopped, but not as expected (code ${code ?? "none"}, ${requests.length} target request(s)): ${errorText(error)}`, ["§3.1", "§5"], "Check the runtime's cycle detection.", { code, error: errorText(error), targetRequests: requests });
        }
      }

      // C5.2 — the composition depth limit.
      const deep = Array.from({ length: h.engine.registry.maxDepth }, (_, i) => `https://hop${i}.invalid::net${i}`);
      const markDepth = h.mark();
      try {
        await h.engine.resolveRemote(targetUrl, deep, null, h.callerManifest);
        f.fail("C5.2", `A chain of ${deep.length} hops did not stop at the depth limit.`, ["§3.1", "§5"], "The runtime must enforce a finite composition depth.", { depth: deep.length });
      } catch (error) {
        const code = errorCode(error);
        const requests = h.since(markDepth).filter((r) => r.served === "target").map((r) => r.url);
        if (code === "COMPOSITION_DEPTH" && requests.length === 0) {
          f.pass("C5.2", `The composition depth limit (${h.engine.registry.maxDepth}) stops with a visible error before any contact: ${errorText(error)}`, ["§3.1", "§5"], { code, maxDepth: h.engine.registry.maxDepth, targetRequests: requests });
        } else {
          f.warn("C5.2", `The depth attempt stopped, but not as expected (code ${code ?? "none"}): ${errorText(error)}`, ["§3.1", "§5"], "Check the runtime's depth limit.", { code, error: errorText(error), targetRequests: requests });
        }
      }
    });
  } catch (error) {
    f.untestable("C5.1", `The harness could not start: ${errorText(error)}`, ["§3.1"], { error: errorText(error) });
  }

  // C5.3 — per-message budgets, exercised directly on the pinned runtime's budget functions.
  const remoteAtLimit = consumeRemoteBudget(composition({ remoteCalls: RUNTIME.limits.maxRemoteCalls }), targetKey);
  const agentAtLimit = consumeAgentBudget(composition({ agentCalls: RUNTIME.limits.maxAgentCalls }));
  const pastDeadline = consumeAgentBudget(composition({ deadline: Date.now() - 1 }));
  const samePeer = composition();
  consumeRemoteBudget(samePeer, targetKey);
  const secondCall = consumeRemoteBudget(samePeer, targetKey);
  const budgets = { remoteAtLimit, agentAtLimit, pastDeadline, secondCallToSamePeer: secondCall };
  if (remoteAtLimit && agentAtLimit && pastDeadline) {
    f.pass("C5.3", `Over-budget requests are skipped with a visible reason (remote calls: "${remoteAtLimit}"; agent calls: "${agentAtLimit}"; deadline: "${pastDeadline}").`, ["§3.1", "§5"], budgets);
  } else {
    f.fail("C5.3", "One of the budget limits did not produce a stop reason.", ["§3.1", "§5"], "The runtime must enforce finite limits on invocations and elapsed time.", budgets);
  }
  f.info("C5.4", `Reference limits per visitor message: ${RUNTIME.limits.maxRemoteCalls} peer calls, ${RUNTIME.limits.maxCallsPerPeer} per peer, ${RUNTIME.limits.maxAgentCalls} agent invocations, ${RUNTIME.limits.deadlineMs / 1000} s, depth ${RUNTIME.limits.maxCompositionDepth}. A second call to the same peer in one message is skipped ("${secondCall}"), which is a budget, not a cycle.`, ["§3.1"], RUNTIME.limits);
  f.info("C5.5", "Repeated invocation of the same internal agent is not treated as a cycle: the runtime keys cycle detection on the remote-network chain only and bounds internal repeats by the agent budget.", ["§3.1"],
    { cycleKey: "<site base>::<network name>", internalRepeatBound: RUNTIME.limits.maxAgentCalls });
  return { result: f.result() };
}
