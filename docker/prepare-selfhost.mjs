/*
 * Adapts the production `dist/` artifact for self-hosting behind the bundled
 * nginx container. Run after `npm run build` and `npm run test:build`.
 *
 * - Map tiles and Terrain3D data are rewritten to the same-origin `/cdn/`
 *   prefix. nginx proxies and caches that prefix from the upstream asset CDN,
 *   so the app works on any hostname without CDN CORS changes.
 * - Collaborative lobbies and feedback are disabled. The hosted Worker only
 *   accepts the official site origin, so the buttons could never succeed.
 * - Umami analytics and every third-party origin are removed from the CSP.
 *   `upgrade-insecure-requests` is dropped so plain-HTTP LAN installs work;
 *   TLS is left to the reverse proxy in front of the container.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

const CDN_ORIGIN = 'https://assets.wardogs-artillery.com';
const CDN_PREFIX = '/cdn';

const dist = resolve(process.argv[2] || 'dist');

async function* walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) yield* walk(path);
        else yield path;
    }
}

function rewriteCdnUrls(text) {
    return text.replaceAll(`${CDN_ORIGIN}/`, `${CDN_PREFIX}/`);
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
    return html
        .replace(
            /<meta content="([^"]*)" http-equiv="Content-Security-Policy"\/>/gi,
            (_, policy) => `<meta content="${sameOriginPolicy(policy)}" http-equiv="Content-Security-Policy"/>`
        )
        .replace(/\s*<script\b[^>]*\bsrc="https:\/\/cloud\.umami\.is\/[^"]*"[^>]*><\/script>/gi, '')
        .replace(/\s*<link\b[^>]*href="(?:https:)?\/\/assets\.wardogs-artillery\.com"[^>]*\/?>/gi, '');
}

function adaptConfig(json) {
    const config = JSON.parse(json);
    if (config.collab) config.collab.enabled = false;
    if (config.feedback) config.feedback.enabled = false;
    return `${JSON.stringify(config, null, 2)}\n`;
}

const changed = [];
const leftovers = [];

for await (const path of walk(dist)) {
    const name = relative(dist, path).split('\\').join('/');
    const extension = extname(path);
    if (!['.html', '.json'].includes(extension)) continue;

    const original = await readFile(path, 'utf8');
    let updated = original;

    if (name === 'config/app.json') updated = adaptConfig(updated);
    else if (extension === '.json') updated = rewriteCdnUrls(updated);
    else updated = adaptHtml(updated);

    if (updated !== original) {
        await writeFile(path, updated, 'utf8');
        changed.push(name);
    }

    if (updated.includes(CDN_ORIGIN) || updated.includes('cloud.umami.is')) {
        leftovers.push(name);
    }
}

if (leftovers.length) {
    throw new Error(
        `Self-host preparation left upstream URLs in:\n  ${leftovers.join('\n  ')}`
    );
}

console.log(`Self-host preparation updated ${changed.length} files in ${dist}.`);
