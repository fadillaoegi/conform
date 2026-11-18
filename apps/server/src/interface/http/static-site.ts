// Interface: optional static serving of apps/web/dist with the same headers as deploy/Caddyfile, so one Node
// process can run the whole site locally (and in production behind a TLS proxy, if preferred).

import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8", ".hocon": "text/plain; charset=utf-8",
};
const WORKER_CSP = "default-src 'none'; script-src blob:; connect-src 'none'; worker-src 'none'";

export function pageCsp(allowPrivate: boolean): string {
  const connect = allowPrivate ? "'self' https: http://127.0.0.1:* http://localhost:*" : "'self' https:";
  return `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src ${connect}; worker-src 'self' blob:; frame-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'`;
}

export interface StaticFile {
  status: number;
  headers: Record<string, string>;
  body: Buffer | string;
}

export class StaticSite {
  private root = "";
  private readonly dir: string;
  private readonly allowPrivate: boolean;

  constructor(dir: string, allowPrivate: boolean) {
    this.dir = dir;
    this.allowPrivate = allowPrivate;
  }

  async init(): Promise<void> {
    this.root = await realpath(this.dir);
  }

  private async publicPaths(): Promise<Set<string>> {
    const paths = new Set(["/agent-manifest.json", "/links.json", "/agent-mcp.json"]);
    try {
      const manifest = JSON.parse(await readFile(path.join(this.root, "agent-manifest.json"), "utf8")) as { networks?: Array<{ hocon?: string }>; linking?: { protocol?: string } };
      for (const n of manifest.networks ?? []) {
        if (typeof n.hocon === "string" && !/^[a-z][a-z0-9+.-]*:/i.test(n.hocon)) paths.add(`/${n.hocon.replace(/^(\.\/|\/)+/, "")}`);
      }
      const proto = String(manifest.linking?.protocol ?? "").match(/^([a-z][a-z0-9-]*)-link\/v1$/);
      if (proto) {
        paths.add(`/.well-known/${proto[1]}.json`);
        paths.add(`/.well-known/${proto[1]}-agent.json`);
      }
    } catch {
      // No manifest: only the fixed names.
    }
    return paths;
  }

  async serve(urlPath: string): Promise<StaticFile> {
    let decoded: string;
    try {
      decoded = decodeURIComponent(urlPath);
    } catch {
      return { status: 400, headers: { "content-type": "text/plain" }, body: "Bad request" };
    }
    if (decoded.includes("\0")) return { status: 400, headers: { "content-type": "text/plain" }, body: "Bad request" };
    let file = path.resolve(this.root, `.${path.sep}${decoded}`);
    if (file !== this.root && !file.startsWith(`${this.root}${path.sep}`)) return { status: 403, headers: { "content-type": "text/plain" }, body: "Forbidden" };
    try {
      const info = await stat(file);
      if (info.isDirectory()) {
        if (!urlPath.endsWith("/")) return { status: 301, headers: { location: `${urlPath}/` }, body: "" };
        file = path.join(file, "index.html");
      }
      const real = await realpath(file);
      if (real !== this.root && !real.startsWith(`${this.root}${path.sep}`)) return { status: 403, headers: { "content-type": "text/plain" }, body: "Forbidden" };
      const body = await readFile(real);
      const headers: Record<string, string> = {
        "content-type": TYPES[path.extname(real).toLowerCase()] ?? "application/octet-stream",
        "x-content-type-options": "nosniff",
        "cache-control": urlPath.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
      };
      if ((await this.publicPaths()).has(urlPath)) headers["access-control-allow-origin"] = "*";
      if (urlPath === "/runtime/sandbox-worker.js") headers["content-security-policy"] = WORKER_CSP;
      else if (!urlPath.startsWith("/bridge/")) {
        headers["content-security-policy"] = pageCsp(this.allowPrivate);
        headers["referrer-policy"] = "strict-origin-when-cross-origin";
      }
      return { status: 200, headers, body };
    } catch {
      return { status: 404, headers: { "content-type": "text/plain" }, body: "Not found" };
    }
  }
}
