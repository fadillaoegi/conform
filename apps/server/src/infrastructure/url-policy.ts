// UrlPolicy adapter: Conform's input shape (core parseInput) plus the SSRF rules of safe-fetch.

import { parseInput } from "@conform/core";
import type { UrlPolicy } from "../application/ports.ts";
import { ValidationError } from "../domain/errors.ts";
import { assertAllowedUrl, BlockedRequestError } from "./safe-fetch.ts";

export class SafeUrlPolicy implements UrlPolicy {
  private readonly allowPrivate: boolean;

  constructor(allowPrivate: boolean) {
    this.allowPrivate = allowPrivate;
  }

  normalize(input: unknown): string {
    if (typeof input !== "string" || !input.trim() || input.length > 2048) throw new ValidationError("Give the URL of an agentic website or one of its networks.");
    const { target, problems } = parseInput(input.trim());
    if (problems.length) throw new ValidationError(problems.join(" "));
    try {
      assertAllowedUrl(target.siteBase || input, this.allowPrivate);
    } catch (error) {
      if (error instanceof BlockedRequestError) throw new ValidationError(error.message);
      throw error;
    }
    return target.networkUrl ?? `${target.siteBase}/`;
  }
}
