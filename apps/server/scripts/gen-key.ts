// Create the Ed25519 badge-signing key. Keep it outside the repository and readable only by the service.
//   pnpm --filter @conform/server gen-key /etc/conform/badge-signing-key.pem
import { generateKeyPairSync } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const target = process.argv[2];
const repo = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
if (!target) {
  console.error("Usage: gen-key <path outside the repository>");
  process.exit(2);
}
const file = path.resolve(target);
if (file.startsWith(`${repo}${path.sep}`)) {
  console.error("Refusing to write a private key inside the repository.");
  process.exit(2);
}
if (existsSync(file)) {
  console.error(`${file} already exists; not overwriting it.`);
  process.exit(2);
}
const { privateKey } = generateKeyPairSync("ed25519");
await writeFile(file, privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600, flag: "wx" });
console.log(`Wrote ${file} (mode 600). Set CONFORM_SIGNING_KEY_FILE=${file}.`);
