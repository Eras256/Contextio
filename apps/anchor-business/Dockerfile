# syntax=docker/dockerfile:1
# Multi-stage build for Contextio's Anchor Platform business/callback server.
# Build context MUST be the repo root:
#   fly deploy --config apps/anchor-business/fly.toml --dockerfile apps/anchor-business/Dockerfile

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.6.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/anchor-business/package.json apps/anchor-business/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile=false

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/anchor-business apps/anchor-business
RUN pnpm --filter @contextio/config build \
    && pnpm --filter @contextio/shared build \
    && pnpm --filter @contextio/anchor-business build

RUN pnpm --filter @contextio/anchor-business deploy --prod --legacy /app/pruned

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
USER node
COPY --chown=node:node --from=build /app/pruned/node_modules ./node_modules
COPY --chown=node:node --from=build /app/apps/anchor-business/dist ./dist
COPY --chown=node:node --from=build /app/packages/shared/dist ./node_modules/@contextio/shared/dist
COPY --chown=node:node --from=build /app/packages/config/dist ./node_modules/@contextio/config/dist

EXPOSE 8091
CMD ["node", "dist/index.js"]
