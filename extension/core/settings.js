// SPDX-License-Identifier: GPL-3.0-or-later
// Shared, GI-free conversion for live preferences and smoke colors.
export const SETTING_KEYS = Object.freeze([
    'smoke-amount', 'linger-time', 'swirl', 'viscosity',
    'color-mode', 'primary-color', 'secondary-color',
    'source-width', 'momentum-spread', 'buoyancy', 'fine-detail',
    'brightness', 'glow', 'fold-shading', 'color-speed',
]);

// Full visual recipes. Alpha.6 is also the schema default; existing installs
// retain their saved amount/colors/motion until a preset is explicitly applied.
const alpha6 = {
    'smoke-amount': 1.75, 'linger-time': 10, 'swirl': 8, 'viscosity': 0.15,
    'color-mode': 'rainbow', 'primary-color': '#66ccff', 'secondary-color': '#ff66cc',
    'source-width': 1, 'momentum-spread': 2.5, 'buoyancy': 6, 'fine-detail': 0,
    'brightness': 1, 'glow': 0, 'fold-shading': 0, 'color-speed': 1,
};
export const PRESETS = Object.freeze({
    alpha6: Object.freeze(alpha6),
    photo: Object.freeze({...alpha6, 'source-width': 1.8, 'momentum-spread': 2.2,
        'buoyancy': 1.5, 'linger-time': 14, 'brightness': 2.4, 'glow': 0.4,
        'fold-shading': 0.35, 'fine-detail': 0.2, 'color-speed': 1.6}),
    video: Object.freeze({...alpha6, 'source-width': 2.8, 'momentum-spread': 1.8,
        'buoyancy': 0, 'linger-time': 18, 'swirl': 11, 'viscosity': 0.05,
        'brightness': 2.1, 'glow': 0.25, 'fold-shading': 0.65, 'fine-detail': 0.85,
        'color-speed': 2.5}),
});

export function applyPreset(settings, name) {
    const preset = PRESETS[name];
    if (!preset)
        throw new Error(`Fluid Smoke: unknown preset ${name}`);
    for (const [key, value] of Object.entries(preset)) {
        if (typeof value === 'string')
            settings.set_string(key, value);
        else
            settings.set_double(key, value);
    }
}

export function readSettings(settings) {
    const lingerTime = settings.get_double('linger-time');
    return {
        lingerTime,
        debugView: settings.get_string('debug-view'),
        parameters: {
            smokeAmount: settings.get_double('smoke-amount'),
            dyeDissipation: 6.5 / lingerTime,
            vorticity: settings.get_double('swirl'),
            viscosity: settings.get_double('viscosity'),
            sourceWidth: settings.get_double('source-width'),
            momentumSpread: settings.get_double('momentum-spread'),
            buoyancy: settings.get_double('buoyancy'),
            fineDetail: settings.get_double('fine-detail'),
            brightness: settings.get_double('brightness'),
            glow: settings.get_double('glow'),
            foldShading: settings.get_double('fold-shading'),
        },
        appearance: {
            mode: settings.get_string('color-mode'),
            primary: settings.get_string('primary-color'),
            secondary: settings.get_string('secondary-color'),
            speed: settings.get_double('color-speed'),
        },
    };
}

export function parseColor(value, fallback = '#66ccff') {
    const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255);
}

export function smokeColor(hue, {mode = 'rainbow', primary, secondary, speed = 1} = {}) {
    hue *= speed;
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
