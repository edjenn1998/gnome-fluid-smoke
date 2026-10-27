// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import {FluidSimulation} from '../gpu/feedback.js';
import {probeDimensions} from '../core/coordinates.js';

const ProbeContent = GObject.registerClass({
    Implements: [Clutter.Content],
}, class ProbeContent extends GObject.Object {
    vfunc_paint_content(actor, root, _context) {
        const node = Clutter.PipelineNode.new(this.probe.presentationPipeline(actor.get_paint_opacity()));
        node.add_rectangle(actor.get_content_box());
        root.add_child(node);
    }
});

export class MonitorSurface {
    constructor(monitor, context) {
        this.monitor = monitor;
        this.lastMotion = 0;
        this.lastFrame = 0;
        this.active = false;
        const [width, height] = probeDimensions(monitor);
        this.probe = new FluidSimulation(context, width, height);
    }

    initialize(parent) {
        this.probe.initialize();
        this.content = new ProbeContent();
        this.content.probe = this.probe;
        this.actor = new Clutter.Actor({
            name: `fluid-smoke-probe-${this.monitor.index}`,
            x: this.monitor.x,
            y: this.monitor.y,
            width: this.monitor.width,
            height: this.monitor.height,
            reactive: false,
            clip_to_allocation: true,
            content: this.content,
        });
        parent.add_child(this.actor);
    }

    update(now, segment, suspended) {
        if (suspended) {
            if (this.active)
                this.reset();
            return;
        }
        // Keep the actual sampling interval, including the 80 ms idle observer.
        // The solver bounds integration time separately from pointer speed.
        const dt = this.lastFrame ? Math.max(0, now - this.lastFrame) : 1 / 60;
        this.lastFrame = now;
        if (segment) {
            this.lastMotion = now;
            this.active = true;
        }
        if (!this.active)
            return;
        if (now - this.lastMotion >= 10) {
            this.reset();
            return;
        }
        this.probe.step(dt, segment, now * 0.7);
        this.content.invalidate();
    }

    reset() {
        this.active = false;
        this.lastFrame = 0;
        this.probe.clear();
        this.content.invalidate();
    }

    destroy() {
        this.actor?.destroy();
        this.actor = null;
        if (this.content)
            this.content.probe = null;
        this.content = null;
        this.probe.destroy();
        this.probe = null;
    }
}
