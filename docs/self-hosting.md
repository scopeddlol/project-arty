# Self-hosting with Docker

The calculator ships as a single container image: the production build served by
an unprivileged nginx. It runs on any hostname, LAN address or port, on
`linux/amd64` and `linux/arm64` (including Raspberry Pi 4/5).

## Quick start

You need Docker with the Compose plugin.

```bash
curl -O https://raw.githubusercontent.com/scopeddlol/wardogs-arty-calculator/main/docker-compose.yml
docker compose up -d
```

Open <http://localhost:8080/>. The mobile interface is at `/mobile/`, and
phones are redirected there automatically.

From a clone of this repository, `docker compose up -d --build` builds the image
locally instead of pulling it.

### Without Compose

```bash
docker run -d --name wardogs --restart unless-stopped \
  -p 8080:8080 \
  -v wardogs-cdn-cache:/var/cache/nginx/cdn \
  ghcr.io/scopeddlol/wardogs-arty-calculator:latest
```

## Updating

```bash
docker compose pull
docker compose up -d
```

## Configuration

Copy `.env.example` to `.env` next to `docker-compose.yml` and change what you
need:

| Variable | Default | Effect |
| --- | --- | --- |
| `WARDOGS_PORT` | `8080` | Host port the site is published on (Compose only) |
| `ASSET_UPSTREAM` | `https://assets.wardogs-artillery.com` | Origin that map tiles and Terrain3D data are fetched from |
| `CDN_CACHE_MAX_SIZE` | `2g` | Disk limit for the local tile/terrain cache |

Health check: `GET /healthz` returns `200 ok`. The image declares a Docker
`HEALTHCHECK`, so `docker compose ps` shows `healthy` once nginx is serving.

## How it differs from wardogs-artillery.com

The image is built from the same `npm run build` output (including
`npm run test:scripts` and `npm run test:build`), then adjusted by
`docker/prepare-selfhost.mjs`:

- **Map tiles and terrain are proxied.** The upstream asset CDN only allows the
  official site's origin, so the browser would be blocked on any other host.
  Asset URLs are rewritten to the same-origin `/cdn/` path; nginx fetches them
  from `ASSET_UPSTREAM` over verified TLS and caches them in the `cdn-cache`
  volume. Once cached, tiles keep loading even if the CDN is unreachable.
- **Lobbies and feedback are turned off.** Both talk to a Cloudflare Worker that
  only accepts the official origin and Cloudflare Turnstile hostname, so they
  cannot work from a self-hosted copy. Their buttons are hidden rather than left
  broken. Everything else (calculator, maps, Terrain3D, Map Tools, saved
  targets, all languages) works as normal.
- **No analytics or third-party requests.** The Umami script is removed and the
  Content Security Policy only allows the site's own origin.
- **Plain HTTP works.** `upgrade-insecure-requests` is dropped so LAN installs
  such as `http://192.168.1.20:8080` load correctly. Use a reverse proxy for
  HTTPS; all asset URLs are relative, so no extra configuration is needed.

## HTTPS with a reverse proxy

Point any reverse proxy at port 8080. For example, with Caddy:

```caddyfile
arty.example.com {
    reverse_proxy localhost:8080
}
```

## Hardening

`docker-compose.yml` runs the container as a non-root user with a read-only root
filesystem, a `tmpfs` for `/tmp`, all Linux capabilities dropped and
`no-new-privileges`. The only persistent write location is the CDN cache volume.
The same security headers documented in [Security hardening](security.md) are
sent by nginx, including `frame-ancestors 'none'`.

## Container image publishing

`.github/workflows/docker.yml` builds the image on every pull request and
publishes it to GitHub Container Registry on pushes to `main` and on `v*` tags:

| Trigger | Tags |
| --- | --- |
| Push to `main` | `latest`, `sha-<commit>` |
| Tag `v1.2.3` | `1.2.3`, `1.2`, `sha-<commit>` |
| Pull request | Built and smoke-tested, not published |

Each run builds the image, starts it with the same hardening as Compose and
checks the main routes before building the multi-architecture image. Published
images include an SBOM and signed build provenance, which can be checked with:

```bash
gh attestation verify oci://ghcr.io/scopeddlol/wardogs-arty-calculator:latest \
  --owner scopeddlol
```

The first publish creates a **private** package. To allow anonymous
`docker pull`, open the package on GitHub → **Package settings** →
**Change visibility** → **Public**.
