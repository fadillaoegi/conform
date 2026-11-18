// Render the published manifest and the conform_check network for one public origin, then build and
// validate both networks with the agentify-website skill's build_network.mjs (vendored, no Python).
//   CONFORM_PUBLIC_ORIGIN=https://conform.example.org node scripts/render-agent.mjs [--check]
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const build = path.resolve(web, "../../packages/reference-runtime/skill/scripts/build_network.mjs");
const runtime = path.resolve(web, "../../packages/reference-runtime/runtime");
const origin = (process.env.CONFORM_PUBLIC_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
let parsed;
try {
  parsed = new URL(origin);
} catch {
  console.error(`CONFORM_PUBLIC_ORIGIN is not a URL: ${origin}`);
  process.exit(2);
}
if (parsed.origin !== origin) {
  console.error(`CONFORM_PUBLIC_ORIGIN must be an origin (scheme, host, port), not ${origin}`);
  process.exit(2);
}
const check = process.argv.includes("--check");
const fill = (text) => text.replaceAll("{{PUBLIC_ORIGIN}}", origin);

const manifest = JSON.parse(fill(await readFile(path.join(web, "agent/agent-manifest.template.json"), "utf8")));
await writeFile(path.join(web, "public/agent-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await mkdir(path.join(web, "agent/generated"), { recursive: true });
await writeFile(path.join(web, "agent/generated/conform_check.hocon"), fill(await readFile(path.join(web, "agent/conform_check.template.hocon"), "utf8")));
// build_network validates networks[0] only, so conform_check is validated against a one-network copy.
const single = { ...manifest, networks: manifest.networks.filter((n) => n.name === "conform_check") };
delete single.actions;
single.agent_mcp = { ...manifest.agent_mcp, network: "conform_check", front_man: "conform_checker" };
await writeFile(path.join(web, "agent/generated/conform_check.manifest.json"), `${JSON.stringify(single, null, 2)}\n`);

const run = (args) => execFileSync(process.execPath, [build, ...args, "--runtime", runtime, ...(check ? ["--check"] : [])], { cwd: web, stdio: "inherit" });
console.log("Note: the first build warns that allowed_peers lists this origin while the conform network calls nothing there. That entry is for conform_check (validated second), which calls this origin's /mcp.");
run(["agent/conform.hocon", "--manifest", "public/agent-manifest.json", "--out", "public/conform.network.json"]);
run(["agent/generated/conform_check.hocon", "--manifest", "agent/generated/conform_check.manifest.json", "--out", "public/conform_check.network.json"]);
console.log(`Agent files rendered for ${origin}.`);
