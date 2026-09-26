/*
 * Self-hosted builds only: explains a blank map when the admin has not
 * installed imagery for the selected map. Reads /assets-status.json, which
 * the container writes at startup (docker/40-arty-assets.sh).
 */
(() => {
    const DISMISSED_KEY = 'arty-assets-notice-dismissed';
    let status = null;
    let notice = null;

    function dismissed() {
        try {
            return new Set(JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || '[]'));
        } catch {
            return new Set();
        }
    }

    function remember(key) {
        try {
            const keys = dismissed();
            keys.add(key);
            sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...keys]));
        } catch {
            /* Storage can be unavailable; the notice simply returns. */
        }
    }

    function selectedText(select) {
        return select?.selectedOptions?.[0]?.textContent?.trim() || select?.value || '';
    }

    function missingAsset() {
        const mapSelect = document.getElementById('mapSelect');
        const mapId = mapSelect?.value;
        const entry = mapId && status?.maps?.[mapId];
        if (!entry) return null;

        const style = document.getElementById('mapStyleSelect')?.value;
        const mapName = selectedText(mapSelect);

        if (!entry.tiles) {
            return {
                key: `${mapId}:tiles`,
                title: 'Map imagery not installed',
                body: `${mapName} has no map tiles on this server. Calculations still work; ask the server admin to add the map files.`
            };
        }

        if (style === 'color' && !entry.colorTiles) {
            return {
                key: `${mapId}:color`,
                title: 'Color imagery not installed',
                body: `${mapName} only has black & white tiles on this server. Switch the map style back, or ask the server admin to add the color tiles.`
            };
        }

        return null;
    }

    function build() {
        // A shadow root keeps the application's global styles out.
        const host = document.createElement('div');
        host.style.cssText = [
            'position:fixed',
            'left:50%',
            'transform:translateX(-50%)',
            document.body.classList.contains('mobile-app') ? 'top:76px' : 'bottom:96px',
            'z-index:2147483000',
            'width:min(440px, calc(100vw - 32px))',
            'display:none'
        ].join(';');

        const root = host.attachShadow({ mode: 'open' });
        root.innerHTML = `
            <style>
                .card {
                    display: flex;
                    gap: 12px;
                    align-items: flex-start;
                    padding: 14px 16px;
                    border: 1px solid var(--accent-border, #c99a4d);
                    border-radius: 12px;
                    background: var(--panel-bg, #111619);
                    color: var(--text, #e7edf2);
                    box-shadow: 0 18px 40px rgba(0, 0, 0, .45);
                    font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
                }
                .icon { color: var(--accent, #d7a452); font-size: 18px; line-height: 1; }
                .copy { flex: 1 1 auto; min-width: 0; }
                strong { display: block; margin-bottom: 3px; letter-spacing: .04em; }
                p { margin: 0; color: var(--muted, #89959e); }
                button {
                    flex: 0 0 auto;
                    border: 0;
                    padding: 0 2px;
                    background: none;
                    color: var(--muted, #89959e);
                    font: 20px/1 system-ui, sans-serif;
                    cursor: pointer;
                }
                button:hover, button:focus-visible { color: var(--text, #e7edf2); }
            </style>
            <div class="card" role="status" aria-live="polite">
                <span class="icon" aria-hidden="true">&#9888;</span>
                <div class="copy"><strong></strong><p></p></div>
                <button type="button" aria-label="Dismiss">&times;</button>
            </div>`;

        root.querySelector('button').addEventListener('click', () => {
            remember(host.dataset.key);
            host.style.display = 'none';
        });

        document.body.appendChild(host);
        return host;
    }

    function render() {
        if (!status) return;
        const missing = missingAsset();

        if (!missing || dismissed().has(missing.key)) {
            if (notice) notice.style.display = 'none';
            return;
        }

        notice ||= build();
        notice.dataset.key = missing.key;
        notice.shadowRoot.querySelector('strong').textContent = missing.title;
        notice.shadowRoot.querySelector('p').textContent = missing.body;
        notice.style.display = 'block';
    }

    document.addEventListener('change', event => {
        if (['mapSelect', 'mapStyleSelect'].includes(event.target?.id)) render();
    });

    fetch(new URL('assets-status.json', document.baseURI), { cache: 'no-store' })
        .then(response => (response.ok ? response.json() : null))
        .then(result => {
            status = result;
            // Map and style selectors are filled asynchronously on startup.
            [0, 1000, 3000].forEach(delay => setTimeout(render, delay));
        })
        .catch(() => {});
})();
