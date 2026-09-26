/*
 * Project branding shared by the build scripts, dev server and tests.
 */
export const PROJECT_NAME = 'PROJECT: ARTY';

export const PROJECT_FULL_NAME =
    `${PROJECT_NAME} - WARDOGS Artillery Calculator`;

export function brandTitle(title) {
    const value = String(title || '').trim();
    if (!value) return PROJECT_FULL_NAME;
    if (value.startsWith(PROJECT_NAME)) return value;
    return `${PROJECT_NAME} - ${value}`;
}
