// Use case: read a badge with its live state (expired, stale when the site's files changed, unreachable).

import { boundArtifacts, evaluateState, isExpired, type Badge, type BadgeState } from "../../domain/badge.ts";
import { toBadgeView, type BadgeView } from "../badge-view.ts";
import type { ArtifactProbe, BadgeRepository, Cache, Clock } from "../ports.ts";

export class GetBadge {
  private readonly repository: BadgeRepository;
  private readonly probe: ArtifactProbe;
  private readonly states: Cache<BadgeState>;
  private readonly clock: Clock;
  private readonly publicOrigin: string;

  constructor(repository: BadgeRepository, probe: ArtifactProbe, states: Cache<BadgeState>, clock: Clock, publicOrigin: string) {
    this.repository = repository;
    this.probe = probe;
    this.states = states;
    this.clock = clock;
    this.publicOrigin = publicOrigin;
  }

  async execute(id: string): Promise<BadgeView | null> {
    const badge = await this.repository.get(id);
    if (!badge) return null;
    return toBadgeView(badge, await this.stateOf(badge), this.publicOrigin, this.clock.now());
  }

  async stateOf(badge: Badge): Promise<BadgeState> {
    const now = this.clock.now();
    if (isExpired(badge.payload, now)) return "expired";
    const cached = this.states.get(badge.id);
    if (cached) return cached;
    const observed: Array<string | null> = [];
    for (const artifact of boundArtifacts(badge.payload)) {
      const digest = await this.probe.sha256(artifact.url);
      observed.push(digest);
      if (digest === null || digest !== artifact.sha256) break;
    }
    const state = evaluateState(badge.payload, now, observed);
    this.states.set(badge.id, state);
    return state;
  }
}
