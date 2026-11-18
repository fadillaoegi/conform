// ArtifactProbe adapter: GET through the SSRF-guarded fetch and hash the bytes.

import { createHash } from "node:crypto";
import type { ArtifactProbe } from "../application/ports.ts";

export class HttpArtifactProbe implements ArtifactProbe {
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch) {
    this.fetchImpl = fetchImpl;
  }

  async sha256(url: string): Promise<string | null> {
    try {
      const response = await this.fetchImpl(url, { method: "GET" });
      if (!response.ok) return null;
      return createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex");
    } catch {
      return null;
    }
  }
}
