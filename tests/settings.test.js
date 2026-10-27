// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import test from 'node:test';
import {parseColor, smokeColor} from '../extension/core/settings.js';

test('custom colors support solid and smoothly blended colors with safe invalid-color fallback', () => {
    assert.deepEqual(parseColor('#ff8000'), [1, 128 / 255, 0]);
    assert.deepEqual(parseColor('invalid'), parseColor('#66ccff'));
    assert.deepEqual(smokeColor(50, {mode: 'solid', primary: '#ff0000'}), [1, 0, 0]);
    const options = {mode: 'gradient', primary: '#ff0000', secondary: '#0000ff'};
    assert.deepEqual(smokeColor(0, options), [1, 0, 0]);
    assert.deepEqual(smokeColor(Math.PI, options), [0, 0, 1]);
    const mid = smokeColor(Math.PI / 2, options);
    assert.ok(Math.abs(mid[0] - 0.5) < 1e-12 && Math.abs(mid[2] - 0.5) < 1e-12);
    assert.ok(smokeColor(10).every(value => value >= 0.1 && value <= 1));
});
