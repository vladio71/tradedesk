# One Dockerfile for all three services. Pick the service with the build argument APP:
#   docker build --build-arg APP=wallet-service -t tradedesk-wallet .

# ---- build: all dependencies, compiled output ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY libs/common/package.json libs/common/
COPY apps/identity-service/package.json apps/identity-service/
COPY apps/wallet-service/package.json apps/wallet-service/
COPY apps/market-service/package.json apps/market-service/
RUN npm ci
COPY libs libs
COPY apps apps
COPY scripts scripts
COPY tsconfig.json ./
RUN npm run build

# ---- pruned: the same tree without dev dependencies ----
FROM build AS pruned
RUN npm prune --omit=dev

# ---- runtime: only what is needed to run one service ----
FROM node:22-alpine AS runtime
ARG APP
ENV NODE_ENV=production
ENV APP=${APP}
WORKDIR /app
COPY --from=pruned /app/package.json ./
COPY --from=pruned /app/node_modules ./node_modules
COPY --from=pruned /app/libs/common/package.json libs/common/package.json
COPY --from=pruned /app/libs/common/dist libs/common/dist
COPY --from=pruned /app/apps/${APP}/package.json apps/${APP}/package.json
COPY --from=pruned /app/apps/${APP}/dist apps/${APP}/dist
USER node
CMD ["sh", "-c", "node apps/${APP}/dist/main.js"]
