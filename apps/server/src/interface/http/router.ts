// Interface: HTTP routing. Translates requests into use-case calls and domain errors into status codes.

import type { IncomingMessage, ServerResponse } from "node:http";
import { ServiceBusyError, ValidationError } from "../../domain/errors.ts";
import type { App } from "../app.ts";
import { handleMcp } from "../mcp/mcp-controller.ts";
import { badgeSvg } from "../presenters/badge-svg.ts";
import { RateLimiter } from "./rate-limiter.ts";
import type { StaticSite } from "./static-site.ts";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id",
  "access-control-expose-headers": "mcp-session-id",
  "access-control-max-age": "600",
};
const MAX_BODY = 64 * 1024;

class PayloadTooLarge extends Error {}

export interface RouterOptions {
  trustProxy: boolean;
  site: StaticSite | null;
  quiet: boolean;
}

function clientKey(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = String(req.headers["x-forwarded-for"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const last = forwarded[forwarded.length - 1];
    if (last) return last;
  }
  return req.socket.remoteAddress ?? "unknown";
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new PayloadTooLarge("Request body too large.");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const text = await readBody(req);
  const value: unknown = JSON.parse(text || "{}");
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function send(res: ServerResponse, status: number, headers: Record<string, string>, body: string | Buffer): void {
  res.writeHead(status, { "x-content-type-options": "nosniff", ...headers, "content-length": String(Buffer.byteLength(body)) });
  res.end(body);
}

function json(res: ServerResponse, status: number, value: unknown, extra: Record<string, string> = {}): void {
  send(res, status, { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }, `${JSON.stringify(value, null, 2)}\n`);
}

export function createRouter(app: App, options: RouterOptions): (req: IncomingMessage, res: ServerResponse) => void {
  const limits = {
    check: new RateLimiter(10, 600_000),
    badge: new RateLimiter(4, 600_000),
    mcp: new RateLimiter(60, 600_000),
    read: new RateLimiter(240, 60_000),
  };
  const limited = (res: ServerResponse, limiter: RateLimiter, key: string): boolean => {
    const wait = limiter.take(key);
    if (wait > 0) {
      json(res, 429, { error: `Too many requests. Try again in ${wait} s.` }, { "retry-after": String(wait) });
      return true;
    }
    return false;
  };

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const p = new URL(req.url ?? "/", "http://conform.local").pathname;
    const method = req.method ?? "GET";
    const who = clientKey(req, options.trustProxy);
    const api = p.startsWith("/api/") || p === "/mcp" || p.startsWith("/badges/") || p === "/.well-known/conform-badge-key.json" || p === "/healthz";
    if (api && method === "OPTIONS") return send(res, 204, CORS, "");

    if (p === "/healthz" || p === "/api/health") return json(res, 200, await app.health.execute());
    if (p === "/.well-known/conform-badge-key.json" && method === "GET") {
      return json(res, 200, app.keySet, { "cache-control": "public, max-age=3600" });
    }
    if (p === "/mcp") {
      if (method !== "POST") return send(res, 405, { ...CORS, allow: "POST, OPTIONS", "content-type": "text/plain" }, "Use POST (JSON-RPC 2.0).");
      if (limited(res, limits.mcp, who)) return;
      const reply = await handleMcp(app, await readBody(req));
      if (reply.body === null) return send(res, reply.status, CORS, "");
      return json(res, reply.status, reply.body, reply.sessionId ? { "mcp-session-id": reply.sessionId } : {});
    }
    if (p === "/api/check" && method === "POST") {
      if (limited(res, limits.check, who)) return;
      return json(res, 200, await app.checkSite.compact((await readJson(req))["url"]));
    }
    if (p === "/api/badges" && method === "POST") {
      if (limited(res, limits.badge, who)) return;
      const outcome = await app.issueBadge.execute((await readJson(req))["url"]);
      return "badge" in outcome ? json(res, 201, outcome.badge) : json(res, 422, outcome);
    }
    const badgeJson = p.match(/^\/api\/badges\/([A-Za-z0-9_-]{22})$/);
    if (badgeJson && method === "GET") {
      if (limited(res, limits.read, who)) return;
      const view = await app.getBadge.execute(badgeJson[1] as string);
      return view ? json(res, 200, view) : json(res, 404, { error: "No such badge." });
    }
    const badgeImage = p.match(/^\/badges\/([A-Za-z0-9_-]{22})\.svg$/);
    if (badgeImage && method === "GET") {
      if (limited(res, limits.read, who)) return;
      const view = await app.getBadge.execute(badgeImage[1] as string);
      const svg = view ? badgeSvg(view.payload.result, view.state) : badgeSvg(null, "unknown");
      return send(res, view ? 200 : 404, { ...CORS, "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300" }, svg);
    }
    if (p === "/api/directory" && method === "GET") {
      return json(res, 200, { issuer: app.keySet.issuer, sites: await app.listDirectory.execute() }, { "cache-control": "public, max-age=60" });
    }
    if (api) return json(res, 404, { error: "Not found." });
    if (options.site && (method === "GET" || method === "HEAD")) {
      const file = await options.site.serve(p);
      return send(res, file.status, file.headers, method === "HEAD" ? "" : file.body);
    }
    return send(res, 404, { "content-type": "text/plain" }, "Not found");
  };

  return (req, res) => {
    const started = Date.now();
    handle(req, res)
      .catch((error: unknown) => {
        if (res.headersSent) return;
        if (error instanceof ValidationError) return json(res, 400, { error: error.message });
        if (error instanceof PayloadTooLarge) return json(res, 413, { error: error.message });
        if (error instanceof SyntaxError) return json(res, 400, { error: "The request body is not valid JSON." });
        if (error instanceof ServiceBusyError) return json(res, 503, { error: error.message }, { "retry-after": "30" });
        console.error("request failed", error instanceof Error ? error.message : error);
        return json(res, 500, { error: "Internal error." });
      })
      .finally(() => {
        if (!options.quiet) console.log(JSON.stringify({ t: new Date().toISOString(), m: req.method, p: (req.url ?? "").split("?")[0], s: res.statusCode, ms: Date.now() - started }));
      });
  };
}
