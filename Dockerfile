# Container image for self-hosting. Build with your public settings, because
# Next.js inlines NEXT_PUBLIC_* values into the browser bundle at build time:
#
#   docker build \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://health.example.com \
#     -t bloodmarkers .
#
# Pass the secrets only at run time (never as build args):
#
#   docker run -p 3000:3000 --env-file .env bloodmarkers

FROM node:22-bookworm-slim AS build
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

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/next.config.ts ./
USER node
EXPOSE 3000
CMD ["npm", "start"]
