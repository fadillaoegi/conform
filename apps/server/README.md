# Conform service (`apps/server`)

Signed badges, the directory, the MCP endpoint and (optionally) the static site, in one Node 24 process with
no dependencies outside this repository. Built with Clean Architecture: dependencies point inward only, and
`test/architecture.test.ts` fails the build when an import breaks that rule.

```text
src/
  domain/            Entities and rules. Pure: no I/O, no clock, no crypto.
    badge.ts           Badge, eligibility, payload, expiry, state from observed hashes
    directory.ts       Directory entries (one per network, newest first)
    errors.ts          ValidationError, ServiceBusyError
  application/       Use cases and the ports they need.
    ports.ts           ConformanceChecker, UrlPolicy, BadgeSigner, BadgeRepository, ArtifactProbe, Cache, Clock
    use-cases/         CheckSite, IssueBadge, GetBadge, ListDirectory, FindBadgeForNetwork, ExplainCheck, GetHealth
    badge-view.ts      What clients receive for a badge
  infrastructure/    Adapters that implement the ports.
    safe-fetch.ts      SSRF-guarded fetch (https:443 only in production, IP checked at connect time)
    url-policy.ts      Input shape + SSRF rules
    core-checker.ts    @conform/core checkNetwork, one check at a time
    ed25519-signer.ts  Ed25519 signing (node:crypto) and the reference verifier
    file-badge-repository.ts, http-artifact-probe.ts, ttl-cache.ts, system-clock.ts, serial-queue.ts
  interface/         Delivery: translate requests into use-case calls.
    http/router.ts     REST + CORS + rate limits + error mapping
    http/static-site.ts  The built site with the spec's headers
    mcp/mcp-controller.ts  MCP (JSON-RPC 2.0 over HTTP) for other sites' runtimes
    presenters/badge-svg.ts  The badge image
  main/              Composition root: config from the environment, wiring, server start.
  main.ts            Entry point
```

| Layer | May import |
| --- | --- |
| domain | domain; pure helpers and types of `@conform/core` |
| application | domain, application; pure helpers and types of `@conform/core` |
| infrastructure | domain, application, infrastructure, `node:*`, `@conform/core` |
| interface | domain, application, interface, `node:*`; pure helpers and types of `@conform/core` |
| main | everything |

"Pure" core exports are those without I/O (`canonicalJson`, `compactReport`, `compactText`, `checkInfo`,
`CATALOG`, `parseInput`, version constants). `checkNetwork`, which reaches the network, is used only by the
`CoreConformanceChecker` adapter.

Tests: `test/use-cases.test.ts` runs every use case against in-memory fakes of the ports;
`test/server.test.ts` runs the whole service against the committee's example sites; `test/safe-fetch.test.ts`
covers the SSRF guard; `test/badge.test.ts` checks node:crypto signing against the browser's WebCrypto verifier.

Run: `pnpm dev:server` from the repository root. Settings and production use: `apps/web/deploy/README.md`.
