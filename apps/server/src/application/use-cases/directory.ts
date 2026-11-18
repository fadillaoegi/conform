// Use cases over the directory: list it, and find the latest badge for one network URL.

import { isEntryExpired, type DirectoryEntry } from "../../domain/directory.ts";
import type { BadgeView } from "../badge-view.ts";
import type { BadgeRepository, Clock, UrlPolicy } from "../ports.ts";
import type { GetBadge } from "./get-badge.ts";

export class ListDirectory {
  private readonly repository: BadgeRepository;
  private readonly clock: Clock;

  constructor(repository: BadgeRepository, clock: Clock) {
    this.repository = repository;
    this.clock = clock;
  }

  async execute(): Promise<Array<DirectoryEntry & { expired: boolean }>> {
    const now = this.clock.now();
    return (await this.repository.directory()).map((e) => ({ ...e, expired: isEntryExpired(e, now) }));
  }
}

export class FindBadgeForNetwork {
  private readonly policy: UrlPolicy;
  private readonly repository: BadgeRepository;
  private readonly getBadge: GetBadge;

  constructor(policy: UrlPolicy, repository: BadgeRepository, getBadge: GetBadge) {
    this.policy = policy;
    this.repository = repository;
    this.getBadge = getBadge;
  }

  async execute(input: unknown): Promise<BadgeView | null> {
    const url = this.policy.normalize(input);
    const entry = (await this.repository.directory()).find((e) => e.network === url);
    return entry ? this.getBadge.execute(entry.badgeId) : null;
  }
}
