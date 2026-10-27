// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {locateMonitor, movementSegment} from '../core/coordinates.js';
import {MonitorSurface} from './surface.js';

export class ProbeSession {
    constructor() {
        this.signals = [];
        this.surfaces = [];
        this.source = 0;
        this.previous = null;
    }

    start() {
        // GNOME 51 exposes the compositor through the Shell-owned Meta.Context.
        if (global.context.get_wayland_compositor() === null)
            throw new Error('Fluid Smoke requires GNOME 51 Wayland');
        this.tracker = global.backend.get_cursor_tracker();
        this.stSettings = St.Settings.get();
        // Isolated private Shell dependency: the real desktop background group.
        const backgrounds = Main.layoutManager._backgroundGroup;
        this.group = new Clutter.Actor({name: 'fluid-smoke-probe', reactive: false});
        backgrounds.add_child(this.group);
        this.watch(backgrounds, 'child-added', () => {
            // Wallpaper reloads must not cover this extension-managed backdrop.
            backgrounds.set_child_above_sibling(this.group, null);
        });
        this.watch(Main.layoutManager, 'monitors-changed', () => this.rebuild());
        this.watch(global.display, 'in-fullscreen-changed', () => this.refresh());
        this.watch(Main.overview, 'showing', () => this.refresh());
        this.watch(Main.overview, 'hidden', () => this.refresh());
        this.watch(this.stSettings, 'notify::reduced-motion', () => this.refresh());
        this.watch(Main.screenShield, 'active-changed', () => this.refresh());
        this.rebuild();
    }

    watch(object, signal, callback) {
        this.signals.push([object, object.connect(signal, () => {
            try {
                callback();
            } catch (error) {
                this.stopAfterError(error);
            }
        })]);
    }

    stopAfterError(error) {
        console.error(`Fluid Smoke stopped: ${error.stack ?? error.message}`);
        this.destroy();
    }

    schedule(interval) {
        if (this.source)
            GLib.Source.remove(this.source);
        this.source = 0;
        if (!interval)
            return;
        this.source = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            this.source = 0;
            try {
                this.tick();
            } catch (error) {
                // A failed GPU/GI probe must stop, not throw on every timer tick.
                this.stopAfterError(error);
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    refresh() {
        this.schedule(0);
        this.previous = null;
        for (const surface of this.surfaces)
            surface.reset();
        const paused = Main.screenShield.active || Main.overview.visible ||
            this.stSettings.reducedMotion === St.ReducedMotion.REDUCE;
        if (!paused)
            this.schedule(80);
    }

    rebuild() {
        this.schedule(0);
        for (const surface of this.surfaces)
            surface.destroy();
        this.surfaces = [];
        this.previous = null;
        try {
            const context = global.stage.context.get_backend().get_cogl_context();
            for (const monitor of Main.layoutManager.monitors) {
                const surface = new MonitorSurface(monitor, context);
                this.surfaces.push(surface);
                surface.initialize(this.group);
            }
            this.refresh();
        } catch (error) {
            this.destroy();
            throw error;
        }
    }

    tick() {
        const [point] = this.tracker.get_pointer();
        const monitors = this.surfaces.map(surface => surface.monitor);
        const monitor = locateMonitor(monitors, point.x, point.y);
        const current = {x: point.x, y: point.y, monitor};
        const segment = monitor < 0 ? null : movementSegment(this.previous, current, monitors[monitor]);
        this.previous = current;
        const now = GLib.get_monotonic_time() / 1e6;
        for (let i = 0; i < this.surfaces.length; i++) {
            const surface = this.surfaces[i];
            surface.update(now, i === monitor ? segment : null,
                global.display.get_monitor_in_fullscreen(surface.monitor.index));
        }
        this.schedule(this.surfaces.some(surface => surface.active) ? 17 : 80);
    }

    destroy() {
        this.schedule(0);
        for (const [object, id] of this.signals)
            object.disconnect(id);
        this.signals = [];
        for (const surface of this.surfaces)
            surface.destroy();
        this.surfaces = [];
        this.group?.destroy();
        this.group = null;
        this.tracker = null;
        this.stSettings = null;
        this.previous = null;
    }
}
