// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use. Maintainer review required before EGO submission.

import Cogl from 'gi://Cogl';
import * as Shaders from './shaders.js';
import {planSteps, PRESSURE_ITERATIONS} from '../core/simulation.js';

function makePipeline(context, shader, layers) {
    const pipeline = Cogl.Pipeline.new(context);
    const snippet = Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, shader.declarations, null);
    snippet.set_replace(shader.body);
    pipeline.add_snippet(snippet);
    pipeline.set_blend('RGBA = ADD (SRC_COLOR, 0)');
    for (let i = 0; i < layers; i++) {
        pipeline.set_layer_filters(i, Cogl.PipelineFilter.LINEAR, Cogl.PipelineFilter.LINEAR);
        pipeline.set_layer_wrap_mode(i, Cogl.PipelineWrapMode.CLAMP_TO_EDGE);
    }
    return pipeline;
}

function uniform(pipeline, name, values) {
    const location = pipeline.get_uniform_location(name);
    if (location >= 0)
        pipeline.set_uniform_float(location, values.length, 1, values);
}

export class FluidSimulation {
    constructor(context, width, height) {
        this.width = width;
        this.height = height;
        this.targets = [];
        this.pipelines = {};
        // Construction is side-effect free so partial initialization can roll back.
        this.context = context;
    }

    target() {
        const texture = Cogl.Texture2D.new_with_format(this.context,
            this.width, this.height, Cogl.PixelFormat.RGBA_FP_16161616);
        const framebuffer = Cogl.Offscreen.new_with_texture(texture);
        const target = {texture, framebuffer};
        this.targets.push(target);
        texture.allocate();
        framebuffer.allocate();
        framebuffer.orthographic(0, 0, this.width, this.height, -1, 1);
        framebuffer.set_dither_enabled(false);
        return target;
    }

    initialize() {
        this.velocity = [this.target(), this.target()];
        this.dye = [this.target(), this.target()];
        this.pressure = [this.target(), this.target()];
        this.curl = this.target();
        this.divergence = this.target();
        for (const name of Object.keys(Shaders)) {
            const layers = ['curl', 'divergence', 'presentation'].includes(name) ? 1 : 2;
            this.pipelines[name] = makePipeline(this.context, Shaders[name], layers);
        }
        this.context = null;
        this.clear();
    }

    clear() {
        for (const {framebuffer} of this.targets)
            framebuffer.clear4f(Cogl.BufferBit.COLOR, 0, 0, 0, 0);
        this.pipelines.presentation.set_layer_texture(0, this.dye[0].texture);
    }

    draw(name, output, inputs, dt, uniforms = {}) {
        const pipeline = this.pipelines[name];
        inputs.forEach((target, i) => {
            if (output === target)
                throw new Error(`Fluid Smoke: feedback alias in ${name}`);
            pipeline.set_layer_texture(i, target.texture);
        });
        uniform(pipeline, 'fs_size', [this.width, this.height]);
        uniform(pipeline, 'fs_dt', [dt]);
        for (const [key, value] of Object.entries(uniforms))
            uniform(pipeline, key, value);
        output.framebuffer.draw_textured_rectangle(pipeline,
            0, 0, this.width, this.height, 0, 0, 1, 1);
    }

    step(elapsed, segment, hue) {
        const steps = planSteps(elapsed, segment, this.width, this.height);
        const color = [0, 2.0944, 4.1888].map(phase => 0.55 + 0.45 * Math.cos(hue + phase));
        for (const {dt, segment: part, impulse} of steps) {
            const injection = {
                fs_segment: part ?? [0, 0, 0, 0],
                fs_emit: [part ? 1 : 0],
                fs_radius: [Math.max(2, Math.min(this.width, this.height) * 0.025)],
            };
            this.draw('advectVelocity', this.velocity[1], [this.velocity[0], this.dye[0]], dt,
                {...injection, fs_impulse: impulse});
            this.velocity.reverse();
            this.draw('curl', this.curl, [this.velocity[0]], dt);
            this.draw('confine', this.velocity[1], [this.velocity[0], this.curl], dt);
            this.velocity.reverse();
            this.draw('divergence', this.divergence, [this.velocity[0]], dt);
            // Start from zero: bounded work and no stale pressure after a pause.
            for (const target of this.pressure)
                target.framebuffer.clear4f(Cogl.BufferBit.COLOR, 0, 0, 0, 0);
            for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
                this.draw('pressure', this.pressure[1], [this.pressure[0], this.divergence], dt);
                this.pressure.reverse();
            }
            this.draw('project', this.velocity[1], [this.velocity[0], this.pressure[0]], dt);
            this.velocity.reverse();
            this.draw('advectDye', this.dye[1], [this.velocity[0], this.dye[0]], dt,
                {...injection, fs_color: color});
            this.dye.reverse();
        }
        if (steps.length)
            this.dye[0].framebuffer.flush();
        this.pipelines.presentation.set_layer_texture(0, this.dye[0].texture);
    }

    presentationPipeline(opacity) {
        const pipeline = this.pipelines.presentation;
        uniform(pipeline, 'fs_opacity', [opacity / 255]);
        return pipeline;
    }

    destroy() {
        // Native release remains GJS GC-dependent; drop all bindings and owners.
        this.pipelines = {};
        this.targets = [];
        this.velocity = this.dye = this.pressure = null;
        this.curl = this.divergence = null;
        this.context = null;
    }
}
