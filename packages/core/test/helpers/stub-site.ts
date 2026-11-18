// An in-memory site for negative tests: a fetch that answers from a map of URLs, with the CORS
// header on every file unless a test removes it. Redirects are honoured as serve_site would send them.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FetchLike } from "../../src/fetcher.ts";
import { FIXTURES } from "./fixture-server.ts";

export interface StubFile {
  body: string;
  status?: number;
  headers?: Record<string, string>;
}

export class StubSite {
  readonly files = new Map<string, StubFile>();
  readonly requests: Array<{ url: string; origin: string | null }> = [];

  readonly base: string;

  constructor(base: string) {
    this.base = base;
  }

  put(pathname: string, body: string | object, extra: Partial<StubFile> = {}): this {
    const text = typeof body === "string" ? body : JSON.stringify(body, null, 2);
    const headers: Record<string, string> = {
      "content-type": pathname.endsWith(".json") ? "application/json; charset=utf-8" : "text/plain",
      "access-control-allow-origin": "*",
      ...(extra.headers ?? {}),
    };
    this.files.set(new URL(pathname, `${this.base}/`).href, { body: text, status: extra.status ?? 200, headers });
    return this;
  }

  /** Remove one header from a file (for example the CORS header). */
  strip(pathname: string, header: string): this {
    const file = this.files.get(new URL(pathname, `${this.base}/`).href);
    if (file?.headers) delete file.headers[header.toLowerCase()];
    return this;
  }

  redirect(pathname: string, location: string, status = 302): this {
    this.files.set(new URL(pathname, `${this.base}/`).href, { body: "", status, headers: { location } });
    return this;
  }

  fetch(): FetchLike {
    return async (input, init) => {
      // A browser normalizes the URL before sending, so "/./x.json" and "/x.json" are one file.
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).href;
      const headers = init?.headers as Record<string, string> | undefined;
      this.requests.push({ url, origin: headers?.["Origin"] ?? headers?.["origin"] ?? null });
      const file = this.files.get(url);
      if (!file) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
      return new Response(file.status === 302 || file.status === 301 ? null : file.body, { status: file.status ?? 200, headers: file.headers ?? {} });
    };
  }
}

/** A stub site holding a copy of the pizza fixture's public files (manifest, definition, links.json). */
export async function pizzaStub(base = "https://pizza.example"): Promise<{ site: StubSite; manifest: Record<string, unknown>; definition: Record<string, unknown> }> {
  const folder = path.join(FIXTURES, "pizza_restaurant_agentified");
  const manifest = JSON.parse(await readFile(path.join(folder, "agent-manifest.json"), "utf8")) as Record<string, unknown>;
  const definition = JSON.parse(await readFile(path.join(folder, "pizza_restaurant_website_assistant.network.json"), "utf8")) as Record<string, unknown>;
  const links = await readFile(path.join(folder, "links.json"), "utf8");
  const site = new StubSite(base);
  site.put("agent-manifest.json", manifest).put("pizza_restaurant_website_assistant.network.json", definition).put("links.json", links);
  return { site, manifest, definition };
}
