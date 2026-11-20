// Bundle the CLI and its API into self-contained ESM files (no runtime dependencies): @conform/core and the
// pinned reference runtime are inlined. The runtime's LangChain bundle, which checks never load, is
// replaced by a stub. Writes dist-bundle/ and copies it to the repository's action/dist/.
import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(here, "dist-bundle");
const action = path.resolve(here, "../../action/dist");

const stubLangChain = {
  name: "stub-langchain",
  setup(b) {
    b.onResolve({ filter: /agent-runner\.bundle\.js$/ }, () => ({ path: "agent-runner-stub", namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export function runAgentLangChain() { throw new Error('The LangChain runner is not part of the Conform CLI.'); } export default runAgentLangChain;", loader: "js" }));
  },
};

await rm(out, { recursive: true, force: true });
const result = await build({
  entryPoints: { conform: path.join(here, "src/bin.ts"), index: path.join(here, "src/index.ts") },
  outdir: out,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "node",
  target: "node24",
  conditions: ["conform-source"],
  plugins: [stubLangChain],
  legalComments: "eof",
  metafile: true,
  logLevel: "warning",
});
// Shebang for the binary (esbuild keeps the source's, but make sure).
const bin = path.join(out, "conform.mjs");
const text = await readFile(bin, "utf8");
if (!text.startsWith("#!")) await writeFile(bin, `#!/usr/bin/env node\n${text}`);
await rm(action, { recursive: true, force: true });
await mkdir(action, { recursive: true });
await cp(out, action, { recursive: true });
const bytes = Object.values(result.metafile.outputs).reduce((n, o) => n + o.bytes, 0);
console.log(`Bundled ${Object.keys(result.metafile.outputs).length} file(s), ${(bytes / 1024).toFixed(0)} KiB → dist-bundle/ and action/dist/`);
