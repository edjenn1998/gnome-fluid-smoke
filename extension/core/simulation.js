// SPDX-License-Identifier: GPL-3.0-or-later

import {STANDARD_PRESET} from './settings.js';

export const PRESSURE_ITERATIONS = 24;
// Leave headroom for timer jitter at the 30 Hz fallback without doubling passes.
export const MAX_STEP = 1 / 24;
export const MAX_SUBSTEPS = 2;

// Viscosity is cells²/s; dissipation is per second.
export const DEFAULT_PARAMETERS = Object.freeze({
    viscosity: STANDARD_PRESET.viscosity,
    velocityDissipation: 0.18,
    dyeDissipation: 6.5 / STANDARD_PRESET['linger-time'],
    vorticity: STANDARD_PRESET.swirl,
    smokeAmount: STANDARD_PRESET['smoke-amount'],
    sourceWidth: STANDARD_PRESET['source-width'],
    momentumSpread: STANDARD_PRESET['momentum-spread'],
    buoyancy: STANDARD_PRESET.buoyancy,
    fineDetail: STANDARD_PRESET['fine-detail'],
    brightness: STANDARD_PRESET.brightness,
    glow: STANDARD_PRESET.glow,
    foldShading: STANDARD_PRESET['fold-shading'],
});

export function simulationParameters(overrides = {}) {
    const limits = {viscosity: [0, 3], velocityDissipation: [0, 4],
        dyeDissipation: [0.1, 4], vorticity: [0, 12], smokeAmount: [0.5, 3],
        sourceWidth: [0.5, 4], momentumSpread: [1, 4], buoyancy: [0, 18],
        fineDetail: [0, 1], brightness: [0.5, 4], glow: [0, 1], foldShading: [0, 1]};
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
