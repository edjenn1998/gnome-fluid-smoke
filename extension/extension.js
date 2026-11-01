// SPDX-License-Identifier: GPL-3.0-or-later

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {SmokeSession} from './shell/session.js';

export default class FluidSmoke extends Extension {
    enable() {
        this._session = new SmokeSession(this.getSettings());
        try {
            this._session.start();
        } catch (error) {
            this._session.destroy();
            this._session = null;
            throw error;
        }
    }

    disable() {
        if (this._session)
            this._session.destroy();
        this._session = null;
    }
}
