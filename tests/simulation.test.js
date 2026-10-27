// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {planSteps, MAX_STEP, MAX_SUBSTEPS, PRESSURE_ITERATIONS,
    simulationParameters} from '../extension/core/simulation.js';
import * as shaders from '../extension/gpu/shaders.js';

test('time planner bounds stalls and rejects invalid or nonpositive elapsed time', () => {
    for (const dt of [0, -1, Infinity, NaN])
        assert.deepEqual(planSteps(dt, null, 384, 216), []);
    for (const elapsed of [1 / 120, 1 / 60, 1 / 30, 10]) {
        const steps = planSteps(elapsed, null, 384, 216);
        assert.ok(steps.length <= MAX_SUBSTEPS);
        assert.ok(steps.every(step => step.dt > 0 && step.dt <= MAX_STEP));
        const sum = steps.reduce((total, step) => total + step.dt, 0);
        assert.ok(Math.abs(sum - Math.min(elapsed, MAX_STEP * MAX_SUBSTEPS)) < 1e-12);
        assert.ok(steps.every(step => step.segment === null));
    }
});

test('substeps cover a pointer path exactly once and cap injected speed', () => {
    const segment = [0.1, 0.2, 0.8, 0.9];
    const steps = planSteps(1 / 15, segment, 384, 216);
    assert.equal(steps.length, 2);
    assert.deepEqual(steps[0].segment.slice(0, 2), segment.slice(0, 2));
    assert.deepEqual(steps[0].segment.slice(2), steps[1].segment.slice(0, 2));
    steps[1].segment.slice(2).forEach((value, i) => assert.ok(Math.abs(value - segment[i + 2]) < 1e-12));
    assert.ok(steps.every(step => Math.hypot(...step.impulse) <= 240.000001));
    const slow = planSteps(1, [0, 0, 0.01, 0.01], 100, 200);
    assert.deepEqual(slow[0].impulse, [1, 2]);
});

async function fixture({failAllocation = 0} = {}) {
    const draws = [];
    const targets = [];
    let allocations = 0;
    const Cogl = {
        Pipeline: {new: () => ({
            textures: [], uniforms: {}, locations: [],
            add_snippet(snippet) { this.shader = snippet.body; },
            set_blend() {}, set_layer_filters() {}, set_layer_wrap_mode() {},
            set_layer_texture(i, texture) { this.textures[i] = texture; },
            get_uniform_location(name) { this.locations.push(name); return this.locations.length - 1; },
            set_uniform_float(location, _components, _count, values) {
                this.uniforms[this.locations[location]] = [...values];
            },
        })},
        Snippet: {new: () => ({set_replace(body) { this.body = body; }})},
        SnippetHook: {}, PipelineFilter: {}, PipelineWrapMode: {}, PixelFormat: {}, BufferBit: {},
        Texture2D: {new_with_format: () => ({
            allocate() {
                if (++allocations === failAllocation)
                    throw new Error('allocation failed');
            },
        })},
        Offscreen: {new_with_texture: texture => {
            const framebuffer = {
                allocate() {}, orthographic() {}, set_dither_enabled() {}, flush() {},
                clear4f() { this.clears = (this.clears ?? 0) + 1; },
                draw_textured_rectangle(pipeline) {
                    assert.ok(!pipeline.textures.includes(texture), 'read/write feedback alias');
                    draws.push({shader: pipeline.shader, uniforms: {...pipeline.uniforms}});
                },
            };
            targets.push(framebuffer);
            return framebuffer;
        }},
    };
    const context = vm.createContext({});
    const module = new vm.SourceTextModule(await readFile(
        new URL('../extension/gpu/feedback.js', import.meta.url), 'utf8'), {context});
    await module.link(specifier => {
        const exports = specifier === 'gi://Cogl' ? {default: Cogl} :
            specifier === './shaders.js' ? shaders : {planSteps, PRESSURE_ITERATIONS, simulationParameters};
        return new vm.SyntheticModule(Object.keys(exports), function () {
            for (const [key, value] of Object.entries(exports))
                this.setExport(key, value);
        }, {context});
    });
    await module.evaluate();
    return {Simulation: module.namespace.FluidSimulation, draws, targets};
}

test('solver pass graph avoids feedback, projects before dye, and clears all fields', async () => {
    const f = await fixture();
    const fluid = new f.Simulation({}, 64, 36);
    fluid.initialize();
    assert.equal(f.targets.length, 9);
    const pressureClears = f.targets.slice(5, 7).map(target => target.clears);
    fluid.step(1 / 15, [0.2, 0.3, 0.4, 0.5], 0.5);
    assert.deepEqual(f.targets.slice(5, 7).map(target => target.clears), pressureClears,
        'pressure must survive between substeps for the warm-started solve');
    assert.equal(f.draws.length, 2 * (PRESSURE_ITERATIONS + 8));
    for (let i = 0; i < 2; i++) {
        const batch = f.draws.slice(i * 32, (i + 1) * 32);
        assert.equal(batch[0].shader, shaders.diffuseVelocity.body);
        assert.equal(batch[1].shader, shaders.advectVelocity.body);
        assert.equal(batch[4].shader, shaders.divergence.body);
        assert.equal(batch[29].shader, shaders.project.body);
        assert.equal(batch[30].shader, shaders.advectDye.body);
        assert.equal(batch[31].shader, shaders.correctDye.body);
    }
    fluid.step(1 / 60, null, 1);
    assert.equal(f.draws.at(-1).uniforms.fs_emit[0], 0);
    assert.equal(fluid.presentationPipeline(128).uniforms.fs_opacity[0], 128 / 255);
    fluid.clear();
    assert.ok(f.targets.every(target => target.clears >= 2));
    assert.deepEqual(f.targets.slice(5, 7).map(target => target.clears),
        pressureClears.map(count => count + 1), 'reset must clear warm-started pressure');
    fluid.destroy();
    fluid.destroy();
    assert.equal(fluid.targets.length, 0);
    assert.equal(Object.keys(fluid.pipelines).length, 0);
    assert.equal(fluid.velocity, null);
});

test('viscosity is configurable within the explicit diffusion stability bound', () => {
    assert.equal(simulationParameters({viscosity: 0}).viscosity, 0);
    assert.ok(simulationParameters({viscosity: 100}).viscosity * MAX_STEP <= 0.25);
    assert.throws(() => simulationParameters({dyeDissipation: NaN}), /invalid/);
});

test('partial GPU allocation can release every recorded native owner', async () => {
    const f = await fixture({failAllocation: 3});
    const fluid = new f.Simulation({}, 64, 36);
    assert.throws(() => fluid.initialize(), /allocation failed/);
    assert.equal(fluid.targets.length, 3);
    fluid.destroy();
    assert.equal(fluid.targets.length, 0);
    assert.equal(fluid.velocity, null);
});
