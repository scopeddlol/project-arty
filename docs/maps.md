## Maps

Maps are registered in:

```text
maps/index.json
```

Each map has its own JSON configuration and may define:

- Coordinate bounds
- Tile configuration
- Markers
- Zones
- Polygons
- Map-specific metadata

### Indexable map landing pages

Bakurani, Ozeti and Zestafona each have a lightweight English search document:

```text
/maps/bakurani/
/maps/ozeti/
/maps/zestafona/
```

Every supported language also has a complete localized document:

```text
/<locale>/maps/<map-id>/
```

These routes are generated as real HTML files. They are useful map summaries and entry points, not duplicate calculators: they load only the shared landing stylesheet, the small language-route selector and deferred analytics, then link to the main application with a validated `?map=<map-id>` parameter. The application consumes that parameter once, selects the registered map and stores it through normal selection persistence.

Shared markup lives in `src/pages/maps/template.html`. English map-specific source material lives in `scripts/map-landing-pages.mjs`; reviewed translated copy lives in `scripts/map-landing-locales.mjs`. `scripts/build-pages.mjs` creates the routes, both sitemap stages include every indexable translation, and `scripts/verify-build.mjs` enforces the SEO, localization and lightweight-loading contract.

English pages use `<base href="../../">`; localized pages use `<base href="../../../">`. Production canonical and sitemap URLs are self-referencing, absolute and consistently use a trailing slash. The Cat locale is generated for navigation but remains `noindex` and excluded from sitemap and `hreflang` clusters.

### Bakurani

Bakurani uses a multi-resolution WebP tile pyramid. Tiles are not part of this
repository or the Docker image; each admin supplies their own in the
`map-assets` folder (see [Self-hosting](self-hosting.md#map-assets)) with this
structure:

```text
maps/tiles/bakurani/
├── zoom_0/
├── zoom_1/
├── zoom_2/
├── zoom_3/
├── zoom_4/
├── zoom_5/
├── zoom_6/
└── zoom_7/
```

Map configuration can define coordinate bounds:

```json
{
    "id": "bakurani",
    "name": "Bakurani",
    "w": 16,
    "h": 16,

    "bounds": {
        "minX": 23.35,
        "maxX": 133.60,
        "minY": 19.34,
        "maxY": 129.65
    },

    "tileBounds": {
        "minX": 0.0,
        "maxX": 163.84,
        "minY": 0.0,
        "maxY": 163.84
    },

    "coordinateMetersPerUnit": 100,

    "tiles": {
        "path": "maps/tiles/bakurani",
        "tileSize": 256,
        "minZoom": 0,
        "maxZoom": 7,
        "extension": "webp"
    }
}
```

`bounds` defines the playable/searchable in-game coordinate extent. It is used for coordinate search, point clamping, the visible grid, and camera fit.

`tileBounds` is independent from `bounds` and defines the world-coordinate extent covered by the complete tile pyramid. This separation allows the source render to contain terrain outside the playable coordinate rectangle without shifting the in-game grid.

`coordinateMetersPerUnit` converts map-coordinate deltas into physical meters. For Bakurani, `100` means one coordinate unit equals 100 meters, so `0.01` coordinate equals 1 meter.

Map calibration is based on available in-game reference data and may be refined as more accurate information becomes available.

### Tile hosting

`tiles.path` (and each entry under `tiles.styles`) is a path relative to the
site root, for example `maps/tiles/bakurani` and `maps/tiles-color/bakurani`.
Tiles are requested as `<path>/zoom_<z>/<x>_<y>.<extension>`, where `zoom_0` is a
single tile covering the whole map and each level doubles the tiles per side up
to `maxZoom`.

This project does not ship, download or proxy map imagery. Provide your own
legally obtained tiles:

- **Docker:** put them in the `map-assets` folder, which is mounted read-only
  and served at `/maps/tiles/` and `/maps/tiles-color/`.
- **Development server:** put them in `maps/tiles/` and `maps/tiles-color/` in
  your checkout.

Both locations are ignored by Git and excluded from the build and the Docker
build context, so imagery is never committed or baked into an image. A missing
tile simply leaves that part of the map blank; the calculator keeps working.

---

## Terrain elevation data

Map imagery and terrain elevation are separate data sources. A local Terrain3D
working dataset is stored under its map directory, for example:

```text
data/terrain/bakurani/
├── manifest.json
└── chunks/
    └── *.bin
```

The manifest describes how map coordinates resolve into terrain chunks and how stored height values are converted to elevation. The runtime loads only the chunks needed for the current Artillery and Target positions and caches them for later samples.

Manifest paths are registered in `data/ballistics/terrain-context.json` as
`data/terrain/<map-id>/manifest.json`. Chunk binaries are supplied by each
admin (see [Self-hosting](self-hosting.md#map-assets)) and are excluded from
Git and the build; manifests and generated contours remain in the repository.

Terrain sampling is used to provide elevation context for SPH-2:

```text
artillery coordinate -> artillery elevation
 target coordinate    -> target elevation
                          ↓
              ΔZ = target - artillery
```

Terrain data is deliberately independent from the tile pyramid. Replacing or recalibrating map imagery does not change terrain samples unless the terrain coordinate mapping itself is changed.

Terrain3D does **not** modify the firing-table MIL value by default. Its experimental correction is an explicit opt-in and applies only to a verified safe arc. If a manifest, chunk, or terrain sample is unavailable, the calculator keeps the normal firing solution instead of treating terrain as a hard dependency.

See [Terrain Elevation & SPH-2 Setup](terrain.md) for runtime and validation details.

---

## Marker assets and user placement

Marker assets are defined in:

```text
maps/assets.json
```

Each marker asset supports a `placeable` flag:

```json
{
    "tower": {
        "path": "assets/map-markers/tower.webp",
        "width": 32,
        "height": 32,
        "anchorX": 0.5,
        "anchorY": 0.5,
        "placeable": true
    }
}
```

- `placeable: true` makes the asset available in the user **Markers** tool and allows it to be placed manually.
- `placeable: false` hides the asset from the picker and prevents user placement.
- Preset markers in map JSON can still use a non-placeable asset. The flag only controls user placement.
- If `placeable` is omitted, it defaults to `true` for backwards compatibility.

---

## Marker zoom visibility

Preset map markers support optional `minZoom` and `maxZoom` properties. These values use the **camera zoom multiplier** (`1` = Fit, `2` = 2× zoom, etc.). Both limits are inclusive.

```json
{
    "icon": "tower",
    "x": 8345,
    "y": 7294,
    "label": "Tower 4",
    "minZoom": 2,
    "maxZoom": 15
}
```

- `minZoom`: marker is hidden while camera zoom is below this value.
- `maxZoom`: marker is hidden while camera zoom is above this value.
- If either property is omitted, that side of the range is unrestricted.
- Hidden markers are also excluded from hover/click target detection.

---

## Adding a Map

1. Create a map configuration:

```text
maps/my-map.json
```

2. Register the map in:

```text
maps/index.json
```

3. Generate tiles locally if required:

```text
maps/tiles/my-map/
```

4. Set `tiles.path` to `maps/tiles/<map-id>` and provide the tiles through your
   `map-assets` folder (Docker) or `maps/tiles/` (development server). Tiles are
   never committed or included in the build.

5. If the map needs an indexable landing page, add a unique, fact-checked English definition to `scripts/map-landing-pages.mjs`, add reviewed translations to `scripts/map-landing-locales.mjs`, link it from the relevant English homepage SEO section, then run the build and SEO smoke test. Do not publish mechanical translations or copy another map's text with only the name changed.

5. Configure the coordinate bounds.

The map renderer is designed to be map-independent, so additional maps can be added without modifying the core rendering logic.

Terrain elevation is optional. A map without terrain data continues to use the normal coordinate, map, and firing-table behavior.

---
