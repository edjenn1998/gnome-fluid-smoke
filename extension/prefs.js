// SPDX-License-Identifier: GPL-3.0-or-later
// Generated with AI for personal use. Maintainer review required before EGO submission.
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {SETTING_KEYS, applyPreset, parseColor} from './core/settings.js';

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
        const presets = new Adw.PreferencesGroup({title: 'Appearance presets',
            description: 'Apply a complete recipe, then fine-tune below. Presets replace the current visual settings.'});
        page.add(presets);
        for (const [name, title, subtitle] of [
            ['alpha6', 'Alpha.6 — original', 'The preserved alpha.6 look; also the default.'],
            ['photo', 'Reference photo — luminous rolls', 'Smooth, wider plumes with bright edges and a soft halo.'],
            ['video', 'Reference video — billowing clouds', 'Broad, longer-lived clouds with finer curled edges.'],
        ]) {
            const row = new Adw.ActionRow({title, subtitle});
            const button = new Gtk.Button({label: 'Apply', valign: Gtk.Align.CENTER});
            button.connect('clicked', () => applyPreset(settings, name));
            row.add_suffix(button);
            row.activatable_widget = button;
            presets.add(row);
        }
        const smoke = new Adw.PreferencesGroup({title: 'Smoke',
            description: 'Changes apply immediately. Existing smoke evolves into the new recipe.'});
        page.add(smoke);
        const spin = (group, key, title, subtitle, lower, upper, step, digits) => {
            const row = new Adw.SpinRow({title, subtitle, digits,
                adjustment: new Gtk.Adjustment({lower, upper, step_increment: step, page_increment: step * 5})});
            settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
        };
        spin(smoke, 'smoke-amount', 'Smoke amount',
            '0.5–3× source strength; default is 1.75×. Dense sources self-limit.', 0.5, 3, 0.05, 2);
        spin(smoke, 'linger-time', 'Linger time',
            'Seconds after movement stops. Longer also means a slower fade.', 4, 20, 1, 0);
        spin(smoke, 'source-width', 'Plume width',
            'Wider feeds create broader clouds. Alpha.6: 1×.', 0.5, 4, 0.1, 1);

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
        spin(colors, 'color-speed', 'Color cycling speed',
            'More color changes within each plume. Alpha.6: 1×. No effect on single color.', 0.2, 4, 0.1, 1);

        const fluid = new Adw.PreferencesGroup({title: 'Fluid motion',
            description: 'Shape the actual transported flow, from smooth rolls to frilled edges.'});
        page.add(fluid);
        spin(fluid, 'swirl', 'Swirl', 'Gentler curls to livelier motion. Alpha.6: 8.', 4, 12, 0.5, 1);
        spin(fluid, 'viscosity', 'Viscosity',
            'Higher values smooth the flow more. Default: 0.15.', 0.05, 0.6, 0.05, 2);
        spin(fluid, 'momentum-spread', 'Momentum spread',
            'Flow radius relative to plume width. Alpha.6: 2.5×.', 1, 4, 0.1, 1);
        spin(fluid, 'buoyancy', 'Rise',
            '0 follows stirring without upward lift. Alpha.6: 6.', 0, 18, 0.5, 1);
        spin(fluid, 'fine-detail', 'Fine curls',
            '0 favors smooth rolls; 1 emphasizes smaller frilled edges.', 0, 1, 0.05, 2);
        const lighting = new Adw.PreferencesGroup({title: 'Lighting',
            description: 'Alpha.6 uses brightness 1, no glow and no fold shading.'});
        page.add(lighting);
        spin(lighting, 'brightness', 'Brightness',
            'Light up faint wisps without adding more dye.', 0.5, 4, 0.1, 1);
        spin(lighting, 'glow', 'Glow',
            'Soft halo from nearby smoke; adds presentation sampling cost.', 0, 1, 0.05, 2);
        spin(lighting, 'fold-shading', 'Fold shading',
            'Relief lighting reveals density folds; this is a 2D effect.', 0, 1, 0.05, 2);
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
