// SPDX-License-Identifier: GPL-3.0-or-later

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
    declarations: grid + source + 'uniform vec2 fs_impulse; uniform float fs_velocity_decay; uniform float fs_buoyancy;',
    body: `
        vec2 uv = cogl_tex_coord_in[0].xy;
        vec2 v = velocity(uv);
        vec2 mid = bounded(uv - 0.5 * fs_dt * v / fs_size);
        vec2 back = bounded(uv - fs_dt * velocity(mid) / fs_size);
        v = velocity(back) * exp(-fs_velocity_decay * fs_dt);
        float density = texture2D(cogl_sampler1, uv).a;
        v.y -= min(density, 2.0) * fs_buoyancy * fs_dt;
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
    declarations: grid + 'uniform float fs_vorticity; uniform float fs_detail;',
    body: `
        vec2 uv = cogl_tex_coord_in[0].xy;
        vec2 h = 2.0 / fs_size;
        float l = texture2D(cogl_sampler1, bounded(uv - vec2(h.x, 0.0))).r;
        float r = texture2D(cogl_sampler1, bounded(uv + vec2(h.x, 0.0))).r;
        float t = texture2D(cogl_sampler1, bounded(uv - vec2(0.0, h.y))).r;
        float b = texture2D(cogl_sampler1, bounded(uv + vec2(0.0, h.y))).r;
        vec2 n = vec2(abs(r) - abs(l), abs(b) - abs(t));
        n /= max(length(n), 0.0001);
        float c = (4.0 * texture2D(cogl_sampler1, uv).r + l + r + t + b) * 0.125;
        // Blend toward cell-scale confinement for frilled cloud edges. This is
        // driven by transported curl, not procedural noise or a painted texture.
        if (fs_detail > 0.0) {
            vec2 q = 1.0 / fs_size;
            float fl = texture2D(cogl_sampler1, bounded(uv - vec2(q.x, 0.0))).r;
            float fr = texture2D(cogl_sampler1, bounded(uv + vec2(q.x, 0.0))).r;
            float ft = texture2D(cogl_sampler1, bounded(uv - vec2(0.0, q.y))).r;
            float fb = texture2D(cogl_sampler1, bounded(uv + vec2(0.0, q.y))).r;
            vec2 fn = vec2(abs(fr) - abs(fl), abs(fb) - abs(ft));
            fn /= max(length(fn), 0.0001);
            n = mix(n, fn, fs_detail);
            c = mix(c, texture2D(cogl_sampler1, uv).r, fs_detail);
        }
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
        // Backward divergence / forward pressure gradient compose to the exact
        // five-point Laplacian solved by Jacobi. Centered/centered did not.
        vec2 v = velocity(uv);
        float l = uv.x < h.x ? 0.0 : velocity(uv - vec2(h.x, 0.0)).x;
        float t = uv.y < h.y ? 0.0 : velocity(uv - vec2(0.0, h.y)).y;
        if (uv.x > 1.0 - h.x) v.x = 0.0;
        if (uv.y > 1.0 - h.y) v.y = 0.0;
        float d = v.x - l + v.y - t;
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
        float p = texture2D(cogl_sampler1, uv).r;
        float r = texture2D(cogl_sampler1, bounded(uv + vec2(h.x, 0.0))).r;
        float b = texture2D(cogl_sampler1, bounded(uv + vec2(0.0, h.y))).r;
        vec2 v = velocity(uv) - vec2(r - p, b - p);
        // Stored components are outgoing fluxes for projection; the incoming
        // left/top wall fluxes are implicit zeros in divergence.
        if (uv.x > 1.0 - h.x) v.x = 0.0;
        if (uv.y > 1.0 - h.y) v.y = 0.0;
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
        // A moving source can catch its own advected dye and repeatedly load
        // the jet head. Smoothly reduce new emission into already dense smoke;
        // do not clamp away the structure/tint of smoke transported into a fold.
        float amount = splat(uv) * fs_amount * exp(-dye.a / 0.6);
        dye += vec4(fs_color * amount, amount);
        // RGB is density-weighted, alpha is scalar smoke density (not opacity).
        cogl_color_out = dye * min(1.0, 4.0 / max(dye.a, 0.0001));
    `,
};

export const presentation = {
    declarations: `
        uniform float fs_opacity;
        uniform float fs_wallpaper;
        uniform vec3 fs_background;
        uniform vec2 fs_dye_size;
        uniform float fs_brightness;
        uniform float fs_glow;
        uniform float fs_folds;
        vec3 luminous(vec4 dye) {
            return max(dye.rgb / max(dye.a, 0.0001), vec3(0.0))
                * (1.0 - exp(-1.1 * dye.a));
        }
    `,
    body: `
        vec4 dye = texture2D(cogl_sampler0, cogl_tex_coord_in[0].xy);
        vec3 tint = dye.rgb / max(dye.a, 0.0001);
        float opacity = 1.0 - exp(-1.1 * dye.a);
        // Do not amplify near-zero cell/interpolation errors with gamma < 1.
        vec3 color = max(tint * opacity, vec3(0.0));
        vec2 uv = cogl_tex_coord_in[0].xy;
        if (fs_folds > 0.0) {
            vec2 h = 2.0 / fs_dye_size;
            float l = texture2D(cogl_sampler0, uv - vec2(h.x, 0.0)).a;
            float r = texture2D(cogl_sampler0, uv + vec2(h.x, 0.0)).a;
            float t = texture2D(cogl_sampler0, uv - vec2(0.0, h.y)).a;
            float b = texture2D(cogl_sampler0, uv + vec2(0.0, h.y)).a;
            vec3 normal = normalize(vec3(5.0 * (l-r), 5.0 * (t-b), 1.0));
            float light = 0.55 + 0.8 * max(dot(normal, normalize(vec3(-0.4, -0.5, 1.0))), 0.0);
            color *= mix(1.0, light, fs_folds);
        }
        if (fs_glow > 0.0) {
            // Two sparse blur rings; no extra targets/passes. Exact black stays
            // black and alpha.6 takes neither optional sampling branch.
            vec3 halo = vec3(0.0);
            for (int i = 1; i <= 2; i++) {
                vec2 h = float(i) * 12.0 / fs_dye_size;
                halo += luminous(texture2D(cogl_sampler0, uv + vec2(h.x, 0.0)));
                halo += luminous(texture2D(cogl_sampler0, uv - vec2(h.x, 0.0)));
                halo += luminous(texture2D(cogl_sampler0, uv + vec2(0.0, h.y)));
                halo += luminous(texture2D(cogl_sampler0, uv - vec2(0.0, h.y)));
            }
            color += fs_glow * halo * 0.125;
        }
        color *= fs_brightness;
        // Soft shoulder only above the old output range; alpha.6 is unchanged.
        if (fs_brightness > 1.0)
            color = min(color, vec3(0.8)) + vec3(0.2) *
                (vec3(1.0) - exp(-max(color - vec3(0.8), vec3(0.0)) * 5.0));
        // Premultiplied source-over: empty dye reveals the wallpaper. Include
        // luminous halo coverage so glow stays visible outside the dye itself.
        float coverage = clamp(max(opacity, max(color.r, max(color.g, color.b))), 0.0, 1.0);
        vec3 backdrop = fs_background * (1.0 - coverage) * (1.0 - fs_wallpaper);
        float alpha = mix(1.0, coverage, fs_wallpaper);
        cogl_color_out = vec4((color + backdrop) * fs_opacity, alpha * fs_opacity);
    `,
};

// Developer-only display. No readback; modes are selected by a hidden schema key.
export const diagnostic = {
    declarations: 'uniform float fs_opacity; uniform float fs_debug;',
    body: `
        vec2 uv = cogl_tex_coord_in[0].xy;
        vec3 color;
        if (fs_debug > 4.5) {
            vec4 v;
            if (uv.x < 1.0/3.0) v = texture2D(cogl_sampler0, uv);
            else if (uv.x < 2.0/3.0) v = texture2D(cogl_sampler1, uv);
            else v = texture2D(cogl_sampler2, uv);
            color = max(-4.0 * v.rgb, vec3(0.0));
        } else if (fs_debug < 1.5) {
            vec2 v = texture2D(cogl_sampler0, uv).xy;
            color = vec3(max(v.x, 0.0), max(-v.x, 0.0), abs(v.y)) / 40.0;
            color = color / (vec3(1.0) + color);
        } else if (fs_debug < 2.5) {
            float c = texture2D(cogl_sampler1, uv).r;
            float a = 1.0 - exp(-abs(c) * 0.3);
            color = c > 0.0 ? vec3(a, 0.15*a, 0.0) : vec3(0.0, 0.3*a, a);
        } else if (fs_debug < 3.5) {
            float d = texture2D(cogl_sampler0, uv).a;
            color = vec3(1.0 - exp(-d));
        } else {
            // Same scale before (left) / after projection (right).
            vec2 p = vec2(fract(uv.x * 2.0), uv.y);
            float d = uv.x < 0.5 ? texture2D(cogl_sampler1, p).r
                : texture2D(cogl_sampler2, p).r;
            float a = 1.0 - exp(-abs(d));
            color = d > 0.0 ? vec3(a, 0.0, 0.0) : vec3(0.0, a, a);
        }
        cogl_color_out = vec4(color * fs_opacity, fs_opacity);
    `,
};
