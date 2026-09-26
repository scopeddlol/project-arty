# Self-hosting

PROJECT: ARTY ships as a single container image: the production build served by
an unprivileged nginx. It runs on any hostname, LAN address or port. Images are
published for `linux/amd64`.

The image contains the application only. **Map imagery and Terrain3D data are
not included, downloaded or proxied**; the admin provides them (see
[Map assets](#map-assets)). Without them the calculator, coordinates, grid,
markers and Map Tools all work, but the map background is blank.

## Quick start

You need Docker with the Compose plugin.

```bash
curl -O https://raw.githubusercontent.com/scopeddlol/project-arty/main/docker-compose.yml
mkdir map-assets            # put your map files in here (see below)
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
  -v "$PWD/map-assets:/srv/arty-assets:ro" \
  ghcr.io/scopeddlol/project-arty:latest
```

## Map assets

Put your own, legally obtained map files in the `map-assets` folder next to
`docker-compose.yml`. It is mounted read-only; nothing is uploaded anywhere or
copied into the image.

```text
map-assets/
├── maps/
│   ├── tiles/                 # black & white style (default)
│   │   ├── bakurani/
│   │   │   ├── zoom_0/0_0.webp
│   │   │   ├── zoom_1/0_0.webp … 1_1.webp
│   │   │   └── … up to zoom_7
│   │   ├── ozeti/
│   │   └── zestafona/
│   └── tiles-color/           # optional color style, same layout
│       └── <map-id>/
└── data/
    └── terrain/               # optional Terrain3D elevation data
        └── <map-id>/
            ├── manifest.json
            └── chunks/*.bin   # as referenced by the manifest
```

- **Tiles** are 256×256 WebP images named `zoom_<z>/<x>_<y>.webp`. `zoom_0` is
  one tile covering the whole map; each level doubles the tiles per side, up to
  the `maxZoom` in the map's JSON file (`maps/<map-id>.json`, currently 7).
- **Terrain3D** is optional. Without it, SPH-2 solutions use the normal firing
  tables and skip the ΔZ context. See [Terrain](terrain.md).
- Files must be readable by the container's user (UID 101); normal `644` files
  in `755` folders are fine.

Restart the container after adding or changing files:

```bash
docker compose restart
docker compose logs arty
```

At startup the container reports what it found:

```text
arty:   bakurani     tiles: yes  color: no   terrain: yes
arty:   ozeti        tiles: no   color: no   terrain: no
arty: map imagery installed for 1 of 3 maps.
```

If a player opens a map with no imagery installed, the app shows a short notice
explaining that the admin needs to add the map files.

> **Do not point this project at the upstream WARDOGS Artillery Calculator's
> asset CDN.** That CDN is paid for by the original author and is not a public
> asset source. Use files you are entitled to use and host them yourself.

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
| `ARTY_PORT` | `8080` | Host port the site is published on |
| `ARTY_ASSETS_DIR` | `./map-assets` | Folder holding your map tiles and terrain data |

Health check: `GET /healthz` returns `200 ok`. The image declares a Docker
`HEALTHCHECK`, so `docker compose ps` shows `healthy` once nginx is serving.

## How it differs from wardogs-artillery.com

The image is built from the same `npm run build` output (after
`npm run test:scripts` and `npm run test:build` pass), then adjusted by
`docker/prepare-selfhost.mjs`:

- **Map assets are local.** Tiles and terrain are served from your
  `map-assets` folder instead of the upstream CDN. The build fails if any
  reference to the upstream asset host remains.
- **Lobbies and feedback are off.** Both depend on the upstream project's
  Cloudflare service, so their buttons are hidden.
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
filesystem, a read-only assets mount, a `tmpfs` for `/tmp`, all Linux
capabilities dropped and `no-new-privileges`. nginx also sends
`X-Frame-Options`, `frame-ancestors 'none'`, `X-Content-Type-Options`,
`Referrer-Policy` and `Permissions-Policy` headers.

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
publishing. Published images contain no map imagery or terrain data, and
include an SBOM and signed build provenance:

```bash
gh attestation verify oci://ghcr.io/scopeddlol/project-arty:latest \
  --owner scopeddlol
```

The first publish creates a **private** package. To allow anonymous
`docker pull`, open the package on GitHub → **Package settings** →
**Change visibility** → **Public**.
