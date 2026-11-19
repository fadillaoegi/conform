// Clean Architecture dependency rule, enforced: every import in apps/server/src points inward.
//   domain          -> domain, and pure parts of @conform/core
//   application     -> domain, application, and pure parts of @conform/core
//   infrastructure  -> domain, application, infrastructure, node:*, @conform/core
//   interface       -> domain, application, interface, node:*, and pure parts of @conform/core
//   main            -> anything (composition root)
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
type Layer = "domain" | "application" | "infrastructure" | "interface" | "main";
const ALLOWED: Record<Layer, Layer[]> = {
  domain: ["domain"],
  application: ["domain", "application"],
  infrastructure: ["domain", "application", "infrastructure"],
  interface: ["domain", "application", "interface"],
  main: ["domain", "application", "infrastructure", "interface", "main"],
};
const NODE_OK: Record<Layer, boolean> = { domain: false, application: false, infrastructure: true, interface: true, main: true };
// Pure, I/O-free exports of @conform/core that inner layers may use at run time. checkNetwork (which
// does network I/O) is reachable only from infrastructure.
const CORE_PURE = new Set(["canonicalJson", "compactReport", "compactText", "checkInfo", "findingGuides", "FINDING_GUIDE", "CATALOG", "parseInput", "CONFORM_VERSION", "SPEC", "RUNTIME"]);

async function files(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await files(full)));
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

function layerOf(file: string): Layer {
  const rel = path.relative(SRC, file);
  const first = rel.split(path.sep)[0] ?? "";
  if (first === "main.ts") return "main";
  if (["domain", "application", "infrastructure", "interface", "main"].includes(first)) return first as Layer;
  throw new Error(`${rel} is outside the layer folders`);
}

interface Import {
  source: string;
  typeOnly: boolean;
  names: string[];
}

function imports(text: string): Import[] {
  const out: Import[] = [];
  for (const m of text.matchAll(/^\s*(import|export)\s+(type\s+)?(\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+["']([^"']+)["']/gm)) {
    const clause = m[3] ?? "";
    const named = clause.match(/\{([\s\S]*)\}/)?.[1] ?? "";
    const names = named.split(",").map((s) => s.trim()).filter(Boolean);
    const allTyped = names.length > 0 && names.every((n) => n.startsWith("type "));
    const hasDefaultOrStar = /^\s*[\w*]/.test(clause.replace(/\{[\s\S]*\}/, "").replace(/^type\s+/, "")) && !clause.trim().startsWith("{");
    out.push({ source: m[4] as string, typeOnly: !!m[2] || (allTyped && !hasDefaultOrStar), names: m[2] ? [] : names.filter((n) => !n.startsWith("type ")).map((n) => n.split(/\s+as\s+/)[0] as string) });
  }
  return out;
}

test("every import in apps/server/src respects the dependency rule", async () => {
  const violations: string[] = [];
  for (const file of await files(SRC)) {
    const layer = layerOf(file);
    const rel = path.relative(SRC, file);
    for (const imp of imports(await readFile(file, "utf8"))) {
      if (imp.source.startsWith(".")) {
        const target = layerOf(path.resolve(path.dirname(file), imp.source));
        if (!ALLOWED[layer].includes(target)) violations.push(`${rel} (${layer}) imports ${imp.source} (${target})`);
      } else if (imp.source.startsWith("node:")) {
        if (!NODE_OK[layer] && !imp.typeOnly) violations.push(`${rel} (${layer}) imports ${imp.source}`);
      } else if (imp.source === "@conform/core") {
        if (layer === "domain" || layer === "application" || layer === "interface") {
          const impure = imp.typeOnly ? [] : imp.names.filter((n) => !CORE_PURE.has(n));
          if (impure.length) violations.push(`${rel} (${layer}) uses impure core exports: ${impure.join(", ")}`);
        }
      } else if (layer !== "infrastructure" && layer !== "main") {
        violations.push(`${rel} (${layer}) imports package ${imp.source}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("the rule checker itself catches a violation", () => {
  const sample = imports('import { checkNetwork, type Report } from "@conform/core";\nimport type { X } from "../infrastructure/x.ts";\nimport { readFile } from "node:fs/promises";');
  assert.deepEqual(sample.map((i) => [i.source, i.typeOnly, i.names]), [
    ["@conform/core", false, ["checkNetwork"]],
    ["../infrastructure/x.ts", true, []],
    ["node:fs/promises", false, ["readFile"]],
  ]);
});
