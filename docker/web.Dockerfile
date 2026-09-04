# --- Stage 1: Base ---
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# --- Stage 2: Dependencies (workspace complet, requis par le lockfile pnpm
# unique et par les dépendances internes @isseg/ui, @isseg/config — utilisé
# tel quel comme cible "dev" par docker-compose.yml, avec le code source de
# apps/web et packages/ montés par-dessus pour le hot-reload) ---
FROM base AS dependencies
COPY . .
RUN pnpm install --frozen-lockfile

# --- Stage 3: Build (production) ---
FROM dependencies AS builder
RUN pnpm --filter web run build

# --- Stage 4: Runner (production) ---
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 nextjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/web ./apps/web

USER nextjs
EXPOSE 3000

CMD ["pnpm", "--filter", "web", "start"]
