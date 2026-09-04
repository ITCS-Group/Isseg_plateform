# --- Stage 1: Base ---
FROM node:20-alpine AS base
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# --- Stage 2: Dependencies (workspace complet, requis par le lockfile pnpm
# unique — utilisé tel quel comme cible "dev" par docker-compose.yml, avec le
# code source de apps/api monté par-dessus pour le hot-reload) ---
FROM base AS dependencies
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api exec prisma generate

# --- Stage 3: Build (production) ---
FROM dependencies AS builder
RUN pnpm --filter api run build

# --- Stage 4: Runner (production) ---
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 nestjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

USER nestjs
EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]