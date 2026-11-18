// Cache adapter: in memory, time-limited, bounded.

import type { Cache, Clock } from "../application/ports.ts";

export class TtlCache<T> implements Cache<T> {
  private readonly entries = new Map<string, { at: number; value: T }>();
  private readonly ttlMs: number;
  private readonly max: number;
  private readonly clock: Clock;

  constructor(ttlMs: number, max: number, clock: Clock) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.clock = clock;
  }

  get(key: string): T | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (this.clock.now().getTime() - hit.at >= this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.ttlMs <= 0) return;
    this.entries.delete(key);
    this.entries.set(key, { at: this.clock.now().getTime(), value });
    if (this.entries.size > this.max) this.entries.delete(this.entries.keys().next().value as string);
  }
}
