// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

class Emitter {
    handlers = new Map();
    connect(signal, callback) {
        const id = Symbol(signal);
        this.handlers.set(id, {signal, callback});
        return id;
    }
    disconnect(id) { assert.ok(this.handlers.delete(id)); }
    emit(signal) {
        for (const entry of [...this.handlers.values()]) {
            if (entry.signal === signal)
                entry.callback();
        }
    }
}

async function fixture({wayland = true} = {}) {
    const timers = new Map();
    const surfaces = [];
    const actors = [];
    let point = {x: 100, y: 100};
    let time = 1;
    const errors = [];
    class Actor {
        constructor(props) { Object.assign(this, props); actors.push(this); }
        destroy() { this.destroyed = true; }
    }
    const background = Object.assign(new Emitter(), {
        add_child() {}, set_child_above_sibling() {},
    });
    const layout = Object.assign(new Emitter(), {
        _backgroundGroup: background,
        monitors: [{index: 0, x: 0, y: 0, width: 1920, height: 1080}],
    });
    const shield = Object.assign(new Emitter(), {active: false});
    const overview = Object.assign(new Emitter(), {visible: false});
    const settings = Object.assign(new Emitter(), {reducedMotion: 0});
    const display = Object.assign(new Emitter(), {get_monitor_in_fullscreen: () => false});
    const shellGlobal = {
        context: {get_wayland_compositor: () => wayland ? {} : null},
        backend: {get_cursor_tracker: () => ({get_pointer: () => [point, 0]})},
        stage: {context: {get_backend: () => ({get_cogl_context: () => ({})})}},
        display,
    };
    class Surface {
        constructor(monitor) { this.monitor = monitor; surfaces.push(this); }
        initialize() {
            if (!this.monitor)
                throw new Error('mock monitor allocation failure');
        }
        reset() { this.active = false; }
        update(_now, segment, suspended) { this.active = !!segment && !suspended; }
        destroy() { this.destroyed = true; }
    }
    const context = vm.createContext({global: shellGlobal,
        console: {error: message => errors.push(message)}});
    const modules = {
        'gi://Clutter': {default: {Actor}},
        'gi://GLib': {default: {
            PRIORITY_DEFAULT: 0, SOURCE_REMOVE: false,
            get_monotonic_time: () => time * 1e6,
            timeout_add: (_priority, interval, callback) => {
                const id = Symbol('timer'); timers.set(id, {interval, callback}); return id;
            },
            Source: {remove: id => assert.ok(timers.delete(id))},
        }},
        'gi://St': {default: {Settings: {get: () => settings}, ReducedMotion: {REDUCE: 1}}},
        'resource:///org/gnome/shell/ui/main.js': {layoutManager: layout, screenShield: shield, overview},
        './surface.js': {MonitorSurface: Surface},
    };
    const source = await readFile(new URL('../extension/shell/session.js', import.meta.url), 'utf8');
    const module = new vm.SourceTextModule(source, {context});
    await module.link(async specifier => {
        if (specifier === '../core/coordinates.js') {
            return new vm.SourceTextModule(await readFile(
                new URL('../extension/core/coordinates.js', import.meta.url), 'utf8'), {context});
        }
        const exports = modules[specifier];
        assert.ok(exports, specifier);
        return new vm.SyntheticModule(Object.keys(exports), function () {
            for (const [name, value] of Object.entries(exports))
                this.setExport(name, value);
        }, {context});
    });
    await module.evaluate();
    const entry = new vm.SourceTextModule(await readFile(
        new URL('../extension/extension.js', import.meta.url), 'utf8'), {context});
    await entry.link(specifier => {
        if (specifier === './shell/session.js')
            return module;
        assert.equal(specifier, 'resource:///org/gnome/shell/extensions/extension.js');
        return new vm.SyntheticModule(['Extension'], function () {
            this.setExport('Extension', class {});
        }, {context});
    });
    await entry.evaluate();
    return {
        Session: module.namespace.ProbeSession, timers, surfaces, layout, shield, settings, display, overview,
        Extension: entry.namespace.default, shellGlobal, errors, actors,
        emitters: [background, layout, shield, settings, display, overview],
        move(x, y) { point = {x, y}; time += 0.017; },
        advance(seconds) { time += seconds; },
        fire() {
            assert.equal(timers.size, 1);
            const [id, {callback}] = [...timers][0];
            timers.delete(id);
            callback();
        },
    };
}

test('repeated lifecycle and monitor rebuilds release timers, signals and surfaces', async () => {
    const f = await fixture();
    for (let cycle = 0; cycle < 10; cycle++) {
        const session = new f.Session();
        session.start();
        f.fire();
        f.move(110 + cycle * 10, 110);
        f.fire();
        assert.equal([...f.timers.values()][0].interval, 17);
        f.layout.emit('monitors-changed');
        assert.ok(f.surfaces.at(-2).destroyed);
        session.destroy();
        assert.equal(f.timers.size, 0);
        assert.ok(f.emitters.every(emitter => emitter.handlers.size === 0));
        assert.ok(f.surfaces.every(surface => surface.destroyed));
    }
});

test('sustained missed active callbacks select the bounded 30 Hz fallback', async () => {
    const f = await fixture();
    const session = new f.Session();
    session.start();
    f.fire();
    for (let i = 0; i < 35; i++) {
        f.move(110 + i, 110);
        f.advance(0.02);
        f.fire();
    }
    assert.equal([...f.timers.values()][0].interval, 33);
    session.destroy();
});

test('lock, overview and reduced motion stop polling and allow resume', async () => {
    const f = await fixture();
    const session = new f.Session();
    session.start();
    for (const [object, property, signal] of [
        [f.shield, 'active', 'active-changed'],
        [f.overview, 'visible', 'showing'],
        [f.settings, 'reducedMotion', 'notify::reduced-motion'],
    ]) {
        object[property] = 1;
        object.emit(signal);
        assert.equal(f.timers.size, 0);
        object[property] = 0;
        object.emit(signal === 'showing' ? 'hidden' : signal);
        assert.equal(f.timers.size, 1);
    }
    session.destroy();
});

test('partial monitor initialization failure rolls back resources', async () => {
    const f = await fixture();
    const session = new f.Session();
    session.start();
    f.layout.monitors = [null];
    assert.throws(() => session.rebuild());
    assert.equal(f.timers.size, 0);
    assert.ok(f.emitters.every(emitter => emitter.handlers.size === 0));
    session.destroy();
});

test('null Wayland compositor rejects startup before allocating resources', async () => {
    const f = await fixture({wayland: false});
    const session = new f.Session();
    assert.throws(() => session.start(), /requires GNOME 51 Wayland/);
    session.destroy();
    session.destroy();
    assert.equal(f.surfaces.length, 0);
    assert.equal(f.timers.size, 0);
    assert.ok(f.emitters.every(emitter => emitter.handlers.size === 0));
});

test('extension enable failure rolls back signals and background actors; disable is repeatable', async () => {
    const f = await fixture();
    const extension = new f.Extension();
    f.shellGlobal.stage.context.get_backend = () => { throw new Error('startup context failure'); };
    assert.throws(() => extension.enable(), /startup context failure/);
    assert.equal(extension._session, null);
    assert.equal(f.timers.size, 0);
    assert.ok(f.emitters.every(emitter => emitter.handlers.size === 0));
    assert.equal(f.actors.length, 1);
    assert.ok(f.actors.every(actor => actor.destroyed));
    extension.disable();
    extension.disable();
});

test('Cogl context failure during hotplug tears down the session', async () => {
    const f = await fixture();
    const session = new f.Session();
    session.start();
    f.shellGlobal.stage.context.get_backend = () => { throw new Error('context failure'); };
    f.layout.emit('monitors-changed');
    assert.match(f.errors[0], /context failure/);
    assert.equal(f.timers.size, 0);
    assert.ok(f.emitters.every(emitter => emitter.handlers.size === 0));
    assert.ok(f.surfaces.every(surface => surface.destroyed));
    session.destroy();
});

test('reset failure from a suspension signal tears down the session', async () => {
    const f = await fixture();
    const session = new f.Session();
    session.start();
    f.surfaces[0].reset = () => { throw new Error('GPU clear failure'); };
    f.shield.emit('active-changed');
    assert.match(f.errors[0], /GPU clear failure/);
    assert.equal(f.timers.size, 0);
    assert.ok(f.emitters.every(emitter => emitter.handlers.size === 0));
    assert.ok(f.surfaces.every(surface => surface.destroyed));
    session.destroy();
});

test('pointer polling failure stops the timer and tears down the session', async () => {
    const f = await fixture();
    const session = new f.Session();
    session.start();
    session.tracker.get_pointer = () => { throw new Error('pointer failure'); };
    f.fire();
    assert.match(f.errors[0], /pointer failure/);
    assert.equal(f.timers.size, 0);
    assert.ok(f.emitters.every(emitter => emitter.handlers.size === 0));
    assert.ok(f.surfaces.every(surface => surface.destroyed));
    session.destroy();
});
