# Use the official Bun image
# See https://hub.docker.com/r/oven/bun/tags for available tags
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Stage 1: Install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Stage 2: Build the app
FROM base AS build
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# Set environment to production for the build
ARG DATABASE_URL
ENV NODE_ENV=production
RUN bun --bun run build

# Stage 3: Production runner
FROM base AS release
COPY --from=build /app/build build
COPY --from=build /app/package.json .

COPY --from=install /temp/dev/node_modules node_modules

# Run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "--bun", "run", "build/index.js" ]
