// SPDX-License-Identifier: GPL-3.0-or-later
// Record the production step planner/pass graph for offscreen visual inspection.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
const root = process.env.FLUID_ROOT ? pathToFileURL(`${process.env.FLUID_ROOT}/`) :
    new URL('../', import.meta.url);
const simulation = await import(new URL('extension/core/simulation.js', root));
const shaders = await import(new URL('extension/gpu/shaders.js', root));
const settings = await import(new URL('extension/core/settings.js', root));

const context = vm.createContext({});
const module = new vm.SourceTextModule(await readFile(
    new URL('extension/gpu/feedback.js', root), 'utf8'), {context});
await module.link(specifier => {
    const exports = specifier === 'gi://Cogl' ? {default: {BufferBit: {COLOR: 1}}} :
        specifier === './shaders.js' ? shaders :
            specifier === '../core/settings.js' ? settings : simulation;
    return new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [key, value] of Object.entries(exports))
            this.setExport(key, value);
    }, {context});
});
await module.evaluate();
const commands = [];
const targets = [];
class Recorder extends module.namespace.FluidSimulation {
    target(width = this.width, height = this.height) {
        const id = targets.length;
        targets.push([width, height]);
        return {id, framebuffer: {
            clear4f: () => commands.push({clear: id}), flush() {},
        }};
    }

    initialize() {
        this.velocity = [this.target(), this.target()];
        this.dye = [this.target(this.dyeWidth, this.dyeHeight),
            this.target(this.dyeWidth, this.dyeHeight)];
        this.dyeForward = this.target(this.dyeWidth, this.dyeHeight);
        this.pressure = [this.target(), this.target()];
        this.curl = this.target();
        this.divergence = this.target();
        this.pipelines.presentation = {set_layer_texture() {}};
    }

    draw(name, output, inputs, dt, uniforms = {}) {
        commands.push({name, output: output.id, inputs: inputs.map(t => t.id), dt,
            uniforms: {fs_dye_size: [this.dyeWidth, this.dyeHeight], ...uniforms}});
    }
}
const fluid = new Recorder(null, Number(process.argv[3] ?? 320), Number(process.argv[4] ?? 180));
fluid.initialize();
// Exercise different pointer speeds and repeated stirring with the same solver.
const scenario = process.argv[2] ?? 'sweep';
if (!['sweep', 'slow', 'fast', 'circle', 'reversal'].includes(scenario))
    throw new Error(`Unknown preview scenario: ${scenario}`);
const point = frame => {
    const t = frame / (scenario === 'fast' ? 45 : scenario === 'slow' ? 180 : 90);
    if (['circle', 'slow', 'fast'].includes(scenario))
        return [0.5 + 0.2 * Math.cos(t * Math.PI * 2),
            0.5 + 0.25 * Math.sin(t * Math.PI * 2)];
    if (scenario === 'reversal')
        return [0.25 + 0.5 * (frame <= 60 ? frame / 60 : (120 - frame) / 60), 0.5];
    return [0.25 + 0.5 * frame / 120, 0.5];
};
const stop = ['sweep', 'reversal'].includes(scenario) ? 120 : 180;
for (let frame = 0; frame < stop + 180; frame++) {
    const segment = frame < stop ? [...point(frame), ...point(frame + 1)] : null;
    fluid.step(1 / 60, segment, frame / 60 * 0.7);
    if ([stop - 1, stop + 59, stop + 119, stop + 179].includes(frame))
        commands.push({snapshot: frame, afterStop: (frame + 1 - stop) / 60,
            dye: fluid.dye[0].id, velocity: fluid.velocity[0].id,
            divergence: fluid.divergence.id});
}
console.log(JSON.stringify({width: fluid.width, height: fluid.height, targets, commands}));
