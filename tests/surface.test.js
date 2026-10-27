// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {probeDimensions} from '../extension/core/coordinates.js';

test('surface keeps stepping without input, then clears and stops at ten seconds', async () => {
    const steps = [];
    let clears = 0;
    class Simulation {
        initialize() {}
        clear() { clears++; }
        step(dt, segment) { steps.push({dt, segment}); }
        destroy() {}
    }
    class Actor { destroy() {} }
    class Content { invalidate() {} }
    const context = vm.createContext({});
    const dependencies = {
        'gi://Clutter': {default: {Actor, Content: {}}},
        'gi://GObject': {default: {Object: Content, registerClass: (_props, cls) => cls}},
        '../gpu/feedback.js': {FluidSimulation: Simulation},
        '../core/coordinates.js': {probeDimensions},
    };
    const module = new vm.SourceTextModule(await readFile(new URL(
        '../extension/shell/surface.js', import.meta.url), 'utf8'), {context});
    await module.link(specifier => {
        const exports = dependencies[specifier];
        return new vm.SyntheticModule(Object.keys(exports), function () {
            for (const [name, value] of Object.entries(exports))
                this.setExport(name, value);
        }, {context});
    });
    await module.evaluate();
    const surface = new module.namespace.MonitorSurface({index: 0, x: 0, y: 0,
        width: 1920, height: 1080}, {});
    surface.initialize({add_child() {}});
    surface.update(1, null, false);
    surface.update(1.08, [0.3, 0.3, 0.4, 0.3], false);
    assert.ok(Math.abs(steps[0].dt - 0.08) < 1e-9, 'use actual idle sampling interval');
    for (const time of [1.1, 2, 5, 10.9])
        surface.update(time, null, false);
    assert.equal(steps.length, 5);
    assert.ok(steps.slice(1).every(step => step.segment === null));
    surface.update(11.08, null, false);
    assert.equal(clears, 1);
    assert.equal(surface.active, false);
    surface.update(12, null, false);
    assert.equal(steps.length, 5);
    surface.destroy();
});
