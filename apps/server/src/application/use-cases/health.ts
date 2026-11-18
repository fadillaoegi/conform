// Use case: a small health summary for operators and the site's feature detection.

import { CONFORM_VERSION } from "@conform/core";
import type { BadgeRepository } from "../ports.ts";
import type { CheckSite } from "./check-site.ts";

export class GetHealth {
  private readonly repository: BadgeRepository;
  private readonly checkSite: CheckSite;
  private readonly env: string;

  constructor(repository: BadgeRepository, checkSite: CheckSite, env: string) {
    this.repository = repository;
    this.checkSite = checkSite;
    this.env = env;
  }

  async execute(): Promise<{ ok: true; version: string; badges: number; queue: number; env: string }> {
    return { ok: true, version: CONFORM_VERSION, badges: await this.repository.count(), queue: this.checkSite.pending, env: this.env };
  }
}
