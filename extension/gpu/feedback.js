// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Cogl from 'gi://Cogl';
import * as Shaders from './shaders.js';

function makePipeline(context, shader) {
    const pipeline = Cogl.Pipeline.new(context);
    const snippet = Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, shader.declarations, null);
    snippet.set_replace(shader.body);
    pipeline.add_snippet(snippet);
    pipeline.set_blend('RGBA = ADD (SRC_COLOR, 0)');
    pipeline.set_layer_filters(0, Cogl.PipelineFilter.LINEAR, Cogl.PipelineFilter.LINEAR);
    pipeline.set_layer_wrap_mode(0, Cogl.PipelineWrapMode.CLAMP_TO_EDGE);
    return pipeline;
}

function uniform(pipeline, name, values) {
    pipeline.set_uniform_float(pipeline.get_uniform_location(name), values.length, 1, values);
}

export class FeedbackProbe {
    constructor(context, width, height) {
        this.width = width;
        this.height = height;
        this.targets = [];
        this.pipelines = [];
        // The constructor is kept side-effect free; initialize() permits rollback.
        this.context = context;
    }

    initialize() {
        for (let i = 0; i < 2; i++) {
            const texture = Cogl.Texture2D.new_with_format(this.context,
                this.width, this.height, Cogl.PixelFormat.RGBA_FP_16161616);
            const framebuffer = Cogl.Offscreen.new_with_texture(texture);
            this.targets.push({texture, framebuffer});
            // Explicit allocation is important: lazy allocation can abort on failure.
            texture.allocate();
            framebuffer.allocate();
            framebuffer.orthographic(0, 0, this.width, this.height, -1, 1);
            framebuffer.set_dither_enabled(false);
        }
        this.pipelines = [Shaders.evolution, Shaders.injection, Shaders.presentation]
            .map(shader => makePipeline(this.context, shader));
        this.context = null;
        this.clear();
    }

    clear() {
        for (const {framebuffer} of this.targets)
            framebuffer.clear4f(Cogl.BufferBit.COLOR, 0, 0, -0.5, 1);
        this.pipelines[2].set_layer_texture(0, this.targets[0].texture);
    }

    step(dt, segment, hue) {
        const [a, b] = this.targets;
        const [evolve, inject, present] = this.pipelines;
        evolve.set_layer_texture(0, a.texture);
        uniform(evolve, 'fs_dt', [dt]);
        b.framebuffer.draw_textured_rectangle(evolve, 0, 0, this.width, this.height, 0, 0, 1, 1);

        inject.set_layer_texture(0, b.texture);
        uniform(inject, 'fs_segment', segment ?? [0, 0, 0, 0]);
        uniform(inject, 'fs_size', [this.width, this.height]);
        uniform(inject, 'fs_color', [0.55 + 0.45 * Math.sin(hue), 0.55 + 0.45 * Math.cos(hue)]);
        uniform(inject, 'fs_emit', [segment ? 0.6 : 0]);
        a.framebuffer.draw_textured_rectangle(inject, 0, 0, this.width, this.height, 0, 0, 1, 1);
        // Flush submits work without waiting for the GPU; no finish/readback loop.
        a.framebuffer.flush();
        present.set_layer_texture(0, a.texture);
    }

    presentationPipeline(opacity) {
        const pipeline = this.pipelines[2];
        uniform(pipeline, 'fs_opacity', [opacity / 255]);
        return pipeline;
    }

    destroy() {
        // GJS owns the Cogl references. Drop ALL owners, including pipeline texture
        // bindings. GPU deletion occurs when GJS finalizes the wrappers (GC-dependent).
        this.pipelines = [];
        this.targets = [];
        this.context = null;
    }
}
