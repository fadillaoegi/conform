// Copy the pinned reference runtime into public/runtime, unchanged, after checking every file
// against packages/reference-runtime/HASHES.sha256. The browser assistant loads it from there.
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.resolve(here, "../../../packages/reference-runtime");
const target = path.resolve(here, "../public/runtime");

const lines = (await readFile(path.join(pkg, "HASHES.sha256"), "utf8")).trim().split("\n");
let checked = 0;
for (const line of lines) {
  const [hash, file] = line.split(/\s+/);
  const actual = createHash("sha256").update(await readFile(path.join(pkg, file))).digest("hex");
  if (actual !== hash) {
    console.error(`Runtime file changed: ${file}. The runtime must stay byte for byte as pinned.`);
    process.exit(1);
  }
  checked += 1;
}
await rm(target, { recursive: true, force: true });
await mkdir(path.dirname(target), { recursive: true });
await cp(path.join(pkg, "runtime"), target, { recursive: true });
console.log(`Runtime synced to public/runtime (${checked} files verified).`);
