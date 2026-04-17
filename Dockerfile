# ── LUMIS Nail Studio — Production Dockerfile ────────────────────────────────
# Multi-stage build using Next.js standalone output.
# Result: minimal runtime image (~150 MB) with no dev dependencies or build tools.
#
# Usage:
#   docker build -t lumis-nail-studio .
#   docker run -p 3000:3000 lumis-nail-studio
#
# next.config.ts must have output: "standalone" (already set).

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Install libc compat for native modules (alpine uses musl, not glibc)
RUN apk add --no-cache libc6-compat

COPY package*.json ./
# ci = reproducible install from lockfile, respects package-lock.json exactly
RUN npm ci

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry in CI/build environments
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Stage 3: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Non-root user for security (principle of least privilege)
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy standalone build output (Next.js bundles server + minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

USER nextjs

EXPOSE 3000

# Standalone mode: Next.js emits a self-contained server.js
CMD ["node", "server.js"]
