// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use. Maintainer review required before EGO submission.

import Cogl from 'gi://Cogl';
import * as Shaders from './shaders.js';
import {planSteps, PRESSURE_ITERATIONS, simulationParameters} from '../core/simulation.js';
import {parseColor, smokeColor} from '../core/settings.js';

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
    constructor(context, width, height, parameters = {}) {
        this.width = width;
        this.height = height;
        this.parameters = simulationParameters(parameters);
        this.appearance = {};
        this.debugView = 'normal';
        this.dyeWidth = width * 2;
        this.dyeHeight = height * 2;
        this.targets = [];
        this.pipelines = {};
        // Construction is side-effect free so partial initialization can roll back.
        this.context = context;
    }

    target(width = this.width, height = this.height) {
        const texture = Cogl.Texture2D.new_with_format(this.context,
            width, height, Cogl.PixelFormat.RGBA_FP_16161616);
        const framebuffer = Cogl.Offscreen.new_with_texture(texture);
        const target = {texture, framebuffer, width, height};
        this.targets.push(target);
        texture.allocate();
        framebuffer.allocate();
        framebuffer.orthographic(0, 0, width, height, -1, 1);
        framebuffer.set_dither_enabled(false);
        return target;
    }

    initialize() {
        this.velocity = [this.target(), this.target()];
        this.dye = [this.target(this.dyeWidth, this.dyeHeight),
            this.target(this.dyeWidth, this.dyeHeight)];
        this.dyeForward = this.target(this.dyeWidth, this.dyeHeight);
        this.pressure = [this.target(), this.target()];
        this.curl = this.target();
        this.divergence = this.target();
        for (const name of Object.keys(Shaders)) {
            const layers = ['correctDye', 'diagnostic'].includes(name) ? 3 :
                ['curl', 'divergence', 'diffuseVelocity', 'presentation'].includes(name) ? 1 : 2;
            this.pipelines[name] = makePipeline(this.context, Shaders[name], layers);
        }
        this.pipelines.presentation.set_blend('RGBA = ADD (SRC_COLOR, DST_COLOR * (1-SRC_COLOR[A]))');
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
        uniform(pipeline, 'fs_dye_size', [this.dyeWidth, this.dyeHeight]);
        for (const [key, value] of Object.entries(uniforms))
            uniform(pipeline, key, value);
        output.framebuffer.draw_textured_rectangle(pipeline,
            0, 0, output.width, output.height, 0, 0, 1, 1);
    }

    step(elapsed, segment, hue) {
        const steps = planSteps(elapsed, segment, this.width, this.height);
        const color = smokeColor(hue, this.appearance);
        for (const {dt, segment: part, impulse} of steps) {
            // Resolve a modest filament inside a wider momentum/shear envelope.
            const radius = Math.max(1.5, Math.min(this.width, this.height) * 0.014) *
                this.parameters.sourceWidth;
            const injection = {
                fs_segment: part ?? [0, 0, 0, 0],
                fs_emit: [part ? 1 : 0],
                fs_radius: [radius],
            };
            if (this.parameters.viscosity > 0) {
                this.draw('diffuseVelocity', this.velocity[1], [this.velocity[0]], dt,
                    {fs_viscosity: [this.parameters.viscosity]});
                this.velocity.reverse();
            }
            this.draw('advectVelocity', this.velocity[1], [this.velocity[0], this.dye[0]], dt,
                {...injection, fs_radius: [radius * this.parameters.momentumSpread], fs_impulse: impulse,
                    fs_buoyancy: [this.parameters.buoyancy],
                    fs_velocity_decay: [this.parameters.velocityDissipation]});
            this.velocity.reverse();
            this.draw('curl', this.curl, [this.velocity[0]], dt);
            this.draw('confine', this.velocity[1], [this.velocity[0], this.curl], dt,
                {fs_vorticity: [this.parameters.vorticity], fs_detail: [this.parameters.fineDetail]});
            this.velocity.reverse();
            this.draw('divergence', this.divergence, [this.velocity[0]], dt);
            // Keep the previous pressure as an initial guess. Lifecycle clear()
            // still resets all fields, including pressure, on suspension/idle.
            for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
                this.draw('pressure', this.pressure[1], [this.pressure[0], this.divergence], dt);
                this.pressure.reverse();
            }
            this.draw('project', this.velocity[1], [this.velocity[0], this.pressure[0]], dt);
            this.velocity.reverse();
            this.draw('advectDye', this.dyeForward, [this.velocity[0], this.dye[0]], dt);
            this.draw('correctDye', this.dye[1],
                [this.velocity[0], this.dye[0], this.dyeForward], dt,
                {...injection, fs_color: color, fs_dye_decay: [this.parameters.dyeDissipation],
                    fs_amount: [0.28 * this.parameters.smokeAmount *
                        Math.min(1, Math.hypot(...impulse) * dt / radius)]});
            this.dye.reverse();
        }
        if (steps.length)
            this.dye[0].framebuffer.flush();
        this.pipelines.presentation.set_layer_texture(0, this.dye[0].texture);
        if (this.debugView !== 'normal' && this.debugView !== 'layers') {
            // Only diagnostic mode submits these additional passes. Pre-project
            // divergence is already retained by the production pass graph.
            this.debugDivergence ??= this.target();
            this.draw('curl', this.curl, [this.velocity[0]], 0);
            this.draw('divergence', this.debugDivergence, [this.velocity[0]], 0);
        }
        if (this.debugView !== 'normal') {
            this.diagnostics = {frame: (this.diagnostics?.frame ?? 0) + 1,
                elapsed, integrated: steps.reduce((sum, step) => sum + step.dt, 0),
                substeps: steps.length, input: Boolean(segment),
                width: this.width, height: this.height, pressureIterations: PRESSURE_ITERATIONS};
        }
    }

    presentationPipeline(opacity) {
        const mode = ['normal', 'velocity', 'curl', 'density', 'divergence', 'layers'].indexOf(this.debugView);
        const pipeline = mode > 0 ? this.pipelines.diagnostic : this.pipelines.presentation;
        if (mode > 0) {
            pipeline.set_layer_texture(0, (mode === 3 ? this.dye[0] : this.velocity[0]).texture);
            pipeline.set_layer_texture(1, (mode === 4 ? this.divergence : this.curl).texture);
            pipeline.set_layer_texture(2, (this.debugDivergence ?? this.divergence).texture);
            uniform(pipeline, 'fs_debug', [mode]);
            if (mode === 5) {
                this.debugLayers ??= [this.target(1, 1), this.target(1, 1), this.target(1, 1)];
                this.debugLayers.forEach((target, i) => {
                    const value = [0, 0, 0];
                    value[i] = -0.25;
                    target.framebuffer.clear4f(Cogl.BufferBit.COLOR, ...value, 0);
                    pipeline.set_layer_texture(i, target.texture);
                });
            }
        }
        uniform(pipeline, 'fs_opacity', [opacity / 255]);
        if (mode <= 0) {
            uniform(pipeline, 'fs_wallpaper', [this.background?.mode === 'wallpaper' ? 1 : 0]);
            uniform(pipeline, 'fs_background', parseColor(this.background?.color, '#000000'));
            uniform(pipeline, 'fs_dye_size', [this.dyeWidth, this.dyeHeight]);
            uniform(pipeline, 'fs_brightness', [this.parameters.brightness]);
            uniform(pipeline, 'fs_glow', [this.parameters.glow]);
            uniform(pipeline, 'fs_folds', [this.parameters.foldShading]);
        }
        return pipeline;
    }

    destroy() {
        // Native release remains GJS GC-dependent; drop all bindings and owners.
        this.pipelines = {};
        this.targets = [];
        this.velocity = this.dye = this.pressure = null;
        this.curl = this.divergence = null;
        this.dyeForward = null;
        this.debugDivergence = null;
        this.debugLayers = null;
        this.diagnostics = null;
        this.context = null;
    }
}
