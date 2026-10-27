// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use. Maintainer review required before EGO submission.

export const PRESSURE_ITERATIONS = 24;
// Leave headroom for timer jitter at the 30 Hz fallback without doubling passes.
export const MAX_STEP = 1 / 24;
export const MAX_SUBSTEPS = 2;

// Bounded flow defaults. Viscosity is cells²/second; decay
// coefficients are per second. Explicit diffusion requires nu * dt <= 1/4.
export const DEFAULT_PARAMETERS = Object.freeze({
    viscosity: 0.15,
    velocityDissipation: 0.18,
    dyeDissipation: 0.65,
    vorticity: 8,
    smokeAmount: 1.75,
});

export function simulationParameters(overrides = {}) {
    const limits = {viscosity: [0, 3], velocityDissipation: [0, 4],
        dyeDissipation: [0.1, 4], vorticity: [0, 12], smokeAmount: [0.5, 3]};
    return Object.fromEntries(Object.entries(DEFAULT_PARAMETERS).map(([name, fallback]) => {
        const value = overrides[name] ?? fallback;
        if (!Number.isFinite(value))
            throw new Error(`Fluid Smoke: invalid ${name}`);
        const [low, high] = limits[name];
        return [name, Math.max(low, Math.min(high, value))];
    }));
}

// Discard excess wall time after stalls. Never run an unbounded catch-up loop.
// Split the pointer segment too, rather than emitting it repeatedly per substep.
export function planSteps(elapsed, segment, width, height) {
    if (!Number.isFinite(elapsed) || elapsed <= 0)
        return [];
    const duration = Math.min(elapsed, MAX_STEP * MAX_SUBSTEPS);
    const count = Math.min(MAX_SUBSTEPS, Math.ceil(duration / MAX_STEP));
    const dt = duration / count;
    const impulse = segment ? [
        (segment[2] - segment[0]) * width / elapsed,
        (segment[3] - segment[1]) * height / elapsed,
    ] : [0, 0];
    const speed = Math.hypot(...impulse);
    const scale = Math.min(1, 120 / Math.max(speed, 0.0001));
    const point = t => [segment[0] + (segment[2] - segment[0]) * t,
        segment[1] + (segment[3] - segment[1]) * t];
    return Array.from({length: count}, (_, i) => ({
        dt,
        impulse: impulse.map(value => value * scale),
        segment: segment ? [...point(i / count), ...point((i + 1) / count)] : null,
    }));
}
