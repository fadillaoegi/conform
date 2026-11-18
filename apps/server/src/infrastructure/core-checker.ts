// ConformanceChecker adapter: @conform/core's checkNetwork, through the SSRF-guarded fetch, queued.

import { checkNetwork, type Report } from "@conform/core";
import type { ConformanceChecker } from "../application/ports.ts";
import { SerialQueue } from "./serial-queue.ts";

export class CoreConformanceChecker implements ConformanceChecker {
  private readonly queue = new SerialQueue(20);
  private readonly fetchImpl: typeof fetch;
  private readonly callerOrigin: string;

  constructor(fetchImpl: typeof fetch, callerOrigin: string) {
    this.fetchImpl = fetchImpl;
    this.callerOrigin = callerOrigin;
  }

  check(url: string): Promise<Report> {
    return this.queue.run(() => checkNetwork(url, { fetch: this.fetchImpl, callerOrigin: this.callerOrigin }));
  }

  get pending(): number {
    return this.queue.length;
  }
}
