FROM node:24-bookworm-slim AS builder

WORKDIR /app

ENV MINIMRP_RUNTIME=sqlite \
    NEXT_PUBLIC_MINIMRP_RUNTIME=sqlite \
    MINIMRP_DESKTOP_DATA_DIR=/seed

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run db:reset:seed && npm run build

FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    MINIMRP_RUNTIME=sqlite \
    NEXT_PUBLIC_MINIMRP_RUNTIME=sqlite \
    MINIMRP_DESKTOP_DATA_DIR=/data

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/docker/entrypoint.mjs ./docker/entrypoint.mjs
COPY --from=builder --chown=node:node /seed /opt/minimrp-seed

RUN mkdir -p /data && chown node:node /data

USER node
EXPOSE 3000

ENTRYPOINT ["node", "docker/entrypoint.mjs"]
