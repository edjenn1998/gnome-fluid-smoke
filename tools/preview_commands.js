// SPDX-License-Identifier: GPL-3.0-or-later
// Record the production step planner/pass graph for offscreen visual inspection.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as simulation from '../extension/core/simulation.js';
import * as shaders from '../extension/gpu/shaders.js';

const context = vm.createContext({});
const module = new vm.SourceTextModule(await readFile(
    new URL('../extension/gpu/feedback.js', import.meta.url), 'utf8'), {context});
await module.link(specifier => {
    const exports = specifier === 'gi://Cogl' ? {default: {BufferBit: {COLOR: 1}}} :
        specifier === './shaders.js' ? shaders : simulation;
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
const fluid = new Recorder(null, 320, 180);
fluid.initialize();
// A sweep, reversal, then a pause: exposes leading rolls and post-input motion.
const point = frame => {
    const t = frame / 90;
    return [0.75 - 0.5 * t, 0.5 + 0.16 * Math.sin(t * Math.PI * 2)];
};
for (let frame = 0; frame < 180; frame++) {
    const segment = frame < 90 ? [...point(frame), ...point(frame + 1)] : null;
    fluid.step(1 / 60, segment, frame / 60 * 1.8);
    if ([59, 89, 119, 179].includes(frame))
        commands.push({snapshot: frame, dye: fluid.dye[0].id});
}
console.log(JSON.stringify({width: fluid.width, height: fluid.height, targets, commands}));
