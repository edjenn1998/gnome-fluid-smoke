// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use. Maintainer review required before EGO submission.

// Velocity is in grid cells/second; texture coordinates increase down the screen.
// Every stencil samples cell centers. No pass reads its own render attachment.
const grid = `
    uniform vec2 fs_size;
    uniform float fs_dt;
    vec2 bounded(vec2 uv) {
        return clamp(uv, 0.5 / fs_size, 1.0 - 0.5 / fs_size);
    }
    vec2 velocity(vec2 uv) {
        vec2 v = texture2D(cogl_sampler0, bounded(uv)).xy;
        if (uv.x < 0.0 || uv.x > 1.0) v.x = -v.x;
        if (uv.y < 0.0 || uv.y > 1.0) v.y = -v.y;
        return v;
    }
`;

const source = `
    uniform vec4 fs_segment;
    uniform float fs_emit;
    uniform float fs_radius;
    float splat(vec2 uv) {
        vec2 p = uv * fs_size;
        vec2 a = fs_segment.xy * fs_size;
        vec2 ab = (fs_segment.zw - fs_segment.xy) * fs_size;
        float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
        vec2 d = p - a - t * ab;
        return exp(-dot(d, d) / (fs_radius * fs_radius)) * fs_emit;
    }
`;

export const advectVelocity = {
    declarations: grid + source + 'uniform vec2 fs_impulse; uniform float fs_velocity_decay;',
    body: `
        vec2 uv = cogl_tex_coord_in[0].xy;
        vec2 v = velocity(uv);
        vec2 back = bounded(uv - fs_dt * v / fs_size);
        v = velocity(back) * exp(-fs_velocity_decay * fs_dt);
        float density = texture2D(cogl_sampler1, uv).a;
        v.y -= min(density, 3.0) * 18.0 * fs_dt;
        v += (fs_impulse - v) * splat(uv) * (1.0 - exp(-30.0 * fs_dt));
        float speed = length(v);
        v *= min(1.0, 180.0 / max(speed, 0.0001));
        cogl_color_out = vec4(v, 0.0, 1.0);
    `,
};

export const diffuseVelocity = {
    declarations: grid + 'uniform float fs_viscosity;',
    body: `
        vec2 uv = cogl_tex_coord_in[0].xy;
        vec2 h = 1.0 / fs_size;
        vec2 v = velocity(uv);
        vec2 laplacian = velocity(uv - vec2(h.x, 0.0))
            + velocity(uv + vec2(h.x, 0.0))
            + velocity(uv - vec2(0.0, h.y))
            + velocity(uv + vec2(0.0, h.y)) - 4.0 * v;
        cogl_color_out = vec4(v + fs_viscosity * fs_dt * laplacian, 0.0, 1.0);
    `,
};

export const curl = {
    declarations: grid,
    body: `
        vec2 uv = cogl_tex_coord_in[0].xy;
        vec2 h = 1.0 / fs_size;
        float c = 0.5 * (velocity(uv + vec2(h.x, 0.0)).y
            - velocity(uv - vec2(h.x, 0.0)).y
            - velocity(uv + vec2(0.0, h.y)).x
            + velocity(uv - vec2(0.0, h.y)).x);
        cogl_color_out = vec4(c, 0.0, 0.0, 1.0);
    `,
};

export const confine = {
    declarations: grid + 'uniform float fs_vorticity;',
    body: `
        vec2 uv = cogl_tex_coord_in[0].xy;
        vec2 h = 1.0 / fs_size;
        float l = abs(texture2D(cogl_sampler1, bounded(uv - vec2(h.x, 0.0))).r);
        float r = abs(texture2D(cogl_sampler1, bounded(uv + vec2(h.x, 0.0))).r);
        float t = abs(texture2D(cogl_sampler1, bounded(uv - vec2(0.0, h.y))).r);
        float b = abs(texture2D(cogl_sampler1, bounded(uv + vec2(0.0, h.y))).r);
        vec2 n = vec2(r - l, b - t);
        n /= max(length(n), 0.0001);
        float c = texture2D(cogl_sampler1, uv).r;
        vec2 v = velocity(uv) + vec2(n.y, -n.x) * c * (fs_vorticity * fs_dt);
        v *= min(1.0, 180.0 / max(length(v), 0.0001));
        cogl_color_out = vec4(v, 0.0, 1.0);
    `,
};

export const divergence = {
    declarations: grid,
    body: `
        vec2 uv = cogl_tex_coord_in[0].xy;
        vec2 h = 1.0 / fs_size;
        float d = 0.5 * (velocity(uv + vec2(h.x, 0.0)).x
            - velocity(uv - vec2(h.x, 0.0)).x
            + velocity(uv + vec2(0.0, h.y)).y
            - velocity(uv - vec2(0.0, h.y)).y);
        cogl_color_out = vec4(d, 0.0, 0.0, 1.0);
    `,
};

export const pressure = {
    declarations: grid,
    body: `
        vec2 uv = cogl_tex_coord_in[0].xy;
        vec2 h = 1.0 / fs_size;
        float l = texture2D(cogl_sampler0, bounded(uv - vec2(h.x, 0.0))).r;
        float r = texture2D(cogl_sampler0, bounded(uv + vec2(h.x, 0.0))).r;
        float t = texture2D(cogl_sampler0, bounded(uv - vec2(0.0, h.y))).r;
        float b = texture2D(cogl_sampler0, bounded(uv + vec2(0.0, h.y))).r;
        float d = texture2D(cogl_sampler1, uv).r;
        cogl_color_out = vec4((l + r + t + b - d) * 0.25, 0.0, 0.0, 1.0);
    `,
};

export const project = {
    declarations: grid,
    body: `
        vec2 uv = cogl_tex_coord_in[0].xy;
        vec2 h = 1.0 / fs_size;
        float l = texture2D(cogl_sampler1, bounded(uv - vec2(h.x, 0.0))).r;
        float r = texture2D(cogl_sampler1, bounded(uv + vec2(h.x, 0.0))).r;
        float t = texture2D(cogl_sampler1, bounded(uv - vec2(0.0, h.y))).r;
        float b = texture2D(cogl_sampler1, bounded(uv + vec2(0.0, h.y))).r;
        vec2 v = velocity(uv) - 0.5 * vec2(r - l, b - t);
        if (uv.x <= h.x || uv.x >= 1.0 - h.x) v.x = 0.0;
        if (uv.y <= h.y || uv.y >= 1.0 - h.y) v.y = 0.0;
        cogl_color_out = vec4(v, 0.0, 1.0);
    `,
};

export const advectDye = {
    declarations: grid + 'uniform vec2 fs_dye_size;',
    body: `
        vec2 uv = cogl_tex_coord_in[0].xy;
        vec2 back = clamp(uv - fs_dt * velocity(uv) / fs_size,
            0.5 / fs_dye_size, 1.0 - 0.5 / fs_dye_size);
        cogl_color_out = texture2D(cogl_sampler1, back);
    `,
};

// Limited MacCormack: forward + half the round-trip transport error. The local
// departure-cell extrema limiter prevents negative density and ringing. Layer 1
// is the original dye; layer 2 is the forward-advected dye, never the output.
export const correctDye = {
    declarations: grid + source + `
        uniform vec2 fs_dye_size;
        uniform vec3 fs_color;
        uniform float fs_dye_decay;
        uniform float fs_amount;
    `,
    body: `
        vec2 uv = cogl_tex_coord_in[0].xy;
        vec2 v = velocity(uv) / fs_size;
        vec2 back = clamp(uv - fs_dt * v, 0.5 / fs_dye_size, 1.0 - 0.5 / fs_dye_size);
        vec2 forward = clamp(uv + fs_dt * v, 0.5 / fs_dye_size, 1.0 - 0.5 / fs_dye_size);
        vec4 dye = texture2D(cogl_sampler2, uv) + 0.5 *
            (texture2D(cogl_sampler1, uv) - texture2D(cogl_sampler2, forward));
        vec2 base = (floor(back * fs_dye_size - 0.5) + 0.5) / fs_dye_size;
        vec2 h = 1.0 / fs_dye_size;
        vec4 a = texture2D(cogl_sampler1, base);
        vec4 b = texture2D(cogl_sampler1, base + vec2(h.x, 0.0));
        vec4 c = texture2D(cogl_sampler1, base + vec2(0.0, h.y));
        vec4 d = texture2D(cogl_sampler1, base + h);
        dye = clamp(dye, min(min(a, b), min(c, d)), max(max(a, b), max(c, d)));
        dye *= exp(-fs_dye_decay * fs_dt);
        float amount = splat(uv) * fs_amount;
        dye += vec4(fs_color * amount, amount);
        // RGB is density-weighted, alpha is scalar smoke density (not opacity).
        cogl_color_out = min(dye, vec4(4.0));
    `,
};

export const presentation = {
    declarations: 'uniform float fs_opacity;',
    body: `
        vec4 dye = texture2D(cogl_sampler0, cogl_tex_coord_in[0].xy);
        vec3 tint = dye.rgb / max(dye.a, 0.0001);
        float opacity = 1.0 - exp(-1.6 * dye.a);
        // Do not amplify near-zero cell/interpolation errors with gamma < 1.
        vec3 color = max(tint * opacity, vec3(0.0));
        cogl_color_out = vec4(color * fs_opacity, fs_opacity);
    `,
};
