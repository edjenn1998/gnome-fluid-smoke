// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import * as settingsModule from '../extension/core/settings.js';

class Signals {
    handlers = new Map();
    connect(signal, callback) {
        const id = Symbol(signal);
        this.handlers.set(id, {signal, callback});
        return id;
    }
    disconnect(id) { assert.ok(this.handlers.delete(id)); }
    emit(signal) {
        for (const entry of this.handlers.values()) {
            if (entry.signal === signal)
                entry.callback(this);
        }
    }
}

async function preferences(overrides = {}) {
    const widgets = [];
    class Widget extends Signals {
        constructor(properties = {}) {
            super();
            Object.assign(this, properties);
            widgets.push(this);
        }
        add() {}
        add_suffix(widget) { this.button = widget; }
        set_default_size() {}
        get value() { return this._value ?? 0; }
        set value(value) {
            value = Math.max(this.adjustment.lower, Math.min(this.adjustment.upper, value));
            if (value !== this._value) {
                this._value = value;
                this.emit('notify::value');
            }
        }
        get selected() { return this._selected ?? 0; }
        set selected(value) {
            if (value !== this._selected) {
                this._selected = value;
                this.emit('notify::selected');
            }
        }
        get rgba() { return this._rgba; }
        set rgba(value) { this._rgba = value; this.emit('notify::rgba'); }
    }
    const defaults = {...settingsModule.STANDARD_PRESET,
        'background-mode': 'solid', 'background-color': '#000000'};
    const values = {...defaults, ...overrides};
    const settings = Object.assign(new Signals(), {
        get_double: key => values[key], get_string: key => values[key],
        set_double: set, set_string: set,
        reset: key => set(key, defaults[key]),
    });
    let writes = 0;
    function set(key, value) {
        assert.ok(++writes < 500, 'Preferences entered a settings feedback loop');
        if (values[key] !== value) {
            values[key] = value;
            settings.emit(`changed::${key}`);
        }
    }
    const dependencies = {
        'gi://Adw': {default: {PreferencesPage: Widget, PreferencesGroup: Widget,
            ActionRow: Widget, SpinRow: Widget, ComboRow: Widget}},
        'gi://Gdk': {default: {RGBA: Widget}},
        'gi://Gtk': {default: {Button: Widget, Adjustment: Widget, ColorDialogButton: Widget,
            ColorDialog: Widget, Align: {CENTER: 0}, StringList: {new: items => items}}},
        'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js': {
            ExtensionPreferences: class { getSettings() { return settings; } },
        },
        './core/settings.js': settingsModule,
    };
    const context = vm.createContext({});
    const module = new vm.SourceTextModule(await readFile(
        new URL('../extension/prefs.js', import.meta.url), 'utf8'), {context});
    await module.link(specifier => {
        const exports = dependencies[specifier];
        return new vm.SyntheticModule(Object.keys(exports), function () {
            for (const [key, value] of Object.entries(exports))
                this.setExport(key, value);
        }, {context});
    });
    await module.evaluate();
    const window = new Widget();
    new module.namespace.default().fillPreferencesWindow(window);
    return {values, settings, window, widgets, get writes() { return writes; },
        row: title => widgets.find(widget => widget.title === title)};
}

test('numeric controls start at zero and store changes on either side of the set point', async () => {
    const prefs = await preferences();
    assert.equal(prefs.writes, 0, 'Opening preferences must not rewrite saved settings');
    const numeric = prefs.widgets.filter(widget => widget.adjustment);
    assert.equal(numeric.length, 12);
    assert.ok(numeric.every(row => row.value === 0));

    const amount = prefs.row('Smoke amount');
    amount.value = -0.5;
    assert.equal(prefs.values['smoke-amount'], 1.25);
    amount.value = 0.5;
    assert.equal(prefs.values['smoke-amount'], 2.25);

    const width = prefs.row('Plume width');
    width.value = -1.8;
    assert.equal(prefs.values['source-width'], 1);
    width.value = 0.3;
    assert.equal(prefs.values['source-width'], 3.1);
    prefs.settings.set_double('source-width', 2.8);
    assert.equal(width.value, 0, 'External changes update the displayed adjustment');

    prefs.row('Glow').value = -100;
    assert.equal(prefs.values.glow, 0, 'Negative adjustments stay within the schema range');
    prefs.row('Glow').value = 100;
    assert.equal(prefs.values.glow, 1);
});

test('presets, reset and saved preferences use the same baseline and release settings watchers', async () => {
    const prefs = await preferences({'source-width': 1, 'background-mode': 'wallpaper'});
    assert.equal(prefs.writes, 0);
    assert.ok(Math.abs(prefs.row('Plume width').value + 1.8) < 1e-12);

    prefs.row('Less Smoke').button.emit('clicked');
    assert.equal(prefs.values['linger-time'], 10);
    assert.equal(prefs.row('Linger time').value, -8);
    assert.equal(prefs.values['background-mode'], 'wallpaper');

    prefs.row('Luminous Rolls & Billowing Clouds — standard').button.emit('clicked');
    assert.ok(prefs.widgets.filter(widget => widget.adjustment).every(row => row.value === 0));
    assert.equal(prefs.values['background-mode'], 'wallpaper');

    prefs.row('Smoke amount').value = 0.5;
    prefs.widgets.find(widget => widget.label === 'Reset to standard').emit('clicked');
    assert.equal(prefs.row('Smoke amount').value, 0);
    assert.equal(prefs.values['background-mode'], 'solid');

    prefs.window.emit('close-request');
    assert.equal(prefs.settings.handlers.size, 0);
});
