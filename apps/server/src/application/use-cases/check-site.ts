// Use case: check a site. The URL policy guards the input; results are cached per URL.

import { compactReport, type CompactReport, type Report } from "@conform/core";
import type { Cache, ConformanceChecker, UrlPolicy } from "../ports.ts";

export class CheckSite {
  private readonly policy: UrlPolicy;
  private readonly checker: ConformanceChecker;
  private readonly cache: Cache<Report>;

  constructor(policy: UrlPolicy, checker: ConformanceChecker, cache: Cache<Report>) {
    this.policy = policy;
    this.checker = checker;
    this.cache = cache;
  }

  async report(input: unknown, { fresh = false } = {}): Promise<Report> {
    const url = this.policy.normalize(input);
    const cached = fresh ? undefined : this.cache.get(url);
    if (cached) return cached;
    const report = await this.checker.check(url);
    this.cache.set(url, report);
    return report;
  }

  async compact(input: unknown): Promise<CompactReport> {
    return compactReport(await this.report(input));
  }

  get pending(): number {
    return this.checker.pending;
  }
}
