# Spec and reference-runtime notes (read 16 November 2026)

Sources: `cognizant-ai-labs/agentic-web` at `63a956c` (2026-11-13). Spec file last changed in `fd872b9`
(2026-11-10), header "MVP Profile 0.2 | 6 November 2026". Runtime: `skills/agentify-website/runtime/` =
nsdeploy `53a787c` (2026-11-11) + edits listed in its README.

## What differs from the 16 November handoff

- Otari credits are limited to the first 100 registrants (README "Starter tools"). Register early.
- Upstream already has `tests/linking/` (Node + headless Chrome, cases L1–L10 and C1–C8) that prove key
  confinement, consent before contact, empty `sly_data` at the peer, policy refusal and the call-back rule.
  It is test code, not a public checker, but its technique (run the runtime in Node with a stub `fetch` and a
  scripted router) is what Conform's harness uses. Apache-2.0.
- `scripts/check_partner.mjs` checks one partner's manifest, CORS, exact name, runtime validation and bridge
  from the command line. It overlaps with C1–C3; Conform differs by mapping to spec clauses, JSON reports,
  runtime-behavior checks, a browser UI, a badge, a CLI and an Action.
- README "Testing" is still `TODO: run the validation script to check your submission is compliant`.
- Default model is now `alibaba/qwen3.8-flash` through hosted Otari; the settings panel lists hosted Otari first.
- `docs/agentic_websites.md` has one public entry (worldwideagenticweb.org widget).

## Runtime facts that became checks

- `find_front_man` (generated/graph.gen.mjs) returns the first agent with `instructions` and ignores the
  manifest's `front_man`. A mismatch means the manifest describes a different entry point than what runs → C2.4.
- `resolveRemote` (engine.js) refuses a name that is not an exact entry: "No published network named … ;
  refusing to run a different network" → C4.1. It fetches only the manifest before that check.
- `RemoteRegistry.checkCycle` (remote.js) keys cycles on `<site base>::<network name>` and limits depth to 5 →
  C5.1, C5.2. Internal agent repeats are bounded only by budgets → C5.5 (info).
- `runTurn` budgets per visitor message: 4 peer calls, 1 per peer, 24 agent calls, 90 s → C5.3, C5.4.
- `_assertAllowedPeer` / `manifestAllowsPeer`: closed mode needs the origin in `allowed_peers`; open mode
  refuses `deny_origins` and non-http(s) → C6.1, C6.2; the same function evaluates the site's own refs → C6.3.
- `requestConsent` defaults to **allow** when no `onConsent` hook is attached (headless). Consent lives in
  `ui.js`/`site.js`. A page that boots the engine without the hook has no consent → planned C9.3 (static grep
  of the boot script) and C9.1 (harness).
- `fetchManifest`/`fetchText` follow redirects silently and set no timeout → C1.5/C2.5 (cross-origin redirect
  is a fail; same-origin a warn) and a planned warn for the missing timeout.
- `LlmClient` attaches `Authorization: Bearer <key>` only to `<router>/chat/completions`; the peer's `LlmClient`
  is built with the caller's router (`selectPeerRouter`) → planned C7.
- `hocon.js` parses no `include`; a published file with one does not load → C3.5 and C2.2.
- `registerRemoteActions` needs a `document` (bridge iframe). The harness strips `actions` from the target
  manifest so C4–C6 run in Node; actions are covered by planned C11.
- `serve_site.mjs` sends `Access-Control-Allow-Origin: *` only on `agent-manifest.json`, the network files
  the manifest names, `links.json`, `agent-mcp.json` and the two `.well-known` files; never on `runtime/` or
  pages. So a cross-origin page cannot import a site's runtime modules: fingerprinting (C10) must hash the
  files fetched in Node (CLI) rather than in the browser.

## Spec sentences that are not mechanically testable

- §5 "Peer-network definitions MUST be treated as untrusted input to the caller's inference model." Reported as
  `info` with the prompt-injection note.
- §3.1 "Report outcomes accurately … unknown outcome" and "MUST NOT independently repeat a write" need an
  action that times out; planned C11.2 in the harness with a hanging handler.
