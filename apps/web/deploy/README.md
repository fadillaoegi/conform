# Deploying Conform to a VPS

Conform runs as **one Node process** (`apps/server`) that serves the built site (`apps/web/dist`), the
badge and directory API, and the MCP endpoint. Caddy or nginx in front only terminates TLS and proxies.
The service itself sends every header the spec needs; they are covered by the tests:

| Path | Header | Why |
| --- | --- | --- |
| `/agent-manifest.json`, `/conform.network.json`, `/conform_check.network.json`, `/links.json`, `/agent-mcp.json`, `/.well-known/nsdeploy*.json` | `Access-Control-Allow-Origin: *` | Other agentic sites' browsers read them (spec §3.3, §3.4). |
| `/api/*`, `/mcp`, `/badges/*`, `/.well-known/conform-badge-key.json` | `Access-Control-Allow-Origin: *` | Public, credential-free service other sites call. |
| `*.mjs` | `Content-Type: text/javascript` | The runtime imports `.mjs` modules. |
| `/runtime/sandbox-worker.js` | worker CSP | Coded-tool isolation (spec §5). |
| `/bridge/*` | no frame-blocking headers | Other sites frame the action bridge. |
| every other page | restrictive page CSP | Spec §4. `connect-src https:` lets visitors pick any HTTPS LLM provider. |

Tested on 2026-11-17: the Docker Compose stack below (Conform + Caddy) was built and run locally in an
isolated project; Conform's own `conform` and `conform_check` networks passed every check through Caddy, a
badge was issued and still verified after a restart (persistent volume and key), MCP answered through the
proxy, and production mode refused to start without a key or with a non-HTTPS origin.

## Security model

- The server checks URLs on behalf of anonymous visitors. In production it contacts **public HTTPS hosts on
  port 443 only**; every connection's IP is checked at connect time, so loopback, private (your other
  containers and databases), link-local and cloud-metadata addresses are refused, also through DNS tricks.
- Rate limits per client: 10 checks and 4 badges per 10 minutes, 60 MCP calls per 10 minutes. Checks run
  one at a time; results are cached for 10 minutes.
- The Ed25519 **private key lives outside the repository** and is readable only by the service. Anyone can
  verify badges with the public key at `/.well-known/conform-badge-key.json`; the site's Badge view does it
  in the browser, re-hashing the badged site's files.

## Option A: Docker Compose (recommended)

On the VPS, with Docker and the repository checked out:

1. **DNS:** point an `A` (and `AAAA`) record for your chosen name, for example `conform.your-domain.tld`, at
   the VPS. Ports 80 and 443 must be free (Caddy gets the certificate automatically).
2. **Signing key**, outside the repository:

   ```shell
   sudo mkdir -p /etc/conform
   docker run --rm -v /etc/conform:/out node:24-alpine node -e "const c=require('crypto');require('fs').writeFileSync('/out/badge-signing-key.pem',c.generateKeyPairSync('ed25519').privateKey.export({format:'pem',type:'pkcs8'}),{mode:0o600,flag:'wx'})"
   sudo chown 1000:1000 /etc/conform/badge-signing-key.pem   # the container's "node" user
   ```

   (With Node 24 and pnpm on the VPS you can use `pnpm --filter @conform/server gen-key /etc/conform/badge-signing-key.pem` instead.)
   Back the key up somewhere safe: badges signed with it stop verifying if it is lost.
3. **Settings:** `cp apps/web/deploy/.env.example apps/web/deploy/.env` and set `CONFORM_DOMAIN` and
   `CONFORM_SIGNING_KEY_HOST_PATH`.
4. **Start:**

   ```shell
   docker compose -f apps/web/deploy/docker-compose.yml --env-file apps/web/deploy/.env up -d --build
   ```

5. **Verify** from your machine:

   ```shell
   pnpm conform check https://conform.your-domain.tld/conform
   pnpm conform check https://conform.your-domain.tld/conform_check
   ```

   Both should print `Result PASS` with 0 fail and 0 warn. Then open the site, check an HTTPS agentic site,
   issue a badge for Conform itself, open its Verify view, and try the assistant with your own key.

Updating: `git pull`, then the same `up -d --build`. Data (badges, directory) stays in the `conform_data`
volume.

If ports 80/443 are already used by another web server on the VPS, drop the `caddy` service, publish the
`conform` service on `127.0.0.1:8787`, and proxy to it from that server (Option B's configs).

## Option B: systemd + Caddy or nginx

1. Install Node 24 and pnpm 11, put the repository in `/opt/conform`, create a `conform` system user.
2. `cd /opt/conform && pnpm install --frozen-lockfile && CONFORM_PUBLIC_ORIGIN=https://conform.your-domain.tld pnpm --filter @conform/web build`
3. Create the key: `sudo pnpm --filter @conform/server gen-key /etc/conform/badge-signing-key.pem && sudo chown conform /etc/conform/badge-signing-key.pem`
4. Edit and install `conform.service` (domain), then `sudo systemctl enable --now conform`.
5. Proxy with `Caddyfile` (set `CONFORM_SITE_ADDRESS=conform.your-domain.tld` and
   `CONFORM_UPSTREAM=127.0.0.1:8787`) or `nginx.conf` (+ certbot).
6. Verify as in Option A.

## Service settings

| Variable | Meaning |
| --- | --- |
| `CONFORM_ENV` | `production` refuses to start without a key and an https origin, and never allows private targets. |
| `CONFORM_PUBLIC_ORIGIN` | The site's https origin. Used in badge links, the issuer field, and the `conform_check` network's MCP URL (also a build argument for the site). |
| `CONFORM_SIGNING_KEY_FILE` | Path to the Ed25519 private key (PEM, PKCS#8). Must be outside the repository. |
| `CONFORM_DATA_DIR` | Badges and the directory (JSON files). |
| `CONFORM_STATIC_DIR` | The built site to serve (`apps/web/dist`). |
| `CONFORM_TRUST_PROXY` | `1` behind Caddy/nginx, so rate limits use the client's address. |
| `CONFORM_HOST`, `CONFORM_PORT` | Where the service listens (default `127.0.0.1:8787`). |

## After it is live

List Conform in the organizers' `docs/agentic_websites.md` with its agent URLs
`https://conform.your-domain.tld/conform` and `https://conform.your-domain.tld/conform_check`.
