// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import test from 'node:test';
import {locateMonitor, localPoint, movementSegment, probeDimensions} from '../extension/core/coordinates.js';

const monitors = [
    {x: -1920, y: 120, width: 1920, height: 1080, scale: 1},
    {x: 0, y: -400, width: 1440, height: 2560, scale: 1.5},
];

test('logical coordinates handle negative origins, portrait layout and half-open edges', () => {
    assert.equal(locateMonitor(monitors, -1, 120), 0);
    assert.equal(locateMonitor(monitors, 0, 120), 1);
    assert.equal(locateMonitor(monitors, -1921, 120), -1);
    assert.equal(locateMonitor(monitors, -100, 119), -1);
    assert.equal(locateMonitor(monitors, 1440, 120), -1);
    assert.deepEqual(localPoint(monitors[0], -960, 660), [0.5, 0.5]);
    assert.deepEqual(localPoint(monitors[1], 720, 880), [0.5, 0.5]);
});

test('monitor transitions and pointer warps never create cross-desktop segments', () => {
    const previous = {x: -10, y: 200, monitor: 0};
    assert.equal(movementSegment(previous, {x: 10, y: 200, monitor: 1}, monitors[1]), null);
    assert.equal(movementSegment(null, previous, monitors[0]), null);
    assert.equal(movementSegment(previous, previous, monitors[0]), null);
    assert.equal(movementSegment(previous, {x: -1500, y: 200, monitor: 0}, monitors[0]), null);
    const segment = movementSegment(previous, {x: -20, y: 200, monitor: 0}, monitors[0]);
    assert.equal(segment.length, 4);
    assert.ok(segment.every(Number.isFinite));
});

test('probe grids are bounded for 8K and tiny logical monitors', () => {
    for (const monitor of [...monitors, {width: 7680, height: 4320}, {width: 1, height: 1}]) {
        const dimensions = probeDimensions(monitor);
        assert.ok(dimensions.every(n => Number.isInteger(n) && n > 0 && n <= 384));
    }
});
