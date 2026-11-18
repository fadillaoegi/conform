// One check at a time: the reference-runtime harness patches the global fetch while it runs.

import { ServiceBusyError } from "../domain/errors.ts";

export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private waiting = 0;
  private readonly maxWaiting: number;

  constructor(maxWaiting: number) {
    this.maxWaiting = maxWaiting;
  }

  get length(): number {
    return this.waiting;
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    if (this.waiting >= this.maxWaiting) return Promise.reject(new ServiceBusyError("The checker is busy. Try again in a minute."));
    this.waiting += 1;
    const result = this.tail.then(task, task);
    this.tail = result.then(() => undefined, () => undefined).finally(() => {
      this.waiting -= 1;
    });
    return result;
  }
}
