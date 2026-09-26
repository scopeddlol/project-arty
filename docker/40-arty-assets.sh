#!/bin/sh
# Reports which admin-supplied map assets are installed and publishes the
# result as /assets-status.json for the in-app notice.
set -eu

assets=/srv/arty-assets
site=/usr/share/nginx/html
status=/tmp/assets-status.json

has_files() {
    [ -d "$1" ] && [ -n "$(ls -A "$1" 2>/dev/null | head -n 1)" ]
}

yes_no() {
    if [ "$1" = true ]; then echo yes; else echo no; fi
}

map_ids=$(grep -o '"[^"]*\.json"' "$site/maps/index.json" | tr -d '"' | sed 's/\.json$//')

echo "arty: map assets folder: $assets"

json='{"maps":{'
separator=''
installed=0
total=0

for id in $map_ids; do
    total=$((total + 1))
    tiles=false; color=false; terrain=false
    has_files "$assets/maps/tiles/$id/zoom_0" && tiles=true
    has_files "$assets/maps/tiles-color/$id/zoom_0" && color=true
    [ -f "$assets/data/terrain/$id/manifest.json" ] && terrain=true
    [ "$tiles" = true ] && installed=$((installed + 1))

    printf 'arty:   %-12s tiles: %-4s color: %-4s terrain: %s\n' \
        "$id" "$(yes_no $tiles)" "$(yes_no $color)" "$(yes_no $terrain)"

    json="$json$separator\"$id\":{\"tiles\":$tiles,\"colorTiles\":$color,\"terrain\":$terrain}"
    separator=','
done

printf '%s}}\n' "$json" > "$status"

if [ "$installed" -eq 0 ]; then
    echo "arty: no map imagery found. The calculator works, but maps will be blank."
    echo "arty: add your map files to the map-assets folder (see docs/self-hosting.md#map-assets)."
else
    echo "arty: map imagery installed for $installed of $total maps."
fi
