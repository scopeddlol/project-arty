/*
 * Adapts the production `dist/` artifact for the self-hosted container.
 * Run after `npm run build` and `npm run test:build`.
 *
 * - Collaborative lobbies and feedback stay disabled; they depend on the
 *   upstream project's Cloudflare service.
 * - Umami analytics and every third-party origin are removed from the CSP.
 *   `upgrade-insecure-requests` is dropped so plain-HTTP LAN installs work;
 *   TLS is left to the reverse proxy in front of the container.
 * - The app pages load a small notice that explains blank maps when the
 *   admin has not installed map imagery (see docker/assets-notice.js).
 *
 * The build fails if any reference to the upstream asset CDN remains: map
 * assets must come from the admin's own map-assets folder.
 */
import { copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UPSTREAM_ASSET_HOST = 'assets.wardogs-artillery.com';
const NOTICE_SCRIPT = 'js/assets-notice.js';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(process.argv[2] || 'dist');

async function* walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) yield* walk(path);
        else yield path;
    }
}

function sameOriginPolicy(policy) {
    return policy
        .split(';')
        .map(directive => directive.trim())
        .filter(directive => directive && directive !== 'upgrade-insecure-requests')
        .map(directive => {
            const [name, ...sources] = directive.split(/\s+/);
            const local = sources.filter(source => !/^(https?|wss?):\/\//i.test(source));
            return [name, ...(local.length ? local : ["'none'"])].join(' ');
        })
        .join('; ');
}

function adaptHtml(html) {
    let output = html
        .replace(
            /<meta content="([^"]*)" http-equiv="Content-Security-Policy"\/>/gi,
            (_, policy) => `<meta content="${sameOriginPolicy(policy)}" http-equiv="Content-Security-Policy"/>`
        )
        .replace(/\s*<script\b[^>]*\bsrc="https:\/\/cloud\.umami\.is\/[^"]*"[^>]*><\/script>/gi, '');

    // Only the calculator pages (desktop and mobile) have a map to explain.
    if (output.includes('id="mapSelect"') && !output.includes(NOTICE_SCRIPT)) {
        output = output.replace(
            /<\/body>/i,
            `<script defer src="${NOTICE_SCRIPT}"></script>\n</body>`
        );
    }

    return output;
}

function adaptConfig(json) {
    const config = JSON.parse(json);
    if (config.collab) config.collab.enabled = false;
    if (config.feedback) config.feedback.enabled = false;
    return `${JSON.stringify(config, null, 2)}\n`;
}

await copyFile(join(here, 'assets-notice.js'), join(dist, NOTICE_SCRIPT));

const changed = [];
const leftovers = [];

for await (const path of walk(dist)) {
    const name = relative(dist, path).split('\\').join('/');
    const extension = extname(path);
    if (!['.html', '.json'].includes(extension)) continue;

    const original = await readFile(path, 'utf8');
    let updated = original;

    if (name === 'config/app.json') updated = adaptConfig(updated);
    else if (extension === '.html') updated = adaptHtml(updated);

    if (updated !== original) {
        await writeFile(path, updated, 'utf8');
        changed.push(name);
    }

    if (updated.includes(UPSTREAM_ASSET_HOST) || updated.includes('cloud.umami.is')) {
        leftovers.push(name);
    }
}

if (leftovers.length) {
    throw new Error(
        `Self-host preparation left upstream URLs in:\n  ${leftovers.join('\n  ')}`
    );
}

console.log(`Self-host preparation updated ${changed.length} files in ${dist}.`);
