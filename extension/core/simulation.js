// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use. Maintainer review required before EGO submission.

export const PRESSURE_ITERATIONS = 24;
export const MAX_STEP = 1 / 30;
export const MAX_SUBSTEPS = 2;

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
