// Fetching public artifacts the way a calling browser does, with the evidence a report needs:
// final URL, status, headers, redirects, content hash. No credentials are ever attached (§3.4).

export type FetchLike = typeof fetch;

export interface FetchOptions {
  fetch?: FetchLike;
  /** The origin a caller would send; the CORS verdict is evaluated against it. */
  callerOrigin: string;
  maxRedirects?: number;
  timeoutMs?: number;
}

export interface Fetched {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  /** Lower-cased header names. */
  headers: Record<string, string>;
  text: string;
  bytes: number;
  contentType: string | null;
  sha256: string | null;
  /** Each redirect hop's Location, in order. */
  redirects: string[];
  /** The first redirect that leaves the artifact's origin, or null. */
  crossOriginRedirect: string | null;
  /** Network or protocol failure; status is 0 then. */
  error: string | null;
}

export function inBrowser(): boolean {
  const g = globalThis as { document?: unknown; window?: unknown };
  return typeof g.document !== "undefined" && typeof g.window !== "undefined";
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function headersOf(response: Response): Record<string, string> {
  const out: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function failureReason(error: unknown): string {
  const err = error as { cause?: { code?: string; message?: string }; message?: string; name?: string };
  if (err?.name === "TimeoutError") return "timed out";
  if (inBrowser() && err?.name === "TypeError") {
    return "the browser could not read it (the host is down, it sends no CORS header, it is plain http seen from an https page, or this page's security policy only allows https sites)";
  }
  if (err?.cause?.code === "ECONNREFUSED") return "connection refused (nothing is listening there)";
  if (err?.cause?.code) return `${err.cause.code}${err.cause.message ? `: ${err.cause.message}` : ""}`;
  return err?.message || String(error);
}

/**
 * GET one public artifact. Redirects are followed manually so a cross-origin redirect is visible
 * (§5 "a redirect to a different origin MUST be treated as a new destination"). In a browser, manual
 * redirects are opaque, so the final URL from a followed fetch is used instead.
 */
export async function fetchArtifact(url: string, options: FetchOptions): Promise<Fetched> {
  const fetchImpl = options.fetch ?? fetch;
  const maxRedirects = options.maxRedirects ?? 5;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const browser = inBrowser();
  const result: Fetched = {
    requestedUrl: url,
    finalUrl: url,
    status: 0,
    ok: false,
    headers: {},
    text: "",
    bytes: 0,
    contentType: null,
    sha256: null,
    redirects: [],
    crossOriginRedirect: null,
    error: null,
  };
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    let response: Response;
    try {
      const init: RequestInit = {
        method: "GET",
        redirect: browser ? "follow" : "manual",
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      };
      if (!browser) init.headers = { Origin: options.callerOrigin, Accept: "application/json, text/plain, */*" };
      response = await fetchImpl(current, init);
    } catch (error) {
      result.error = failureReason(error);
      result.finalUrl = current;
      return result;
    }
    const location = response.headers.get("location");
    const isRedirect = response.status >= 300 && response.status <= 399 && !!location;
    if (!browser && isRedirect) {
      const next = new URL(location as string, current).href;
      result.redirects.push(next);
      if (new URL(next).origin !== new URL(current).origin && result.crossOriginRedirect === null) {
        result.crossOriginRedirect = next;
        // Stop here: a caller's runtime would be sent to another origin without a new consent decision.
        result.status = response.status;
        result.finalUrl = current;
        result.headers = headersOf(response);
        return result;
      }
      current = next;
      continue;
    }
    const buffer = await response.arrayBuffer();
    result.status = response.status;
    result.ok = response.ok;
    result.headers = headersOf(response);
    result.finalUrl = browser && response.url ? response.url : current;
    if (browser && response.url && new URL(response.url).origin !== new URL(url).origin) {
      result.crossOriginRedirect = response.url;
    }
    result.bytes = buffer.byteLength;
    result.text = new TextDecoder("utf-8").decode(buffer);
    result.contentType = result.headers["content-type"] ?? null;
    try {
      result.sha256 = await sha256Hex(buffer);
    } catch {
      result.sha256 = null;
    }
    return result;
  }
  result.error = `redirected more than ${maxRedirects} times`;
  result.finalUrl = current;
  return result;
}

export interface CorsVerdict {
  ok: boolean;
  reason: string;
  header: string | null;
}

/**
 * Say whether a browser on the caller origin may read the artifact (§3.2 MVP boundary, §3.3, §3.4).
 * In a browser the header is not exposed, so a successful cross-origin fetch is the evidence.
 */
export function evaluateCors(fetched: Fetched, callerOrigin: string): CorsVerdict {
  const artifactOrigin = new URL(fetched.finalUrl).origin;
  const header = fetched.headers["access-control-allow-origin"] ?? null;
  if (artifactOrigin === callerOrigin) {
    return { ok: true, reason: "same origin as the caller; no CORS header needed", header };
  }
  if (header !== null) {
    const value = header.trim();
    if (value === "*") return { ok: true, reason: "Access-Control-Allow-Origin: *", header };
    if (value === callerOrigin) return { ok: true, reason: `Access-Control-Allow-Origin echoes ${callerOrigin}`, header };
    return { ok: false, reason: `Access-Control-Allow-Origin "${value}" does not allow ${callerOrigin}`, header };
  }
  if (inBrowser() && fetched.ok) {
    return { ok: true, reason: "cross-origin fetch succeeded under the browser's CORS enforcement", header };
  }
  return { ok: false, reason: "no Access-Control-Allow-Origin header; a browser on another origin cannot read it", header };
}

export function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return /application\/(.+\+)?json|text\/json/i.test(contentType);
}
