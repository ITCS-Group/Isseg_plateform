# --- Stage 1: Base ---
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# --- Stage 2: Dependencies (workspace complet, requis par le lockfile pnpm
# unique — utilisé tel quel comme cible "dev" par docker-compose.yml, avec le
# code source de apps/worker monté par-dessus pour le hot-reload) ---
FROM base AS dependencies
COPY . .
RUN pnpm install --frozen-lockfile

# --- Stage 3: Build (production) ---
FROM dependencies AS builder
RUN pnpm --filter worker run build

# --- Stage 4: Runner (production) ---
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 worker

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker ./apps/worker

USER worker

CMD ["node", "apps/worker/dist/index.js"]
