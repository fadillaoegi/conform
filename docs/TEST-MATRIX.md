# Conform test matrix

Spec: `docs/worldwide_agentic_web_mvp_spec.md`, "MVP Profile 0.2 | 6 November 2026", file commit
`fd872b9221aeb8ff762b75a5badbf84b23c133cc` (2026-11-10) in `cognizant-ai-labs/agentic-web`, repo HEAD
`63a956cf4653f610b1c238c70946f4d7647d17a8` (2026-11-13). Reference runtime: `skills/agentify-website/runtime/`
= nsdeploy commit `53a787c` (2026-11-11) plus the skill's edits (see its README.md).

Legend. **Mode**: `static` = fetch public artifacts only (browser or Node, no LLM); `harness` = run the pinned
reference runtime in Node with a stub `fetch` and a scripted router (no LLM, no network); `browser` = needs a real
page, a visitor and a consent card (manual or headless Chrome). **Scope**: `site` = the publisher's artifacts and
network; `runtime` = the runtime a site ships to its own visitors; `caller` = what a caller (Conform itself)
does when it loads the site.

Result per check: `pass` | `fail` | `warn` | `info` | `untestable` (with reason). Every result carries evidence
(URL, status, headers, JSON path, error text) and a suggestion.

## A. Requirement sentences → checks

| # | Spec § | Requirement (MUST / MUST NOT) | Check ID | Concrete test | Automatable evidence | Mode / scope |
|---|---|---|---|---|---|---|
| R1 | 2 | Canonical representation MUST follow the Neuro SAN HOCON reference | C3.1–C3.4 | Parse the published definition; validate shape (`tools[]`, `name`, `function.description`, `instructions`, `tools` refs) with a TS schema mirroring the reference and the runtime's `validate_network` | Parse result; list of schema violations with JSON paths | static / site |
| R2 | 2 | Published form MUST preserve the data model and MUST NOT depend on local includes, env substitutions, publisher-only paths | C3.5 | Scan raw text and parsed tree for `include`, `${...}`, `?:`, `file://`, `/Users/`, `C:\`, `.hocon` paths to local files; unresolved `{token}` after `commondefs` expansion | Offending snippet + path | static / site |
| R3 | 2.1 | A network MUST explicitly name private-context fields that may pass downstream/upstream | C3.6 | If any `allow.to_downstream.sly_data` / `to_upstream.sly_data` exists it must be an array of field names; `"*"` → warn; none → info "deny-by-default" | JSON path + value | static / site |
| R4 | 2.1 | Runtime MUST fail closed and report unavailable capabilities clearly; MUST NOT bypass browser security controls | C6.3, C9.4 | Harness: MCP/peer whose origin is refused → tool result is an error string, no fetch issued. Static: `tools` referencing an MCP/peer origin absent from `allowed_peers` while `peer_policy.mode=closed` → fail (the site's own calls would be refused) | Harness trace + stub-fetch log; static JSON paths | harness / runtime; static / site |
| R5 | 2.2 | The minimum network definition MUST be declarative data | C3.5, C3.9 | No executable content: `class` entries only when manifest declares `coded_tools.bundle` (info: optional extension); no inline JS | JSON paths | static / site |
| R6 | 2.2 | Instructions/schemas MUST NOT be treated as a confidentiality mechanism | C3.8 | Secret scan over manifest + definition: `sk-…`, `otk_…`, `Bearer`, `api_key`, `password`, JWT-like strings | Masked match + path | static / site |
| R7 | 3 | A runtime MUST be usable from a normal web page and MUST execute the graph in JavaScript | C10.1 | GET site base `index.html` → 200, contains `<script type="module">`; GET `runtime/engine.js` (or the module the page loads) → JS content type | Status, content type, script list | static / site |
| R8 | 3.1 | Reject malformed networks… before any model call | C3.*, C5.4 | Harness: a mutated copy of the site's definition (missing agent ref, no tools) → `_compile` throws before any router request | Error text + "router requests: 0" | harness / runtime |
| R9 | 3.1 | Runtime MUST validate arguments and show destination and arguments before a write/irreversible operation | C11.1 | Browser: trigger an `irreversible` action; a dialog listing destination + arguments appears before the handler runs. Static (partial): `actions.agentTools` names and effects declared in the actions module | Screenshot / DOM assertion; static: declared effects | browser / runtime (static partial) |
| R10 | 3.1 | Timeouts after a write MUST be reported as unknown outcome; runtime MUST NOT repeat a write whose outcome is unknown | C11.2 | Harness with an action handler that throws/hangs → receipt status "unknown"; no second call | Receipt + handler call count | harness / runtime (later) |
| R11 | 3.1 | Repeated invocation of the same agent MUST NOT by itself be treated as a cycle | C5.3 | Harness: scripted router calls the same internal agent twice → both run (until budget) with no cycle error | Trace spans | harness / runtime |
| R12 | 3.2.1 | HTTPS required except local development | C1.4 | Site base and every artifact URL is `https:` unless host is loopback | URL list | static / site |
| R13 | 3.2.2 | A user key is sent only to the router and never to the peer site | C7.1 | Harness: caller with key `sk-test…` loads the site's network; every stub-fetch request is recorded with "has Authorization", "has cookie", URL; only router requests may carry the key; body text must not contain the key | Request log (flags only, never the key) | harness / caller |
| R14 | 3.2.4 | Interactive runtime MUST provide a consent mechanism; MUST identify origin and purpose and obtain approval before each contact; relaxations only by explicit user choice | C9.1–C9.3 | Harness: `onConsent` hook receives `{peerOrigin, purpose/request}` **before** any fetch to the peer; decline → zero peer requests + honest tool result. Static: the page's boot script sets `engine.onConsent` (reference runtime defaults to allow when no hook is attached) | Order of events in log; grep of `onConsent` | harness / caller; static / site; browser for the card UI |
| R15 | 3.2.5 | Runtime selects the manifest entry whose name exactly matches; if none, it MUST fail rather than select another network | C4.1–C4.3 | Harness: `resolveRemote("<base>/<name>-missing")` → error "No published network named…"; `resolveRemote("<base>/<name>")` → session. Static: network names unique and unambiguous after case/punctuation normalization; `linking.exports[].url` equals the entry name | Error text; list of names | harness / caller; static / site |
| R16 | 3.2.6 | Runtime resolves `hocon` against the site base, fetches and validates before execution | C2.2 | Fetch resolved URL (relative or absolute http(s)); 200; parse; validate | URL, status, validation | static / site |
| R17 | 3.2.7 | Private context MUST NOT return through the tool-result path unless explicitly permitted | C8.1 | Harness: caller sends `sly_data:{secret:"X"}`; the peer's run gets `{}` in the `remote_call` trace; its answer returned to the caller contains no `X` unless `allow.to_upstream.sly_data` names it | Trace payload (redacted) + answer text | harness / caller |
| R18 | 3.2 MVP boundary | A runtime MUST retrieve and instantiate the definition identified by a peer URL | C2.4 | Harness: `resolveRemote` on the site's network URL returns a compiled session (no model call) | Session network name + front agent | harness / caller |
| R19 | 3.2 MVP boundary / 3.3 / 3.4 | Cross-origin artifacts MUST be published with CORS headers | C1.2, C2.2, C2.3 | Fetch each public artifact with `Origin: https://conform.example`; `Access-Control-Allow-Origin` is `*` or echoes the origin; in the browser, a successful cross-origin fetch is itself the proof | Header values per URL | static / site |
| R20 | 3.2 MVP boundary / 5 | Coded-tool bundles MUST be treated as untrusted; run in an isolated worker; SRI MUST be verified and the bundle rejected on mismatch; undeclared peer code MUST NOT run | C12.1–C12.3 | Static: if `coded_tools.bundle` declared → fetch it; if `integrity` present → compute SHA-256/384/512 and compare (fail on mismatch); absent → warn (optional in this version). Harness: tampered bundle + digest → sandbox rejects | Digest comparison; sandbox error | static / site; harness / runtime |
| R21 | 3.3 | A runtime-supplied link binding MUST NOT modify the publisher's links.json | C13.1 | Static: `deployment.mode=static` → info; harness: after `resolveLink` with a user binding, `links.json` fetched again is byte-identical | Hash before/after | harness / caller |
| R22 | 3.3 | Production deployments MUST use HTTPS | C1.4 | same as R12 | | static / site |
| R23 | 3.4 | Public artifact requests MUST NOT include the caller's private credentials | C7.2 | Harness: artifact fetches carry no `Authorization`, no cookie (loopback cookie mirroring is the known exception, reported as info) | Request flags | harness / caller |
| R24 | 4 | When BYOK is offered, the user MUST be able to select/enter router base URL, model, credential | C14.1 | Browser: settings panel exposes the three fields. Static: manifest `llm_router.byok_router` present → BYOK offered | DOM assertion; manifest path | browser / site (static partial) |
| R25 | 4 | Runtime MUST NOT place the key in URLs, manifests, network spec, prompts, action arguments, traces, analytics, or peer-site requests | C7.1, C7.3, C3.8 | Harness: key appears in no URL, no non-router request, no trace event (`keySource: "local BYOK (not shown)"`), no prompt message; static: secret scan | Log scan for the fake key | harness / caller; static / site |
| R26 | 4 | A peer manifest's router metadata MUST NOT override the caller's active inference path | C7.4 | Harness: serve the site's manifest with a foreign `llm_router.base_url`; every chat request still goes to the caller's router | Router request origins | harness / caller |
| R27 | 4 | A BYOK proxy MUST NOT substitute a publisher key; peers MUST NOT receive the credential | C7.1 | covered by R13 | | harness |
| R28 | 4 | When the router requires a key and none is set, the model call MUST stop with a clear setup error | C14.2 | Harness: no key, non-mock router → `LlmClient` throws the setup error before any fetch | Error text + "router requests: 0" | harness / runtime |
| R29 | 4 | The user MUST be able to delete stored profiles | C14.3 | Browser: settings panel has a delete/forget control; after use, `localStorage` has no profile | DOM + storage | browser / site |
| R30 | 5 | Peer definitions MUST be treated as untrusted model input | — | Not mechanically testable; report as `info` with the prompt-injection note | — | untestable |
| R31 | 5 | Consent MUST identify destination origin and nature of the request; a redirect to another origin MUST be a new destination | C9.1, C1.5, C2.5 | Static: artifact fetch with `redirect:"manual"`; a cross-origin redirect → fail (the reference runtime follows it silently) | Redirect chain | static / site; harness |
| R32 | 5 | Private-context fields MUST NOT pass between invocations by default; only named fields MAY | C8.1–C8.2 | Harness: with no `allow`, downstream `sly_data` is `{}`; with `allow.to_downstream.sly_data:["a"]`, only `a` passes | Trace payload | harness / caller |
| R33 | 5 | Fail closed: MUST NOT begin/continue an invocation that cannot be validated, resolved, authorized, or is over limit; MUST NOT report it as successful; failure MUST be reported to the invoking network | C4.1, C5.1, C5.2, C6.1, C6.2 | Harness: invalid network → `Error from tool`; cycle → `COMPOSITION_CYCLE`; depth 5 → `COMPOSITION_DEPTH`; over 4 remote / 24 agent calls / 90 s → `Skipped …`; denied origin → `Policy: … not in allowed_peers`; each with zero peer/model requests after the stop | Error codes/text + request counts | harness / runtime |
| R34 | 5 | A remote timeout MUST be reported as failure or unknown outcome | C5.5 | Harness: peer fetch that never resolves → deadline reached → `Skipped` (note: reference runtime sets no fetch timeout; report as warn) | Trace | harness / runtime |
| R35 | 3.3 table | Manifest: one or more networks with `name`, `front_man`, `hocon`; top-site router metadata; peer policy | C1.3 | JSON shape check | JSON paths | static / site |
| R36 | 3.3 table | Network definition resolved, Neuro SAN schema, JSON for browser loading | C2.2, C3.* | Content type `application/json` or parseable HOCON; JSON preferred (warn on HOCON-only) | | static / site |
| R37 | 3.3 table | links.json maps symbolic references to peer URLs | C2.3 | If present: `version`, `networks[<name>]` object; values are http(s) URLs ending in a network name; HTTPS unless loopback | JSON paths | static / site |

## B. Checks grouped as Conform reports them

| Check | Name | Mode | MVP (core 1–6) |
|---|---|---|---|
| C1 | Manifest: reachable, JSON, CORS, required fields, HTTPS, no cross-origin redirect | static | yes (test 1) |
| C2 | Network entry: exact name, `hocon` resolves + CORS + parse, `links.json`, `front_man` consistent with the runtime's `find_front_man` | static | yes (test 2) |
| C3 | Definition validity: schema, references resolve, front agent, data-only, private-context rules explicit, secrets, reachability warnings, model hints | static | yes (test 3) |
| C4 | Exact-name resolution fails closed (harness on the pinned runtime against the site's real artifacts; plus static ambiguity check) | harness + static | yes (test 4) |
| C5 | Cycle, depth and budget limits stop with visible errors; same-agent repeat is not a cycle | harness | yes (test 5) |
| C6 | Denied origin fails closed; site's own peer references are consistent with its `allowed_peers` | harness + static | yes (test 6) |
| C7 | Key never reaches the peer; peer router metadata cannot override; no key in traces/URLs | harness (scripted turn) | done (2026-11-17) |
| C8 | Private context absent at the peer unless allowed | harness (scripted turn) | done (2026-11-17) |
| C9 | Consent before contact; decline sends nothing; page wires a consent hook | harness (scripted turn) + page scan | done (2026-11-17) |
| C10 | Runtime fingerprint: the site's shipped runtime matches a known reference version (hash table: skill runtime at 63a956c = nsdeploy 53a787c + edits; pizza example variant) | static | later |
| C11 | Write confirmation and unknown-outcome handling | browser / harness | later |
| C12 | Coded-tool bundle: SRI present and valid | static + harness | later |
| C13 | Publisher links.json untouched by runtime bindings | harness | later |
| C14 | BYOK panel fields, missing-key error, profile deletion | browser / harness | later |

Notes.
- Tests 4–6 are runtime behaviors. A caller never runs the peer's runtime; it runs the peer's definition in its own
  runtime. So Conform proves C4–C6 for the *site as a peer* by loading the site's real artifacts into the pinned
  reference runtime in Node (same technique as upstream `tests/linking/linking.test.mjs`). Whether the site's *own*
  visitors get the same behavior depends on the runtime the site ships: C10 fingerprints it.
- Upstream `scripts/check_partner.mjs` already covers parts of C1–C3 (manifest, CORS, exact name, runtime
  validation, bridge). Conform cites it and goes beyond: spec-clause mapping, JSON report, runtime behaviors, browser
  UI, badge, CLI/Action.
- `agent-mcp.json`, `.well-known/nsdeploy*.json` and `actions.bridge` are reference-implementation extensions, not
  spec requirements: Conform reports them as `info`/`warn` under an "nsdeploy extensions" group, never as spec `fail`.
