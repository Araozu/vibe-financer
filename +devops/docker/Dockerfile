# syntax=docker/dockerfile:1

FROM node:26-alpine AS base
RUN npm install --global pnpm@12.11.2
WORKDIR /app

# Install dependencies for type checking and building.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vibe_financer
RUN pnpm run check
RUN pnpm run build

# Keep runtime dependencies, including Drizzle, available without startup downloads.
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/build ./build
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/drizzle.config.ts ./
COPY --chown=node:node +devops/docker/docker-entrypoint.sh ./docker-entrypoint.sh

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/login').then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

USER node
CMD ["sh", "/app/docker-entrypoint.sh"]
