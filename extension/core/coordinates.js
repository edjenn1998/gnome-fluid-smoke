// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

export function locateMonitor(monitors, x, y) {
    return monitors.findIndex(m => x >= m.x && y >= m.y &&
        x < m.x + m.width && y < m.y + m.height);
}

export function localPoint(monitor, x, y) {
    return [(x - monitor.x) / monitor.width, (y - monitor.y) / monitor.height];
}

export function movementSegment(previous, current, monitor) {
    if (!previous || previous.monitor !== current.monitor)
        return null;
    const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
    // Ignore stationary samples and likely warps, including pointer recentering.
    if (distance < 0.5 || distance > Math.min(monitor.width, monitor.height) * 0.5)
        return null;
    return [...localPoint(monitor, previous.x, previous.y),
        ...localPoint(monitor, current.x, current.y)];
}

export function probeDimensions(monitor) {
    // Deliberately tiny until compositor safety and float feedback are verified.
    const scale = Math.min(0.5, 384 / Math.max(monitor.width, monitor.height));
    return [Math.max(1, Math.round(monitor.width * scale)),
        Math.max(1, Math.round(monitor.height * scale))];
}
