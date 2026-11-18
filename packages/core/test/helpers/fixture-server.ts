// Starts the upstream serve_site.mjs on a free port for one fixture site, as the task asks:
// the checks run against the committee's examples served the way the skill serves them.
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
export const FIXTURES = path.join(ROOT, "fixtures", "upstream");
const SERVE = path.join(FIXTURES, "serve_site.mjs");

export interface FixtureServer {
  base: string;
  stop(): Promise<void>;
}

export const FIXTURE_NETWORKS: Record<string, string> = {
  pizza_restaurant_agentified: "pizza_restaurant_website_assistant",
  guesthouse_agentified: "tidewhistle_guesthouse",
  harbor_tours_agentified: "marrow_point_harbor_tours",
};

export async function startFixture(name: string): Promise<FixtureServer> {
  const folder = path.join(FIXTURES, name);
  const child: ChildProcess = spawn(process.execPath, [SERVE, folder, "--host", "127.0.0.1", "--port", "0"], { stdio: ["ignore", "pipe", "pipe"] });
  const base = await new Promise<string>((resolve, reject) => {
    let out = "";
    let err = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      out += chunk.toString();
      const match = out.match(/Open (http:\/\/[^\s/]+)\//);
      if (match) resolve(match[1] as string);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      err += chunk.toString();
    });
    child.on("exit", (code) => reject(new Error(`serve_site.mjs exited with ${code}: ${err || out}`)));
    setTimeout(() => reject(new Error(`serve_site.mjs did not print its URL in time: ${err || out}`)), 10_000).unref();
  });
  return {
    base,
    stop: () =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", () => resolve());
        child.kill("SIGTERM");
      }),
  };
}
