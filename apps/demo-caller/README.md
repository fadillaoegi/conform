# Waypoint Desk (demo caller)

A small, fictional agentic website that shows **another site calling Conform**. Waypoint Desk plans stays
through its partners' agents, and before it asks a partner anything it asks Conform whether that partner's
agent follows the spec. "Check before you trust", in one visitor message:

1. The visitor asks about Tidewhistle Guesthouse.
2. A consent card asks to contact **Conform**. Conform's `conform_check` network runs in the visitor's
   browser and calls Conform's MCP endpoint, which checks the guesthouse (C1–C9).
3. Only on PASS or WARN, a second card asks to contact **Tidewhistle Guesthouse**, and its answer comes back.

Built the agentify-website way: a front agent with the template's grounding, partner and peer rules, a
read action (`get_desk_state`), the action bridge, `link_labels` for both cards, and the skill's
`build_network.mjs` check (no warnings). The organizers' `check_partner.mjs` accepts Conform as its partner.

## Run locally

Three sites on three host names, so the runtime's loopback key cookie never reaches another site:

```shell
pnpm serve                                                       # repo root: Conform on http://127.0.0.1:8787
node fixtures/upstream/serve_site.mjs fixtures/upstream/guesthouse_agentified --port 8091 --open-as localhost
pnpm --filter @conform/demo-caller serve                         # Waypoint Desk on http://[::1]:8096
```

Open http://[::1]:8096, add your key in AI model settings, and ask:
"Is Tidewhistle Guesthouse safe to call? Check it first, then ask what rooms it offers."

## Test

`pnpm --filter @conform/demo-caller test` runs the whole chain in the pinned runtime with a scripted router:
Waypoint Desk, a real Conform server process, its MCP endpoint and a real check of the guesthouse. It checks
the order of the two consent cards, that nothing reaches a site before its card is answered, that a decline
sends nothing, and that the key reaches only the router.

## Hosting

Build with the public addresses, on a different origin from Conform (for example a `desk.` subdomain):

```shell
CONFORM_PUBLIC_ORIGIN=https://conform.your-domain.tld DEMO_PARTNER_URL=https://partner.example/network pnpm --filter @conform/demo-caller build
```

Then serve `apps/demo-caller/dist` with CORS on its public agent files (the same rules as Conform's site).
