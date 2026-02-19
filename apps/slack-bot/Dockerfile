FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/slack-bot/package.json ./apps/slack-bot/
COPY packages/ai/package.json ./packages/ai/
COPY packages/db/package.json ./packages/db/
COPY packages/ingest/package.json ./packages/ingest/
RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/slack-bot/node_modules ./apps/slack-bot/node_modules
COPY . .
RUN pnpm --filter slack-bot build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/slack-bot/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/slack-bot/node_modules ./apps/slack-bot/node_modules

EXPOSE 3001 3002

CMD ["node", "dist/app.js"]
