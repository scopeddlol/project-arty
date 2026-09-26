import assert from 'node:assert/strict';
import test from 'node:test';
import { PROJECT_FULL_NAME, PROJECT_NAME, brandTitle } from './branding.mjs';

test('titles are prefixed with the project name exactly once', () => {
    assert.equal(brandTitle('WARDOGS Ozeti Map'), `${PROJECT_NAME} - WARDOGS Ozeti Map`);
    assert.equal(brandTitle(brandTitle('Map')), `${PROJECT_NAME} - Map`);
    assert.equal(brandTitle(''), PROJECT_FULL_NAME);
});
