# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

# ============ Dependencies Stage ============
FROM base AS deps
WORKDIR /app

# Copy only package files for dependency installation
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (including dev for build)
RUN pnpm install --frozen-lockfile

# ============ Build Stage ============
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source files
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
COPY tsconfig.json ./

# Build shared package first, then API
WORKDIR /app/packages/shared
RUN pnpm build

WORKDIR /app/apps/api
RUN pnpm build

# ============ Production Stage ============
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

# Install only production dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN corepack enable && corepack prepare pnpm@9.14.2 --activate && \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Set ownership
RUN chown -R expressjs:nodejs /app

USER expressjs

WORKDIR /app/apps/api

EXPOSE 3001
ENV PORT=3001

# Run compiled JavaScript directly
CMD ["node", "dist/index.js"]
