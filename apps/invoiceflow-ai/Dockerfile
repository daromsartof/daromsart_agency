# syntax=docker/dockerfile:1
#
# Image de production pour l'app invoiceflow-ai.
# Contexte de build = RACINE du monorepo (pas ce dossier) :
#   docker build -f apps/invoiceflow-ai/Dockerfile -t invoiceflow-ai .
#
# Stratégie (rapide + petite image) :
#   1. `turbo prune` isole l'app et ses dépendances → cache d'install optimal ;
#   2. install puis build filtré sur l'app ;
#   3. runner = sortie Next « standalone » uniquement (pas de node_modules complet).
#
# Pour dockeriser une NOUVELLE app : copier ce fichier dans apps/<app>/, et
# remplacer les deux valeurs PROJECT / PROJECT_PATH ci-dessous.

ARG NODE_VERSION=20-alpine
ARG TURBO_VERSION=2.1.3

# ── 1) Base commune : pnpm (corepack) ──────────────────────────────────────
FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app

# ── 2) Prune : sous-ensemble du monorepo pour cette app ────────────────────
FROM base AS pruner
ARG TURBO_VERSION
ARG PROJECT=@daromsart/invoiceflow-ai
RUN pnpm add -g turbo@${TURBO_VERSION}
COPY . .
RUN turbo prune "${PROJECT}" --docker

# ── 3) Install (couche cache) puis build ───────────────────────────────────
FROM base AS builder
ARG PROJECT=@daromsart/invoiceflow-ai
# a) Manifests + lockfile d'abord : la couche d'install ne casse que si les
#    dépendances changent.
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
# b) Sources élaguées, puis build de l'app (Turborepo build ses deps d'abord).
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter="${PROJECT}"

# ── 4) Runner minimal : sortie standalone ──────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Utilisateur non-root
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Le bundle standalone contient déjà le serveur + le minimum de node_modules
# (packages @daromsart/* tracés depuis la racine du monorepo).
COPY --from=builder --chown=nextjs:nodejs /app/apps/invoiceflow-ai/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/invoiceflow-ai/.next/static ./apps/invoiceflow-ai/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/invoiceflow-ai/public ./apps/invoiceflow-ai/public

USER nextjs
EXPOSE 3000

# Vérification de vie simple (pas de dépendance à un binaire supplémentaire).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/invoiceflow-ai/server.js"]
