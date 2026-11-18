// Composition root: start the HTTP server for a configuration.

import { createServer, type Server } from "node:http";
import { createRouter } from "../interface/http/router.ts";
import { StaticSite } from "../interface/http/static-site.ts";
import type { App } from "../interface/app.ts";
import type { Config } from "./config.ts";
import { buildApp } from "./container.ts";

export interface ConformServer {
  server: Server;
  app: App;
  url: string;
  close(): Promise<void>;
}

export async function startServer(config: Config): Promise<ConformServer> {
  const app = await buildApp(config);
  const site = config.staticDir ? new StaticSite(config.staticDir, config.allowPrivate) : null;
  await site?.init();
  const server = createServer(createRouter(app, { trustProxy: config.trustProxy, site, quiet: process.env["CONFORM_QUIET"] === "1" }));
  server.requestTimeout = 120_000;
  server.headersTimeout = 20_000;
  await new Promise<void>((resolve) => server.listen(config.port, config.host, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : config.port;
  return {
    server,
    app,
    url: `http://${config.host.includes(":") ? `[${config.host}]` : config.host}:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
