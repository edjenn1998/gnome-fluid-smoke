// SPDX-License-Identifier: GPL-3.0-or-later

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {ProbeSession} from './shell/session.js';

export default class FluidSmoke extends Extension {
    enable() {
        this._session = new ProbeSession({settings: this.getSettings()});
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
