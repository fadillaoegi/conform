import assert from "node:assert/strict";
import test from "node:test";
import { parseInput } from "../src/url.ts";

test("a network URL splits into site base and network name", () => {
  const { target, problems } = parseInput("https://peer.example/agents/transit");
  assert.deepEqual(problems, []);
  assert.equal(target.siteBase, "https://peer.example/agents");
  assert.equal(target.networkName, "transit");
  assert.equal(target.networkUrl, "https://peer.example/agents/transit");
  assert.equal(target.origin, "https://peer.example");
});

test("a site base with a trailing slash has no network name", () => {
  const { target } = parseInput("http://127.0.0.1:8080/");
  assert.equal(target.siteBase, "http://127.0.0.1:8080");
  assert.equal(target.networkName, null);
});

test("the manifest URL itself points at its folder", () => {
  const { target } = parseInput("https://site.example/agents/agent-manifest.json");
  assert.equal(target.siteBase, "https://site.example/agents");
  assert.equal(target.networkName, null);
});

test("query strings and non-http inputs are problems", () => {
  assert.ok(parseInput("https://site.example/net?x=1").problems.length === 1);
  assert.ok(parseInput("ftp://site.example/net").problems.length === 1);
  assert.ok(parseInput("not a url").problems.length === 1);
});

import { CATALOG, findingGuides, FINDING_GUIDE } from "../src/catalog.ts";

test("every finding guide belongs to an automated check and has a cause and a fix", () => {
  const automated = new Set(CATALOG.filter((c) => c.automated).map((c) => c.id));
  for (const [id, guide] of Object.entries(FINDING_GUIDE)) {
    assert.match(id, /^C\d+\.\d+$/);
    assert.ok(automated.has(id.split(".")[0] as string), id);
    assert.ok(guide.why.length > 20 && guide.fix.length > 10, id);
  }
  assert.match(findingGuides("c2.4")[0]?.fix ?? "", /first in tools\[\]/);
  assert.ok(findingGuides("C3").length >= 5);
  assert.deepEqual(findingGuides("C2.99"), []);
});
