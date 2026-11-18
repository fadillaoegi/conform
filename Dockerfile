# Conform: the static site, the badge/directory/MCP service, one Node process.
# Build:  docker build --build-arg CONFORM_PUBLIC_ORIGIN=https://conform.your-domain.tld -t conform .
FROM node:24-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate
COPY . .
ARG CONFORM_PUBLIC_ORIGIN=http://127.0.0.1:8787
ENV CONFORM_PUBLIC_ORIGIN=${CONFORM_PUBLIC_ORIGIN}
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @conform/web build \
 && mkdir -p /var/lib/conform && chown node:node /var/lib/conform
USER node
ENV CONFORM_HOST=0.0.0.0 CONFORM_PORT=8787 CONFORM_DATA_DIR=/var/lib/conform CONFORM_STATIC_DIR=/app/apps/web/dist CONFORM_TRUST_PROXY=1
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/healthz >/dev/null || exit 1
CMD ["node", "--conditions=conform-source", "apps/server/src/main.ts"]
