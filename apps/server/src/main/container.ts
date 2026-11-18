// Composition root: build the adapters and wire them into the use cases. The only place that knows
// every layer.

import { CONFORM_VERSION, type Report } from "@conform/core";
import type { BadgeState } from "../application/ports.ts";
import { CheckSite } from "../application/use-cases/check-site.ts";
import { FindBadgeForNetwork, ListDirectory } from "../application/use-cases/directory.ts";
import { ExplainCheck } from "../application/use-cases/explain-check.ts";
import { GetBadge } from "../application/use-cases/get-badge.ts";
import { GetHealth } from "../application/use-cases/health.ts";
import { IssueBadge } from "../application/use-cases/issue-badge.ts";
import { CoreConformanceChecker } from "../infrastructure/core-checker.ts";
import { FileBadgeRepository } from "../infrastructure/file-badge-repository.ts";
import { HttpArtifactProbe } from "../infrastructure/http-artifact-probe.ts";
import { createSafeFetch } from "../infrastructure/safe-fetch.ts";
import { systemClock } from "../infrastructure/system-clock.ts";
import { TtlCache } from "../infrastructure/ttl-cache.ts";
import { SafeUrlPolicy } from "../infrastructure/url-policy.ts";
import type { App } from "../interface/app.ts";
import type { Config } from "./config.ts";

export async function buildApp(config: Config): Promise<App> {
  const clock = systemClock;
  const safeFetch = createSafeFetch({ allowPrivate: config.allowPrivate, userAgent: `Conform/${CONFORM_VERSION} (+${config.publicOrigin})` });
  const repository = new FileBadgeRepository(config.dataDir);
  await repository.init();
  const policy = new SafeUrlPolicy(config.allowPrivate);
  const states = new TtlCache<BadgeState>(config.statusCacheMs, 5_000, clock);
  const checkSite = new CheckSite(policy, new CoreConformanceChecker(safeFetch, config.publicOrigin), new TtlCache<Report>(config.reportCacheMs, 500, clock));
  const getBadge = new GetBadge(repository, new HttpArtifactProbe(safeFetch), states, clock, config.publicOrigin);
  return {
    checkSite,
    issueBadge: new IssueBadge(checkSite, config.signer, repository, states, clock, config.publicOrigin),
    getBadge,
    findBadge: new FindBadgeForNetwork(policy, repository, getBadge),
    listDirectory: new ListDirectory(repository, clock),
    explainCheck: new ExplainCheck(),
    health: new GetHealth(repository, checkSite, config.env),
    keySet: { issuer: config.publicOrigin, keys: [config.signer.publicJwk] },
  };
}
