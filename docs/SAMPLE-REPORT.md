# Sample report

Text rendering of `checkNetwork("http://127.0.0.1:<port>/tidewhistle_guesthouse")` against the guesthouse
example served by `fixtures/upstream/serve_site.mjs` (regenerated 17 November 2026, checks C1–C9). The JSON
report also carries each finding's evidence, the artifact hashes, the site identity, and the spec and runtime
references. The canary key used by C7 never appears in a report.

```text
{"total":46,"pass":37,"fail":0,"warn":0,"info":9,"untestable":0,"worst":"pass"}

## C1 Manifest: reachable, JSON, CORS, required fields, HTTPS [pass] 38ms
  info       C1.4  Loopback http base (127.0.0.1:57040); accepted for local development only.
  pass       C1.5  No redirect when fetching the manifest.
  pass       C1.1  agent-manifest.json fetched: HTTP 200, valid JSON object.
  pass       C1.2  A caller on another origin can read the manifest (Access-Control-Allow-Origin: *).
  info       C1.6  The manifest was fetched without credentials, as a caller's public artifact request must be.
  pass       C1.3  1 network(s) listed with name, front_man and hocon.
  pass       C1.3  Router metadata present (default: https://api.otari.ai/api/v1; BYOK: https://api.otari.ai/api/v1).
  info       C1.3  allowed_peers[0] is a loopback http origin; it only works on the publisher's machine.
  pass       C1.3  Peer policy present (mode: closed; allowed_peers: 1).
  info       C1.7  Reference-implementation extension fields present: linking, agent_mcp, deployment, actions, theme, brand. They are not spec requirements.

## C2 Network entry: exact name, definition fetch, links.json, front agent [pass] 5ms
  pass       C2.1  The manifest lists a network named exactly "tidewhistle_guesthouse".
  pass       C2.3  A caller on another origin can read the definition (Access-Control-Allow-Origin: *).
  pass       C2.2  The definition fetched (HTTP 200) and parsed as JSON.
  pass       C2.4  front_man "tidewhistle_assistant" exists and is the agent the reference runtime selects.
  pass       C2.6  links.json read: 0 binding(s) for "tidewhistle_guesthouse".

## C3 Definition: Neuro SAN data model, references, data-only, private context, secrets [pass] 2ms
  pass       C3.1  1 agent/tool definition(s) with unique names.
  pass       C3.2  Every LLM agent has instructions; function descriptions and schemas are well formed where present.
  pass       C3.3  The reference runtime's validator accepts the network (shape, front agent, references).
  pass       C3.4  Front agent "tidewhistle_assistant" found.
  pass       C3.7  Every agent is reachable from the front agent.
  pass       C3.5  No include directives, substitutions, file URLs or local paths in the published definition.
  pass       C3.6  No allow rules: private context is deny-by-default across every boundary.
  pass       C3.8  No credential-looking values in the manifest or definition.
  info       C3.11  Network-level execution hints: max_steps, llm_config. Runtime-defined maximums still apply.

## C4 Exact network name: a wrong name fails closed; the right name instantiates [pass] 11ms
  pass       C4.3  Published network names are unambiguous after normalization.
  pass       C4.1  Requesting "tidewhistle_guesthouse-conform-missing" fails closed: No published network named 'tidewhistle_guesthouse-conform-missing' at 127.0.0.1:57040; refusing to run a different network.
  pass       C4.2  A caller's reference runtime retrieves and instantiates "tidewhistle_guesthouse" (front agent "tidewhistle_assistant") without a model call.

## C5 Cycles, depth and budgets stop with visible errors [pass] 1ms
  pass       C5.1  A composition cycle stops with a visible error before any contact: composition cycle detected: https://conform-caller.invalid::conform_caller -> http://127.0.0.1:57040::tidewhistle_guesthouse -> http://127.0.0.1:57040::tidewhistle_guesthouse
  pass       C5.2  The composition depth limit (5) stops with a visible error before any contact: composition depth limit (5) exceeded
  pass       C5.3  Over-budget requests are skipped with a visible reason (remote calls: "the per-query limit of 4 third-party calls was reached"; agent calls: "the per-query limit of 24 agent invocations was reached"; deadline: "the 90-second query deadline was reached").
  info       C5.4  Reference limits per visitor message: 4 peer calls, 1 per peer, 24 agent invocations, 90 s, depth 5. A second call to the same peer in one message is skipped ("that network was already consulted for this query"), which is a budget, not a cycle.
  info       C5.5  Repeated invocation of the same internal agent is not treated as a cycle: the runtime keys cycle detection on the remote-network chain only and bounds internal repeats by the agent budget.

## C6 Denied origins fail closed; peer references match the peer policy [pass] 1ms
  pass       C6.1  Under a closed policy that does not list the site, the call is refused with a visible error before any contact: Policy: 127.0.0.1:57040 is not in conform_caller's allowed_peers; refusing to contact it.
  pass       C6.2  Under an open policy that denies the site, the call is refused with a visible error before any contact: Policy: 127.0.0.1:57040 is not in conform_caller's allowed_peers; refusing to contact it.
  pass       C6.3  Every external reference (http://localhost:8081) is allowed by the site's peer policy.

## C7 The visitor's key never reaches the site, and the site cannot change the router [pass] 0ms
  pass       C7.1  With a visitor key active, only the caller's router received it (in the Authorization header). The site received 3 request(s) for its public files, with no Authorization header, no cookie and no key in any URL, header or body.
  pass       C7.2  The site's network ran locally in the caller's browser on the caller's router (1 model request(s) from the site's agents, all to the caller's router).
  pass       C7.3  Served with a manifest that names a different router, the site's network still ran only on the caller's router; the named router was never contacted.
  pass       C7.4  The key appears in no prompt and nowhere in the runtime's trace.
  info       C7.5  This proves what a caller on the reference runtime does with the site as a peer. It cannot prove what the site's own page does with its visitors' keys; that depends on the runtime the site ships (C10, planned).

## C8 Private context stays with the caller unless a field is explicitly allowed [pass] 0ms
  pass       C8.1  With no allow rule, the site's network received no private-context fields, and the private value never appeared in its prompts or requests.
  pass       C8.2  With the caller allowing only "conform_allowed_field", exactly that field crossed to the site's network and the other private value did not.
  info       C8.3  The site's network declares no upstream private-context fields, so its answers return only through the ordinary tool-result text.

## C9 Consent comes before every contact, and a decline sends nothing [pass] 14ms
  pass       C9.1  Consent was requested before any request to the site, naming the destination (127.0.0.1:57040) and the request text.
  pass       C9.2  When the visitor declines, the site receives no request at all and the caller is told the contact was declined.
  pass       C9.3  The site's page boots the reference runtime UI or sets its own consent handler, so its visitors get a consent card.
```
