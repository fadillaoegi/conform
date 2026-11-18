import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { assertAllowedUrl, createSafeFetch, guardedLookup, isBlockedAddress } from "../src/infrastructure/safe-fetch.ts";

test("private, loopback, link-local, metadata and reserved addresses are blocked", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.5", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
    assert.equal(isBlockedAddress(ip), true, ip);
  }
  for (const ip of ["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(isBlockedAddress(ip), false, ip);
});

test("the public service accepts only https URLs on the standard port with public host names", () => {
  for (const url of ["http://example.org/a", "https://example.org:8443/a", "https://localhost/a", "https://127.0.0.1/a", "https://[::1]/a", "https://169.254.169.254/latest", "https://user:pw@example.org/a", "https://printer.local/a", "ftp://example.org/a", "file:///etc/passwd"]) {
    assert.throws(() => assertAllowedUrl(url, false), Error, url);
  }
  assert.equal(assertAllowedUrl("https://example.org/agents/net", false).hostname, "example.org");
  assert.equal(assertAllowedUrl("http://127.0.0.1:8080/net", true).port, "8080");
});

test("DNS answers are checked at connect time (a public-looking name that resolves to loopback is refused)", async () => {
  const lookup = guardedLookup(false);
  const error = await new Promise<Error | null>((resolve) => lookup("localhost", { all: true }, (err) => resolve(err)));
  assert.match(String(error?.message), /may not contact/);
  const allowed = await new Promise<unknown>((resolve) => guardedLookup(true)("localhost", { all: true }, (_e, a) => resolve(a)));
  assert.ok(Array.isArray(allowed) && allowed.length > 0);
});

test("in development mode it fetches loopback sites, follows redirects and limits size", async () => {
  const server = createServer((req, res) => {
    if (req.url === "/redirect") return void res.writeHead(302, { location: "/ok" }).end();
    if (req.url === "/big") return void res.writeHead(200).end(Buffer.alloc(200_000));
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" }).end(JSON.stringify({ seen: req.headers["cookie"] ?? null }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  try {
    const safe = createSafeFetch({ allowPrivate: true, maxBytes: 100_000 });
    const followed = await safe(`http://127.0.0.1:${port}/redirect`, { headers: { cookie: "secret=1" } });
    assert.equal(followed.status, 200);
    assert.deepEqual(await followed.json(), { seen: null }, "cookies are never forwarded");
    const manual = await safe(`http://127.0.0.1:${port}/redirect`, { redirect: "manual" });
    assert.equal(manual.status, 302);
    await assert.rejects(safe(`http://127.0.0.1:${port}/big`), /larger than/);
    const strict = createSafeFetch({ allowPrivate: false });
    await assert.rejects(strict(`http://127.0.0.1:${port}/ok`), /HTTPS sites only/);
  } finally {
    server.close();
  }
});
