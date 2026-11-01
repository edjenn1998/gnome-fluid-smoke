// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import {FluidSimulation} from '../gpu/feedback.js';
import {simulationDimensions} from '../core/coordinates.js';
import {simulationParameters} from '../core/simulation.js';
import {STANDARD_PRESET} from '../core/settings.js';

const SmokeContent = GObject.registerClass({
    Implements: [Clutter.Content],
}, class SmokeContent extends GObject.Object {
    vfunc_paint_content(actor, root, _context) {
        const node = Clutter.PipelineNode.new(this.simulation.presentationPipeline(actor.get_paint_opacity()));
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
        this.lingerTime = STANDARD_PRESET['linger-time'];
        const [width, height] = simulationDimensions(monitor);
        this.simulation = new FluidSimulation(context, width, height);
    }

    initialize(parent) {
        this.simulation.initialize();
        this.content = new SmokeContent();
        this.content.simulation = this.simulation;
        this.actor = new Clutter.Actor({
            name: `fluid-smoke-${this.monitor.index}`,
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

    configure({parameters, appearance, lingerTime, background, debugView = 'normal'}) {
        this.simulation.parameters = simulationParameters(parameters);
        this.simulation.appearance = appearance;
        this.simulation.background = background;
        this.simulation.debugView = debugView;
        this.lingerTime = lingerTime;
        this.content.invalidate();
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
        if (now - this.lastMotion >= this.lingerTime) {
            this.reset();
            return;
        }
        this.simulation.step(dt, segment, now * 0.7);
        this.content.invalidate();
    }

    reset() {
        this.active = false;
        this.lastFrame = 0;
        this.simulation.clear();
        this.content.invalidate();
    }

    destroy() {
        if (this.actor) {
            this.actor.set_content(null);
            this.actor.destroy();
        }
        this.actor = null;
        if (this.content)
            this.content.simulation = null;
        this.content = null;
        this.simulation.destroy();
        this.simulation = null;
    }
}
