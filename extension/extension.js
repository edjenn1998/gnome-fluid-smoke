// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {ProbeSession} from './shell/session.js';

export default class FluidSmoke extends Extension {
    enable() {
        this._session = new ProbeSession();
        try {
            this._session.start();
        } catch (error) {
            // Roll back partial allocation if a target API or GPU format fails.
            this._session.destroy();
            this._session = null;
            throw error;
        }
    }

    disable() {
        this._session?.destroy();
        this._session = null;
    }
}
