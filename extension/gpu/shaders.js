// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// Temporary feedback experiment, not Navier–Stokes. B=-0.5 is a signed-float
// sentinel that must survive both render passes and inter-frame sampling.
export const evolution = {
    declarations: 'uniform float fs_dt;',
    body: `
        vec2 uv = cogl_tex_coord_in[0].xy;
        vec2 source = uv - vec2(0.0, -0.025 * fs_dt);
        vec4 old = texture2D(cogl_sampler0, clamp(source, vec2(0.0), vec2(1.0)));
        vec2 dye = old.rg * exp(-0.8 * fs_dt);
        if (source.y > 1.0) dye = vec2(0.0);
        cogl_color_out = vec4(dye, old.b, 1.0);
    `,
};

export const injection = {
    declarations: `
        uniform vec4 fs_segment;
        uniform vec2 fs_size;
        uniform vec2 fs_color;
        uniform float fs_emit;
    `,
    body: `
        vec2 uv = cogl_tex_coord_in[0].xy;
        vec4 old = texture2D(cogl_sampler0, uv);
        vec2 p = uv * fs_size;
        vec2 a = fs_segment.xy * fs_size;
        vec2 b = fs_segment.zw * fs_size;
        vec2 ab = b - a;
        float t = clamp(dot(p-a, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
        float d = length(p - a - t * ab);
        float splat = exp(-d*d / 180.0) * fs_emit;
        cogl_color_out = vec4(min(old.rg + fs_color*splat, vec2(1.0)), old.b, 1.0);
    `,
};

export const presentation = {
    declarations: 'uniform float fs_opacity;',
    body: `
        vec4 state = texture2D(cogl_sampler0, cogl_tex_coord_in[0].xy);
        vec3 color = vec3(state.r, state.g, 0.75 * (state.r + state.g));
        // A solid magenta rectangle is a FAILED storage/feedback test.
        if (abs(state.b + 0.5) > 0.01) color = vec3(1.0, 0.0, 1.0);
        cogl_color_out = vec4(color * fs_opacity, fs_opacity);
    `,
};
