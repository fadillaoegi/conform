// Use case: issue a badge. The site is checked again here (a client's report is never trusted), and a
// badge is signed only when the domain rules allow it.

import { compactReport, type CompactReport } from "@conform/core";
import { buildPayload, ineligibility, signedBytes, type Badge, type BadgeState } from "../../domain/badge.ts";
import { toBadgeView, type BadgeView } from "../badge-view.ts";
import type { BadgeRepository, BadgeSigner, Cache, Clock } from "../ports.ts";
import type { CheckSite } from "./check-site.ts";

export type IssueOutcome = { badge: BadgeView } | { refused: string; report: CompactReport };

export class IssueBadge {
  private readonly checkSite: CheckSite;
  private readonly signer: BadgeSigner;
  private readonly repository: BadgeRepository;
  private readonly states: Cache<BadgeState>;
  private readonly clock: Clock;
  private readonly issuer: string;

  constructor(checkSite: CheckSite, signer: BadgeSigner, repository: BadgeRepository, states: Cache<BadgeState>, clock: Clock, issuer: string) {
    this.checkSite = checkSite;
    this.signer = signer;
    this.repository = repository;
    this.states = states;
    this.clock = clock;
    this.issuer = issuer;
  }

  async execute(input: unknown): Promise<IssueOutcome> {
    const report = await this.checkSite.report(input, { fresh: true });
    const reason = ineligibility(report);
    if (reason) return { refused: reason, report: compactReport(report) };
    const now = this.clock.now();
    const payload = buildPayload(report, this.issuer, this.signer.kid, now);
    const bytes = signedBytes(payload);
    const badge: Badge = {
      id: this.signer.badgeId(bytes),
      payload,
      signature: this.signer.sign(bytes),
      site: report.site ?? { brand: null, description: null, tags: [] },
    };
    await this.repository.save(badge);
    this.states.set(badge.id, "valid");
    return { badge: toBadgeView(badge, "valid", this.issuer, now) };
  }
}
