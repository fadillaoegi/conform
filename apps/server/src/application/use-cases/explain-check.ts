// Use case: explain a check or finding id from the shared catalog and finding guides.

import { checkInfo, findingGuides, type CheckInfo, type FindingGuide } from "@conform/core";

export interface Explanation {
  check: CheckInfo;
  guides: Array<{ id: string } & FindingGuide>;
}

export class ExplainCheck {
  execute(id: unknown): Explanation | null {
    const key = String(id ?? "");
    const check = checkInfo(key);
    return check ? { check, guides: findingGuides(key) } : null;
  }
}
