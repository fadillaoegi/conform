# Reference runtime (pinned)

`runtime/` is an unchanged copy of `skills/agentify-website/runtime/` from
https://github.com/cognizant-ai-labs/agentic-web at commit `63a956cf4653f610b1c238c70946f4d7647d17a8`
(2026-11-13). That folder is the nsdeploy browser runtime at nsdeploy commit `53a787c` (2026-11-11) with the
skill's edits (`website_*` tools, partner model and step limit; see `runtime/README.md`). License Apache-2.0
(`runtime/LICENSE.txt`).

`HASHES.sha256` lists the SHA-256 of every file. Conform uses it to fingerprint the runtime a site ships
(check C10) and to run the harness checks (C4–C6) against a site's real artifacts in Node.

Do not edit `runtime/`. To move to a newer upstream version, replace the folder, regenerate the hashes with
`find runtime -type f | sort | xargs shasum -a 256 > HASHES.sha256`, and update `packages/core/src/spec.ts`.

## skill/

`skill/scripts/build_network.mjs`, `skill/templates/network.hocon` and `skill/templates/bridge/action-bridge.html`
are unchanged copies of the same files under `skills/agentify-website/` at the same commit. Conform's own site
(`apps/web`) builds and checks its agent network with them, passing `--runtime` to this package's `runtime/`.

## scripts/

`scripts/check_partner.mjs` is an unchanged copy of the skill's partner checker at the same commit. It imports
`../runtime/`, so it lives next to this package's `runtime/`. Use it to confirm another site can call a network:
`node packages/reference-runtime/scripts/check_partner.mjs <network URL> --origin <caller origin>`.
