// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {PRESETS, STANDARD_PRESET, SETTING_KEYS, applyPreset, readSettings, parseColor, smokeColor} from '../extension/core/settings.js';
import {DEFAULT_PARAMETERS, simulationParameters} from '../extension/core/simulation.js';

test('custom colors support solid and smoothly blended colors with safe invalid-color fallback', () => {
    assert.deepEqual(parseColor('#ff8000'), [1, 128 / 255, 0]);
    assert.deepEqual(parseColor('invalid'), parseColor('#66ccff'));
    assert.deepEqual(smokeColor(50, {mode: 'solid', primary: '#ff0000'}), [1, 0, 0]);
    const options = {mode: 'gradient', primary: '#ff0000', secondary: '#0000ff', speed: 1};
    assert.deepEqual(smokeColor(0, options), [1, 0, 0]);
    assert.deepEqual(smokeColor(Math.PI, options), [0, 0, 1]);
    const mid = smokeColor(Math.PI / 2, options);
    assert.ok(Math.abs(mid[0] - 0.5) < 1e-12 && Math.abs(mid[2] - 0.5) < 1e-12);
    assert.ok(smokeColor(10).every(value => value >= 0.1 && value <= 1));
});

test('combined standard matches schema and solver defaults, with a solid black background', () => {
    const schema = readFileSync(new URL('../extension/schemas/org.gnome.shell.extensions.fluid-smoke.gschema.xml', import.meta.url), 'utf8');
    const defaults = {};
    for (const match of schema.matchAll(/<key name="([^"]+)" type="([^"]+)">([\s\S]*?)<\/key>/g)) {
        if (match[1] === 'debug-view')
            continue;
        const value = match[3].match(/<default>(.*?)<\/default>/)[1];
        defaults[match[1]] = match[2] === 's' ? value.slice(1, -1) : Number(value);
    }
    const {['background-mode']: backgroundMode, ['background-color']: backgroundColor, ...smokeDefaults} = defaults;
    assert.deepEqual(smokeDefaults, STANDARD_PRESET);
    assert.equal(backgroundMode, 'solid');
    assert.equal(backgroundColor, '#000000');
    assert.deepEqual(Object.keys(defaults).sort(), [...SETTING_KEYS].sort());
    const options = readSettings({get_double: key => defaults[key], get_string: key => defaults[key]});
    assert.deepEqual(simulationParameters(options.parameters), DEFAULT_PARAMETERS);
    assert.equal(options.appearance.speed, 2.5);
    assert.deepEqual(options.background, {mode: 'solid', color: '#000000'});
});

test('background settings reach the renderer and smoke presets preserve the background', () => {
    const values = {...STANDARD_PRESET, 'background-mode': 'wallpaper', 'background-color': '#123456'};
    const settings = {get_double: key => values[key], get_string: key => values[key],
        set_double: (key, value) => { values[key] = value; },
        set_string: (key, value) => { values[key] = value; }};
    for (const name of Object.keys(PRESETS)) {
        applyPreset(settings, name);
        assert.deepEqual(readSettings(settings).background, {mode: 'wallpaper', color: '#123456'});
    }
    values['background-mode'] = 'solid';
    assert.deepEqual(readSettings(settings).background, {mode: 'solid', color: '#123456'});
    assert.deepEqual(parseColor('invalid', '#000000'), [0, 0, 0]);
});

test('all presets apply complete in-range recipes and the standard restores adjustments', () => {
    const values = {};
    const settings = {get_double: key => values[key], get_string: key => values[key],
        set_double: (key, value) => { values[key] = value; },
        set_string: (key, value) => { values[key] = value; }};
    for (const name of ['luminous', 'billowing', 'less-smoke', 'standard']) {
        applyPreset(settings, name);
        assert.deepEqual(values, PRESETS[name]);
        const options = readSettings(settings);
        const bounded = simulationParameters(options.parameters);
        for (const [key, value] of Object.entries(options.parameters))
            assert.equal(bounded[key], value, `${name}: ${key} must not be silently clipped`);
        assert.ok(smokeColor(3, options.appearance).every(Number.isFinite));
    }
    assert.throws(() => applyPreset(settings, 'unknown'));
    assert.deepEqual(values, STANDARD_PRESET);
    assert.deepEqual(smokeColor(0.7, {speed: 2.5}), smokeColor(1.75, {speed: 1}));
});

test('Less Smoke retains the narrower, shorter-lived appearance without optional lighting', () => {
    const less = PRESETS['less-smoke'];
    assert.ok(less['source-width'] < STANDARD_PRESET['source-width']);
    assert.ok(less['linger-time'] < STANDARD_PRESET['linger-time']);
    assert.ok(less.brightness < STANDARD_PRESET.brightness);
    assert.equal(less.glow, 0);
    assert.equal(less['fold-shading'], 0);
});
