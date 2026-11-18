# Upstream fixtures

Copied unchanged from https://github.com/cognizant-ai-labs/agentic-web at commit
`63a956cf4653f610b1c238c70946f4d7647d17a8` (2026-11-13), license Apache-2.0 (`LICENSE.upstream.txt`).

| Folder / file | Upstream path |
| --- | --- |
| `pizza_restaurant_agentified/` | `examples/pizza_restaurant_agentified/` |
| `guesthouse_agentified/` | `examples/guesthouse_agentified/` |
| `harbor_tours_agentified/` | `examples/harbor_tours_agentified/` |
| `serve_site.mjs` | `skills/agentify-website/scripts/serve_site.mjs` |

The tests start `serve_site.mjs` on a free port (`--port 0`) for each site. The guesthouse and harbor tours
sites name each other on `http://localhost:8081` and `http://127.0.0.1:8080`; those origins are only used by
the static policy checks, never contacted by the tests.

Do not edit these copies. To refresh them, re-copy from a newer upstream commit and update this file,
`packages/core/src/spec.ts` and the README.
