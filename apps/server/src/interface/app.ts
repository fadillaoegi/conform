// What the delivery adapters (HTTP, MCP) may call: use cases and published facts, nothing else.

import type { PublicJwk } from "../application/ports.ts";
import type { CheckSite } from "../application/use-cases/check-site.ts";
import type { FindBadgeForNetwork, ListDirectory } from "../application/use-cases/directory.ts";
import type { ExplainCheck } from "../application/use-cases/explain-check.ts";
import type { GetBadge } from "../application/use-cases/get-badge.ts";
import type { GetHealth } from "../application/use-cases/health.ts";
import type { IssueBadge } from "../application/use-cases/issue-badge.ts";

export interface App {
  checkSite: CheckSite;
  issueBadge: IssueBadge;
  getBadge: GetBadge;
  findBadge: FindBadgeForNetwork;
  listDirectory: ListDirectory;
  explainCheck: ExplainCheck;
  health: GetHealth;
  keySet: { issuer: string; keys: PublicJwk[] };
}
