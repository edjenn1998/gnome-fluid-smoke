// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use. Maintainer review required before EGO submission.
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {SETTING_KEYS, parseColor} from './core/settings.js';

export default class FluidSmokePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const signals = [];
        const watch = (key, callback) => {
            signals.push(settings.connect(`changed::${key}`, callback));
            callback();
        };
        window.set_default_size(620, 720);
        const page = new Adw.PreferencesPage({title: 'Fluid Smoke', icon_name: 'applications-graphics-symbolic'});
        window.add(page);
        const smoke = new Adw.PreferencesGroup({title: 'Smoke',
            description: 'Alpha.2 fluid motion with more smoke. Changes apply immediately.'});
        page.add(smoke);
        const spin = (group, key, title, subtitle, lower, upper, step, digits) => {
            const row = new Adw.SpinRow({title, subtitle, digits,
                adjustment: new Gtk.Adjustment({lower, upper, step_increment: step, page_increment: step * 5})});
            settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
        };
        spin(smoke, 'smoke-amount', 'Smoke amount',
            '0.5–3× emission. 1× matches alpha.2; default is 1.75×.', 0.5, 3, 0.05, 2);
        spin(smoke, 'linger-time', 'Linger time',
            'Seconds after movement stops. Longer also means a slower fade.', 4, 20, 1, 0);

        const colors = new Adw.PreferencesGroup({title: 'Colors'});
        page.add(colors);
        const modes = ['rainbow', 'solid', 'gradient'];
        const mode = new Adw.ComboRow({title: 'Color mode',
            model: Gtk.StringList.new(['Rainbow', 'Single color', 'Two-color blend'])});
        colors.add(mode);
        watch('color-mode', () => { mode.selected = modes.indexOf(settings.get_string('color-mode')); });
        mode.connect('notify::selected', () => {
            if (modes[mode.selected])
                settings.set_string('color-mode', modes[mode.selected]);
        });
        const colorRow = (key, title, enabled) => {
            const row = new Adw.ActionRow({title});
            const button = new Gtk.ColorDialogButton({dialog: new Gtk.ColorDialog({with_alpha: false}),
                valign: Gtk.Align.CENTER});
            row.add_suffix(button);
            row.activatable_widget = button;
            colors.add(row);
            let updating = false;
            watch(key, () => {
                const [red, green, blue] = parseColor(settings.get_string(key),
                    key === 'secondary-color' ? '#ff66cc' : '#66ccff');
                updating = true;
                button.rgba = new Gdk.RGBA({red, green, blue, alpha: 1});
                updating = false;
            });
            button.connect('notify::rgba', () => {
                if (updating)
                    return;
                const rgba = button.rgba;
                const hex = [rgba.red, rgba.green, rgba.blue].map(value =>
                    Math.round(value * 255).toString(16).padStart(2, '0')).join('');
                settings.set_string(key, `#${hex}`);
            });
            watch('color-mode', () => { row.sensitive = enabled(settings.get_string('color-mode')); });
        };
        colorRow('primary-color', 'Primary color', value => value !== 'rainbow');
        colorRow('secondary-color', 'Second color', value => value === 'gradient');

        const fluid = new Adw.PreferencesGroup({title: 'Fluid motion',
            description: 'Small adjustments around the alpha.2 physics defaults.'});
        page.add(fluid);
        spin(fluid, 'swirl', 'Swirl', 'Gentler curls to livelier motion. Default: 8.', 4, 10, 0.5, 1);
        spin(fluid, 'viscosity', 'Viscosity',
            'Higher values smooth the flow more. Default: 0.15.', 0.05, 0.6, 0.05, 2);
        const resetGroup = new Adw.PreferencesGroup();
        const reset = new Gtk.Button({label: 'Reset to defaults', halign: Gtk.Align.CENTER,
            css_classes: ['pill']});
        reset.connect('clicked', () => {
            for (const key of SETTING_KEYS)
                settings.reset(key);
        });
        resetGroup.add(reset);
        page.add(resetGroup);
        window.connect('close-request', () => {
            for (const id of signals)
                settings.disconnect(id);
            signals.length = 0;
            return false;
        });
    }
}
