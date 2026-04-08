################################################################################
# Stage 1: base — Node.js with pnpm enabled
################################################################################
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

################################################################################
# Stage 2: pruner — generate a minimal pruned workspace for the web app
################################################################################
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm turbo prune web --docker

################################################################################
# Stage 3: installer — install deps from pruned manifest, then build
################################################################################
FROM base AS installer
WORKDIR /app

# Copy only package.json files and lockfile (maximises Docker layer cache reuse)
COPY --from=pruner /app/out/json/ .

# Install dependencies using the pruned lockfile
RUN pnpm install --frozen-lockfile

# Copy full pruned source and build the web app
COPY --from=pruner /app/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=web

################################################################################
# Stage 4: runner — minimal production image
################################################################################
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as non-root user (INFR-05 / T-06-06: elevation of privilege mitigation)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (includes all required server files)
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Copy static assets into the correct standalone path
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
