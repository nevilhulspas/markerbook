# Container image for self-hosting. Build with your public settings, because
# Next.js inlines NEXT_PUBLIC_* values into the browser bundle at build time:
#
#   docker build \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://health.example.com \
#     -t markerbook .
#
# Pass the secrets only at run time (never as build args):
#
#   docker run -p 3000:3000 --env-file .env markerbook

# Node is pinned to an exact patch release: the October 2026 Node security
# release (CVE-2026-111497 and others) is fixed from 22.23.4, and an earlier
# nixpacks build was stuck on 22.3.0. Bump the pin, never loosen it.
#
# Node comes from the official nodejs.org tarball, verified against its pinned
# SHA-256, because the node:22.23.4 Docker Hub images were not pullable yet.
# TODO(AUT-2950): once they are, replace the `node` and `base` stages with
# `FROM node:22.23.4-bookworm-slim`.
FROM debian:bookworm-slim AS node
ARG NODE_VERSION=22.23.4
ARG TARGETARCH
RUN case "${TARGETARCH:-amd64}" in \
      amd64) NODE_ARCH=x64;   NODE_SHA256=1805bcd35e6815559bd2eb97db438d3fdb0eb3a5e6a977b7c1badca76337e9ce ;; \
      arm64) NODE_ARCH=arm64; NODE_SHA256=6287aa46b6c375d816e63ae66d024fbbfd70404825aabdfdf898a970871d2f4b ;; \
      *) echo "unsupported arch ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
 && apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSLo /tmp/node.tar.xz "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz" \
 && echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum -c - \
 && mkdir -p /opt/node \
 && tar -xJf /tmp/node.tar.xz -C /opt/node --strip-components=1 --no-same-owner \
 && rm /tmp/node.tar.xz \
 && /opt/node/bin/node -v

FROM debian:bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 1000 node \
 && useradd --uid 1000 --gid node --shell /bin/bash --create-home node
COPY --from=node /opt/node /usr/local

FROM base AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_TIME_ZONE
ENV NEXT_TELEMETRY_DISABLED=1
# Server modules build their API clients at import time and `next build`
# imports every route, so the secrets need placeholder values here. The build
# never calls those services; the real values come in at run time.
RUN SUPABASE_SECRET_KEY=build-placeholder \
    ANTHROPIC_API_KEY=build-placeholder \
    OPENAI_API_KEY=build-placeholder \
    npm run build && npm prune --omit=dev

FROM base
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/next.config.ts ./
# next.config.ts imports the security headers from src at start-up.
COPY --from=build --chown=node:node /app/src/lib/http/security-headers.ts ./src/lib/http/security-headers.ts
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
