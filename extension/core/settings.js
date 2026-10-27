// SPDX-License-Identifier: GPL-3.0-or-later
// Shared, GI-free conversion for live preferences and smoke colors.
export const SETTING_KEYS = Object.freeze([
    'smoke-amount', 'linger-time', 'swirl', 'viscosity',
    'color-mode', 'primary-color', 'secondary-color',
]);

export function readSettings(settings) {
    const lingerTime = settings.get_double('linger-time');
    return {
        lingerTime,
        parameters: {
            smokeAmount: settings.get_double('smoke-amount'),
            dyeDissipation: 6.5 / lingerTime,
            vorticity: settings.get_double('swirl'),
            viscosity: settings.get_double('viscosity'),
        },
        appearance: {
            mode: settings.get_string('color-mode'),
            primary: settings.get_string('primary-color'),
            secondary: settings.get_string('secondary-color'),
        },
    };
}

export function parseColor(value, fallback = '#66ccff') {
    const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255);
}

export function smokeColor(hue, {mode = 'rainbow', primary, secondary} = {}) {
    if (mode === 'solid')
        return parseColor(primary);
    if (mode === 'gradient') {
        const a = parseColor(primary);
        const b = parseColor(secondary, '#ff66cc');
        const mix = (1 - Math.cos(hue)) / 2;
        return a.map((value, i) => value * (1 - mix) + b[i] * mix);
    }
    return [0, 2.0944, 4.1888].map(phase => 0.55 + 0.45 * Math.cos(hue + phase));
}
