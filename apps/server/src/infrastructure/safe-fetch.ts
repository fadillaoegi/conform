// Outbound requests on behalf of anonymous visitors. The server checks any URL a visitor gives it, so
// every request is guarded against server-side request forgery: http(s) only, standard ports only,
// and the IP address is checked at connect time (no loopback, private, link-local, multicast or
// reserved ranges), which also defeats DNS rebinding. Responses are size- and time-limited.

import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

export interface SafeFetchOptions {
  /** Allow loopback/private addresses, plain http and any port. Local development and tests only. */
  allowPrivate: boolean;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  userAgent?: string;
}

export class BlockedRequestError extends Error {
  override name = "BlockedRequestError";
}

const BLOCKED = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) BLOCKED.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64], ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) BLOCKED.addSubnet(net, prefix, "ipv6");

/** True when the address must never be contacted from the server. */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return BLOCKED.check(address, "ipv4");
  if (family === 6) {
    const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return BLOCKED.check(mapped[1] as string, "ipv4");
    if (/^::ffff:/i.test(address)) return true;
    return BLOCKED.check(address, "ipv6");
  }
  return true;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

export function guardedLookup(allowPrivate: boolean) {
  return (hostname: string, options: { all?: boolean; family?: number } | number, callback: LookupCallback): void => {
    const opts = typeof options === "number" ? { family: options } : options;
    dnsLookup(hostname, { all: true, family: opts.family ?? 0 }, (err, addresses) => {
      if (err) return callback(err, "", 0);
      const list = addresses as LookupAddress[];
      if (!allowPrivate && list.some((a) => isBlockedAddress(a.address))) {
        const error = new BlockedRequestError(`${hostname} resolves to an address the server may not contact.`) as NodeJS.ErrnoException;
        error.code = "ECONNREFUSED_BLOCKED";
        return callback(error, "", 0);
      }
      if (opts.all) return callback(null, list);
      const first = list[0];
      if (!first) return callback(Object.assign(new Error(`No address for ${hostname}`), { code: "ENOTFOUND" }), "", 0);
      callback(null, first.address, first.family);
    });
  };
}

/** Validate a URL before any network activity. Throws BlockedRequestError. */
export function assertAllowedUrl(raw: string, allowPrivate: boolean): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedRequestError(`"${raw}" is not a URL.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new BlockedRequestError("Only http and https URLs can be checked.");
  if (url.username || url.password) throw new BlockedRequestError("URLs with credentials are not allowed.");
  if (allowPrivate) return url;
  if (url.protocol !== "https:") throw new BlockedRequestError("The public service checks HTTPS sites only (spec §3.3: production sites use HTTPS).");
  if (url.port && url.port !== "443") throw new BlockedRequestError("The public service only contacts the standard HTTPS port.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isBlockedAddress(host)) throw new BlockedRequestError("That address is private or reserved.");
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.invalid)$/i.test(host)) throw new BlockedRequestError("That host name is not public.");
  return url;
}

function headerPairs(init: RequestInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  const headers = init?.headers;
  if (!headers) return out;
  const entries: Array<[string, string]> = headers instanceof Headers ? [...headers.entries()]
    : Array.isArray(headers) ? headers.map(([k, v]) => [String(k), String(v)])
    : Object.entries(headers).map(([k, v]) => [k, String(v)]);
  for (const [k, v] of entries) {
    const key = k.toLowerCase();
    // Never forward credentials or cookies from the server.
    if (key === "cookie" || key === "authorization" || key === "host") continue;
    out[key] = v;
  }
  return out;
}

function toResponse(res: IncomingMessage, body: Buffer | null): Response {
  const headers = new Headers();
  for (const [key, value] of Object.entries(res.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const status = res.statusCode ?? 502;
  const nullBody = status === 204 || status === 205 || status === 304 || (status >= 300 && status < 400);
  return new Response(nullBody ? null : new Uint8Array(body ?? Buffer.alloc(0)), { status, headers });
}

async function once(url: URL, init: RequestInit | undefined, options: SafeFetchOptions): Promise<Response> {
  const maxBytes = options.maxBytes ?? 3_000_000;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = headerPairs(init);
  headers["user-agent"] = options.userAgent ?? "Conform-conformance-checker (+https://github.com/)";
  let body: Buffer | null = null;
  if (init?.body !== undefined && init.body !== null) {
    if (typeof init.body !== "string") throw new BlockedRequestError("Only text request bodies are supported.");
    body = Buffer.from(init.body);
    headers["content-length"] = String(body.length);
  }
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise<Response>((resolve, reject) => {
    const req = request(url, { method, headers, lookup: guardedLookup(options.allowPrivate) as never, timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          req.destroy(new BlockedRequestError(`The response from ${url.host} is larger than ${Math.round(maxBytes / 1_000_000)} MB.`));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve(toResponse(res, Buffer.concat(chunks))));
      res.on("error", reject);
    });
    const timer = setTimeout(() => req.destroy(Object.assign(new Error("timed out"), { name: "TimeoutError" })), timeoutMs);
    req.on("close", () => clearTimeout(timer));
    req.on("timeout", () => req.destroy(Object.assign(new Error("timed out"), { name: "TimeoutError" })));
    req.on("error", (error) => {
      const cause = (error as { code?: string }).code === "ECONNREFUSED_BLOCKED" || error instanceof BlockedRequestError
        ? new BlockedRequestError(error.message) : error;
      reject(Object.assign(new TypeError(`fetch failed: ${cause.message}`), { cause }));
    });
    init?.signal?.addEventListener("abort", () => req.destroy(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
    if (body) req.write(body);
    req.end();
  });
}

/** A fetch-compatible function with the guards above. Redirects are re-validated hop by hop. */
export function createSafeFetch(options: SafeFetchOptions): typeof fetch {
  const maxRedirects = options.maxRedirects ?? 5;
  const safe = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    let current = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let currentInit = init;
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      let url: URL;
      try {
        url = assertAllowedUrl(current, options.allowPrivate);
      } catch (error) {
        throw Object.assign(new TypeError(`fetch failed: ${(error as Error).message}`), { cause: error });
      }
      const response = await once(url, currentInit, options);
      const location = response.headers.get("location");
      if (currentInit?.redirect === "manual" || response.status < 300 || response.status > 399 || !location) return response;
      current = new URL(location, url).href;
      if (response.status === 303 || ((response.status === 301 || response.status === 302) && (currentInit?.method ?? "GET").toUpperCase() !== "GET")) {
        const next: RequestInit = { ...currentInit, method: "GET" };
        delete next.body;
        currentInit = next;
      }
    }
    throw new TypeError(`fetch failed: more than ${maxRedirects} redirects`);
  };
  return safe as typeof fetch;
}
