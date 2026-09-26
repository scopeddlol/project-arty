# syntax=docker/dockerfile:1

# ---- Build: generate the static site -------------------------------------
FROM node:22-alpine AS build

WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . .
RUN npm run test:scripts \
 && npm run build \
 && npm run test:build \
 && node docker/prepare-selfhost.mjs dist

# ---- Runtime: unprivileged nginx -----------------------------------------
# Map tiles and Terrain3D data are NOT part of the image. Mount your own
# assets at /srv/arty-assets (see docs/self-hosting.md#map-assets).
FROM nginxinc/nginx-unprivileged:1.30-alpine

LABEL org.opencontainers.image.title="PROJECT: ARTY - WARDOGS Artillery Calculator" \
      org.opencontainers.image.description="Self-hosted L81 Mortar and SPH-2 artillery calculator and tactical map for WARDOGS." \
      org.opencontainers.image.licenses="MIT"

USER root
RUN rm -f /etc/nginx/conf.d/default.conf \
 && mkdir -p /srv/arty-assets
USER 101

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/arty.conf /etc/nginx/arty.conf
COPY --chmod=0755 docker/40-arty-assets.sh /docker-entrypoint.d/
COPY --from=build /src/dist/ /usr/share/nginx/html/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
