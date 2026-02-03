# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Dependencies
# ============================================
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install ALL dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# ============================================
# Stage 2: Build
# ============================================
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY . .

# Build the SvelteKit app
RUN touch ./database.sqlite
ENV DATABASE_URL=./database.sqlite
RUN bun run check
RUN bun --bun run build

# ============================================
# Stage 3: Production
# ============================================
FROM oven/bun:1-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bunuser -u 1001

RUN chown -R bunuser:nodejs /app
RUN mkdir -p /app/data && chown -R bunuser:nodejs /app/data

# Copy built application from builder
COPY --from=builder --chown=bunuser:nodejs /app/build ./build
COPY --from=builder --chown=bunuser:nodejs /app/package.json ./

# Copy Drizzle migrations for startup migration
COPY --from=builder --chown=bunuser:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=bunuser:nodejs /app/drizzle.config.ts ./

# Switch to non-root user
USER bunuser

# Expose the port
EXPOSE 3000

# Health check (adjust endpoint as needed)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD bun --bun -e "fetch('http://localhost:3000').then(() => process.exit(0)).catch(() => process.exit(1))"

# Start the application with bun runtime
CMD ["bun", "--bun", "./build/index.js"]
