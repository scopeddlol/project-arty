# Self-hosting

PROJECT: ARTY ships as a single container image: the production build served by
an unprivileged nginx. It runs on any hostname, LAN address or port. Images are
published for `linux/amd64`.

## Quick start

You need Docker with the Compose plugin.

```bash
curl -O https://raw.githubusercontent.com/scopeddlol/project-arty/main/docker-compose.yml
docker compose up -d
```

Open <http://localhost:8080/>. The mobile interface is at `/mobile/`, and
phones are redirected there automatically.

From a clone of this repository, `docker compose up -d --build` builds the image
locally instead of pulling it.

### Without Compose

```bash
docker run -d --name arty --restart unless-stopped \
  -p 8080:8080 \
  -v arty-cdn-cache:/var/cache/nginx/cdn \
  ghcr.io/scopeddlol/project-arty:latest
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
| `ARTY_PORT` | `8080` | Host port the site is published on (Compose only) |
| `ASSET_UPSTREAM` | `https://assets.wardogs-artillery.com` | Origin that map tiles and Terrain3D data are fetched from |
| `CDN_CACHE_MAX_SIZE` | `2g` | Disk limit for the local tile/terrain cache |

Health check: `GET /healthz` returns `200 ok`. The image declares a Docker
`HEALTHCHECK`, so `docker compose ps` shows `healthy` once nginx is serving.

## How it differs from wardogs-artillery.com

The image is built from the same `npm run build` output (after
`npm run test:scripts` and `npm run test:build` pass), then adjusted by
`docker/prepare-selfhost.mjs`:

- **Map tiles and terrain are proxied.** The upstream asset CDN only allows the
  official site's origin, so a browser on any other host would be blocked.
  Asset URLs are rewritten to the same-origin `/cdn/` path; nginx fetches them
  from `ASSET_UPSTREAM` over verified TLS and caches them in the `cdn-cache`
  volume. Once cached, tiles keep loading even if the CDN is unreachable.
- **Lobbies and feedback are off.** Both depend on the upstream project's
  Cloudflare service, which only accepts the official origin, so their buttons
  are hidden. Everything else (calculator, maps, Terrain3D, Map Tools, saved
  targets, all languages) works as normal.
- **No analytics or third-party requests.** The Umami script is removed and the
  Content Security Policy only allows the site's own origin.
- **Plain HTTP works.** `upgrade-insecure-requests` is dropped so LAN installs
  such as `http://192.168.1.20:8080` load correctly.

## HTTPS with a reverse proxy

Point any reverse proxy at port 8080. All asset URLs are relative, so no extra
configuration is needed. For example, with Caddy:

```caddyfile
arty.example.com {
    reverse_proxy localhost:8080
}
```

## Hardening

`docker-compose.yml` runs the container as a non-root user with a read-only root
filesystem, a `tmpfs` for `/tmp`, all Linux capabilities dropped and
`no-new-privileges`. The only persistent write location is the CDN cache volume.
nginx also sends `X-Frame-Options`, `frame-ancestors 'none'`,
`X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` headers.

## Container image publishing

`.github/workflows/docker.yml` tests every pull request and publishes to GitHub
Container Registry on pushes to `main` and on `v*` tags:

| Trigger | Tags |
| --- | --- |
| Push to `main` | `latest`, `sha-<commit>` |
| Tag `v1.2.3` | `1.2.3`, `1.2`, `sha-<commit>` |
| Pull request | Built and smoke-tested, not published |

Each run builds the image (which runs the unit tests and build verification),
starts it with the same hardening as Compose and checks the main routes before
publishing. Published images include an SBOM and signed build provenance:

```bash
gh attestation verify oci://ghcr.io/scopeddlol/project-arty:latest \
  --owner scopeddlol
```

The first publish creates a **private** package. To allow anonymous
`docker pull`, open the package on GitHub → **Package settings** →
**Change visibility** → **Public**.
