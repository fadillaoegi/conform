// Use case: explain a check or finding id from the shared catalog.

import { checkInfo, type CheckInfo } from "@conform/core";

export class ExplainCheck {
  execute(id: unknown): CheckInfo | null {
    return checkInfo(String(id ?? ""));
  }
}
