import type { Target } from "./types.ts";

export const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** The origin of an http(s) URL, or null. */
export function originOf(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** True when the URL is https, or http on a loopback host (allowed for local development, §3.2.1, §3.3). */
export function isSecureEnough(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && isLoopbackHost(url.hostname));
  } catch {
    return false;
  }
}

/** Strip one trailing slash. */
export function trimSlash(value: string): string {
  return value.replace(/\/$/, "");
}

export interface ParsedInput {
  target: Target;
  problems: string[];
}

const FILE_LIKE = /\.(json|html?|hocon|js|mjs)$/i;

/**
 * Turn the user's input into a site base and, when present, a network name.
 *
 * Accepted forms (§3.2.1): a network URL `https://site.example/agents/transit` (site base + network name),
 * a site base ending in "/" (`https://site.example/`), or the manifest URL itself.
 */
export function parseInput(input: string): ParsedInput {
  const problems: string[] = [];
  const raw = input.trim();
  let url: URL | null = null;
  try {
    url = new URL(raw);
  } catch {
    url = null;
  }
  if (url === null || (url.protocol !== "http:" && url.protocol !== "https:")) {
    problems.push(`"${raw}" is not a full http or https URL.`);
    return { target: { input: raw, siteBase: "", origin: "", networkName: null, networkUrl: null }, problems };
  }
  if (url.search || url.hash) {
    problems.push("A network URL must have no query string or fragment.");
  }
  url.search = "";
  url.hash = "";
  const segments = url.pathname.split("/");
  const last = segments[segments.length - 1] ?? "";
  if (last === "" || FILE_LIKE.test(last)) {
    // A site base (trailing slash) or a file such as agent-manifest.json: the folder is the site base.
    const base = trimSlash(new URL("./", url).href);
    return { target: { input: raw, siteBase: base, origin: url.origin, networkName: null, networkUrl: null }, problems };
  }
  const base = trimSlash(new URL("./", url).href);
  return {
    target: { input: raw, siteBase: base, origin: url.origin, networkName: last, networkUrl: `${base}/${last}` },
    problems,
  };
}
