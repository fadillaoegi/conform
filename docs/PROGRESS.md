# Progress

Deadline: 11 January 2027, 16:00 UTC (23:00 WIB). Target submission: 10 January, 21:00 WIB.

## 2026-11-19 — session 8: demo caller, npm package, GitHub Action, video script

- `apps/demo-caller` (Waypoint Desk): an agentic site built the agentify-website way that calls Conform's
  `conform_check` before handing off to a partner (Tidewhistle Guesthouse). Builds with the skill's checker with
  no warnings; the organizers' `check_partner.mjs` (now vendored in `packages/reference-runtime/scripts/`)
  accepts Conform as its partner. End-to-end test across three sites (Waypoint Desk, a real Conform server
  process with MCP, the guesthouse): two consent cards in order, nothing sent before each card, a decline sends
  nothing, the key only at the router. Locally served on http://[::1]:8096 (three host names, so the loopback
  key cookie never crosses sites).
- `packages/cli` is publishable as `agentic-web-conformance` (name free on npm on 2026-11-19): an esbuild bundle
  (core + pinned runtime inlined, LangChain runner stubbed), 80.6 kB packed, 7 files, no dependencies; installed
  offline from the tarball in an empty project and run with npx. New `--summary` (Markdown) option.
- `action/`: composite GitHub Action running the committed bundle (`action/dist`), with job summary and
  outputs; simulated locally (pass exits 0, fail exits 1, outputs written).
- `submission/VIDEO-SCRIPT.md`: storyboard and narration for a 1:52 video.
- Tests: 84 pass (core 34, server 22, web 7, CLI 19, demo 2).
- Not done (needs the user): publish to npm (account), push the repo (user's task), deploy.

## 2026-11-18 — session 7: video intro and closing

- `submission/`: `intro.mp4` and `outro.mp4` (8 s each, 1080p30, AAC stereo), rendered with Remotion 4.0.539
  from `submission/video` (CSS 3D voxels lit per face from the camera rotation, pixel starfield, perspective
  grid). The story follows the logo: the cube assembles, the keystone locks; in the closing C1–C9 light up.
- All sound is synthesized (`scripts/make-audio.mjs`) from the shared timeline: no third-party music,
  samples or brands, as the rules require. Key stills in `submission/stills/`.
- The closing can show the site's address once it is live (`CONFORM_URL=... pnpm render:outro:url`).

## 2026-11-18 — session 6: logo, live assistant test with a real model

- Logo "The Keystone" (voxel pixel art, `apps/web/scripts/make-logo.mjs`, `docs/brand/LOGO.md`); used as header and favicon.
- The user tested the site locally (`pnpm serve`) with their own Otari key and `alibaba/qwen3.8-flash`.
  Checker, JSON report, consent dialog and decline: correct. Report fixes: harness URLs normalized
  (no "./"), C7–C9 durations now include their scripted turns.
- Assistant findings and fixes (each re-tested by the user):
  1. "What does Conform check?": accurate.
  2. Check a site: the tool call and consent dialog work; after a decline the model speculated that http
     URLs may be blocked, from an over-broad limit sentence. Replaced with facts (see 4).
  3. "Why would C2.4 fail?": the model guessed causes because explain_check returned only a one-line summary.
     Added per-finding guides (`FINDING_GUIDE` in core, shared by the site, MCP and CLI), a ready-made
     `explanation` text in the tool result, and a rule to call the tool before explaining. Now correct in
     substance; the small model still softens the exact rule ("first agent with instructions in tools[]").
  4. "Can you fix my manifest?": honest refusal with useful alternatives; it still claimed plain-http URLs
     cannot be checked, inferred from report text. `website_get_page_state` now states the real URL rules
     (`urlRules`, based on where Conform runs) and the URL format with an example.
- Open: compare with a larger model on Otari before choosing the default model for the demo.
- First real-web check (once, polite): the organizers' listed site https://worldwideagenticweb.org has no
  agent-manifest.json at its root; at the widget folder
  `…/wwaw-agent-widget/assets/worldwide_agentic_web_widget/v1.0.9/` the manifest, network and links.json are
  served **without Access-Control-Allow-Origin** (confirmed with curl, Cloudflare in front), so another site's
  browser cannot load the network (spec §3.2 MVP boundary, §3.3, §3.4). C3–C9 pass in Node, which does not
  enforce CORS. Candidate for a friendly upstream issue; the user decides.

## 2026-11-17 — session 5: Clean Architecture for the service

The user asked for Clean Architecture. `apps/server` was restructured into `domain/` (pure badge and
directory rules), `application/` (use cases + ports), `infrastructure/` (adapters: SSRF-guarded fetch,
Ed25519 signer, file repository, core checker, cache, clock), `interface/` (HTTP router, MCP controller,
static site, SVG presenter) and `main/` (composition root). Behavior unchanged: all 15 existing server tests
pass unmodified in substance. Added `test/use-cases.test.ts` (every use case with in-memory fakes) and
`test/architecture.test.ts`, which scans imports and fails on any outward dependency; it was proven by
injecting a violation (caught, then reverted). Layer rules are documented in `apps/server/README.md`.
The site (`apps/web`) keeps its small layered shape: `page.ts` (state and operations), `render.ts` and
`badges.ts` (presentation), `service.ts` (gateway to the server), `verify.ts` (pure verification).

## 2026-11-17 — session 4: application complete (C7–C9, service, badges, directory, MCP)

The user asked to finish the application before deploying. Done:

- **Checks C7–C9** (`packages/core/src/harness/turn.ts`, `checks/runtime-trust.ts`): a scripted conversation turn
  runs the site's network as a peer in a synthetic caller on the pinned runtime, with a random canary key and
  private value and an OpenAI-compatible SSE stub router. Requests are recorded as flags only. C7: key only at
  the caller's router, the site's manifest cannot switch the router, no key in prompts or trace. C8: no
  private context by default; with an allow rule only the named field. C9: consent before the first request,
  naming origin and request; a decline sends nothing; the site's page (and its imported chunks) wires a
  consent card. All three committee examples and Conform pass.
- **Service** (`apps/server`, Node 24, no outside dependencies): Ed25519 badges bound to manifest + network
  SHA-256 (30 days; *stale* when files change, checked live), public key at
  `/.well-known/conform-badge-key.json`, directory, MCP endpoint (`check_site`, `badge_status`,
  `explain_check`; JSON-RPC as the reference runtime's client speaks it), static serving with the spec's
  headers. SSRF guard: https and port 443 only in production, IP checked at connect time (blocks loopback,
  private, link-local, metadata; defeats DNS rebinding), size and time limits, rate limits, one check at a time.
  Production refuses to start without a key file outside the repo or with a non-HTTPS origin.
- **Second network `conform_check`** for other sites: rendered for `CONFORM_PUBLIC_ORIGIN`, calls this
  origin's `/mcp`, validated with the skill's build script. Proven end to end: it passes C1–C9 as a peer.
- **Site**: badge panel (issue, Markdown/HTML snippets), Verify view (`?badge=<id>`: WebCrypto Ed25519 signature,
  id, issuer, expiry, and re-hash of the site's files in the browser), searchable directory, nine-cell progress
  bar. Core now shares the check catalog, compact report and badge format with the site and the service.
- **Deploy** rewritten: Docker Compose (Conform + Caddy) recommended, systemd + Caddy/nginx alternative. The
  compose stack was built and run locally in an isolated project: both networks pass through Caddy, a badge
  survives a restart, MCP works through the proxy, production guards work. Test containers, volumes, image and
  key were removed afterwards; the user's containers were not touched.
- Tests: 72 pass (core 33, server 15, web 7, CLI 17). Root `pnpm test` runs packages one at a time (web and
  server tests both build the site). Verified in headless Chrome: full flow (check C1–C9 in the browser, issue
  badge, directory, verify 7/7), no console errors.

Next:

1. Deploy (user): domain + DNS, `apps/web/deploy/README.md` Option A, then `pnpm conform check https://<domain>/conform`
   and `/conform_check`.
2. Live assistant test with the user's Otari key on the deployed site.
3. Community tools: GitHub Action, npm publish (bundle core into the CLI), PR adding Conform to
   `docs/agentic_websites.md`, upstream issue about the pizza example's missing `actions.bridge`.
4. Remaining checks C10–C14; video and Devpost text in January.

## 2026-11-17 — session 3: the Conform site (apps/web)

Done:

- `apps/web` (Vite 7 + TypeScript, no framework), pixel-art theme (Sweetie 16 palette, Press Start 2P for
  headings, Pixelify Sans for text, self-hosted through Fontsource): URL form, a six-cell progress bar, report
  with stamp, counters, per-check findings with fix and spec chips, "only problems" and "evidence" toggles,
  copy-link (fills the URL, never auto-runs) and JSON download, check catalogue C1–C14.
- The checker runs in the browser: `@conform/core` is bundled from its TS sources; the harness now passes
  other origins through (spec §3.2.6 allows a definition on another origin) and reports them; a `onCheck`
  callback drives the progress bar; browser fetch failures get a plain explanation.
- Conform is itself an agentic website: `agent/conform.hocon` (front agent `conform_guide`) built with the
  skill's own `build_network.mjs` (vendored in `packages/reference-runtime/skill/`, no warnings), manifest with
  closed peer policy, bridge and discovery files, the pinned runtime synced into `public/runtime/` after a hash
  check, and three site actions: `get_page_state` (read), `check_site` (confirmation dialog first, because it
  contacts another origin), `explain_check` (read). Page and assistant share one `ConformPage` object.
- Tests: 7 web tests, including self-conformance (build, serve with `serve_site.mjs`, Conform checks Conform:
  0 fail, 0 warn). Total 52 tests pass.
- Verified in headless Chrome over CDP: no console errors, checks run from the form, the confirmation dialog,
  no horizontal scroll at 390 px. Fixed on the way: Pixelify Sans ligatures ("fi" showed as one glyph), grid
  overflow on phones, Vite inlining fonts as data: URIs (blocked by the CSP).
- Deploy for the user's VPS (`apps/web/deploy/`): Caddyfile and nginx configs with CORS on public artifacts
  only, `.mjs` as JavaScript, worker CSP, frameable bridge and a restrictive page CSP. Both tested in Docker
  (temporary containers, removed afterwards): CLI 28 pass / 0 fail / 0 warn, assistant boots in Chrome.
- Screenshots in `docs/images/`.

Not done / next:

1. User: choose the domain, point DNS at the VPS, deploy with `apps/web/deploy/README.md`, then run
   `pnpm conform check https://<domain>/conform`.
2. Live test of the assistant with the user's Otari key on the deployed site (the user enters the key in the
   page, never in chat).
3. The assistant can only use its website_* tools on Conform's own page. Another agentic site that calls the
   `conform` network gets no site tools (runtime rule), so it can explain Conform but not run a check. To make
   "is site X conformant?" answerable for other sites: a small MCP endpoint on the VPS running `@conform/core`
   server-side (with rate limits), referenced from the network. Decide after deployment.
4. C7–C9, badge, GitHub Action, npm publish (bundle core into the CLI), directory, PR to agentic_websites.md,
   an upstream issue about the pizza example's missing `actions.bridge`.

## 2026-11-17 — session 2: CLI

Done:

- `packages/cli` (npm name `agentic-web-conformance`, binary `conform`): `conform check <url>` with text
  output (colors on a terminal, `NO_COLOR` respected), `--json`, `--out`, `--static-only`, `--origin`,
  `--timeout`, `--fail-on fail|warn`, `--evidence`, `--problems`, `--help`, `--version`. Exit codes 0 / 1 / 2.
- Root script `pnpm conform ...` runs the TypeScript sources directly (export condition `conform-source`);
  `pnpm -r build` emits `dist/` and the built `dist/bin.js` was run against the harbor tours fixture.
- 17 CLI tests (argument parsing, `run()` against in-memory sites, and the real binary against the three
  fixtures served by `serve_site.mjs`). Total 45 tests pass.
- Real finding on the committee's pizza example: its manifest declares `actions` without `actions.bridge`,
  so a caller on the reference runtime waits 10 s for a bridge and never runs the network (C1.7 warning).
  Guesthouse and harbor tours are clean. Worth reporting upstream as an issue later.
- `.env.example` added; `.env` is local and gitignored. Devpost and Otari done by the user; the first Otari key
  was pasted into a chat and should be rotated.

Next:

1. `apps/web` (pixel theme) + Conform's own agent network, BYOK panel, hosting (Cloudflare Pages suggested).
2. Publish to npm: `@conform/core` must be published too (or bundled into the CLI) because the CLI depends
   on `workspace:*`. Decide the npm scope/name and whether the user has an npm account.
3. GitHub Action wrapping `conform check`.
4. Checks C7–C9, badge.

## 2026-11-16 — session 1: research, matrix, scaffold, core C1–C6

Done:

- Cloned `cognizant-ai-labs/agentic-web` at `63a956c` (scratchpad only); read the spec (file commit `fd872b9`),
  the skill, its runtime (nsdeploy `53a787c` + edits), `serve_site.mjs`, `check_partner.mjs`, the linking tests
  and the three agentified examples. Findings in `docs/SPEC-NOTES.md`.
- Wrote the requirement-to-check matrix: `docs/TEST-MATRIX.md` (37 requirement sentences, 14 check groups).
- Scaffolded the pnpm monorepo (TypeScript strict, Node 24 type stripping, `node --test`, no extra test deps).
- Pinned the reference runtime in `packages/reference-runtime/` with SHA-256 hashes, and the three examples
  plus `serve_site.mjs` in `fixtures/upstream/`.
- `packages/core`: checks C1–C6, report types, fetcher with CORS and redirect evidence, synthetic-caller
  harness that loads the pinned runtime in Node with a stub `fetch`, secret masking.
- 28 tests pass (`pnpm -r test`, about 1 s): the three committee examples served by `serve_site.mjs` on free
  ports are fail-free and reach every harness pass; 18 mutated in-memory sites produce the expected failing
  finding (missing manifest, bad JSON, no CORS, wrong CORS origin, missing router or policy, plain http,
  cross-origin redirect, wrong name, unparseable definition, front_man mismatch, links.json without CORS,
  missing reference, duplicate names, `${...}` substitution, `include`, leaked key, peer outside policy).
- Sample report: `docs/SAMPLE-REPORT.md`.

Decisions:

- Tests 4–6 are runtime behaviors. A caller runs the peer's definition in its own runtime, so Conform proves
  them for "the site as a peer" by loading the site's real artifacts into the pinned reference runtime (same
  technique as upstream `tests/linking`). Whether the site's own visitors get the same behavior depends on the
  runtime the site ships: that is check C10 (fingerprint), planned.
- The harness strips `actions` from the target manifest so no bridge frame is needed in Node; C11 covers
  actions later.
- Reference-implementation extensions (`agent-mcp.json`, `.well-known`, `actions.bridge`, `linking`) are
  reported as `info`/`warn`, never as spec `fail`.
- `apps/web` will use a pixel-art theme (user decision).
- Apache-2.0 for the whole repository, matching the vendored runtime.

Not done / next:

1. Devpost registration done and Otari account created by the user (2026-11-17). Otari key goes in the local `.env` only (template: `.env.example`). The first key was pasted into a chat and must be revoked and replaced.
2. `packages/cli`: `conform check <url>` with JSON and text output, exit code 1 on `fail`.
3. `apps/web`: Vite + TS, pixel theme; run the checks in the browser (the harness installs a temporary
   `window.fetch` stub for the duration of a run); shareable report page; Conform's own `agent-manifest.json`
   and network; BYOK panel via the reference runtime; HTTPS hosting.
4. Checks C7–C9 (key leak, private context, consent) with a scripted router in the harness, then C10–C14.
5. Badge (Ed25519, bound to manifest + definition SHA-256), `/.well-known/` public key, verifier page.
6. GitHub Action, directory JSON, PR to `docs/agentic_websites.md`, video, Devpost text.

Open questions:

- In the browser, `Access-Control-Allow-Origin` is not readable; C1.2/C2.3 then rely on "the cross-origin
  fetch succeeded". The CLI gives the header value. Decide whether the web UI should say so explicitly.
- `peer_policy.mode: "open"` is reported as `warn`; confirm that reading of §3.3/§5 with the organizers if
  they answer questions.
