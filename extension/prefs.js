// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {SETTING_KEYS, STANDARD_PRESET, applyPreset, parseColor} from './core/settings.js';

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
            description: 'Applying a preset replaces the smoke settings and colors. Your background is kept.'});
        page.add(presets);
        for (const [name, title, subtitle] of [
            ['standard', 'Luminous Rolls & Billowing Clouds — standard', 'Broad, curling clouds with bright folds and a soft glow.'],
            ['less-smoke', 'Less Smoke', 'Narrower, shorter-lived plumes with softer lighting.'],
            ['luminous', 'Luminous Rolls', 'Smoother plumes with bright edges and a soft halo.'],
            ['billowing', 'Billowing Clouds', 'Wide, slow-fading clouds with finely curled edges.'],
        ]) {
            const row = new Adw.ActionRow({title, subtitle});
            const button = new Gtk.Button({label: 'Apply', valign: Gtk.Align.CENTER});
            button.connect('clicked', () => applyPreset(settings, name));
            row.add_suffix(button);
            row.activatable_widget = button;
            presets.add(row);
        }
        const smoke = new Adw.PreferencesGroup({title: 'Smoke',
            description: 'All numeric controls adjust the standard appearance: 0 is the set point. Negative values reduce a setting; positive values increase it. Changes apply immediately.'});
        page.add(smoke);
        const spin = (group, key, title, subtitle, lower, upper, step, digits) => {
            const baseline = STANDARD_PRESET[key];
            const row = new Adw.SpinRow({title, subtitle, digits,
                adjustment: new Gtk.Adjustment({lower: lower - baseline, upper: upper - baseline,
                    step_increment: step, page_increment: step * 5})});
            let updating = false;
            watch(key, () => {
                updating = true;
                row.value = settings.get_double(key) - baseline;
                updating = false;
            });
            row.connect('notify::value', () => {
                if (updating)
                    return;
                const value = Number((baseline + row.value).toFixed(digits));
                settings.set_double(key, Math.max(lower, Math.min(upper, value)));
            });
            group.add(row);
        };
        spin(smoke, 'smoke-amount', 'Smoke amount',
            'Reduce or increase the source strength.', 0.5, 3, 0.05, 2);
        spin(smoke, 'linger-time', 'Linger time',
            'Seconds shorter or longer than the standard 18-second fade.', 4, 20, 1, 0);
        spin(smoke, 'source-width', 'Plume width',
            'Narrower trails or broader clouds.', 0.5, 4, 0.1, 1);

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
        const colorRow = (group, key, title, modeKey, enabled, fallback) => {
            const row = new Adw.ActionRow({title});
            const button = new Gtk.ColorDialogButton({dialog: new Gtk.ColorDialog({with_alpha: false}),
                valign: Gtk.Align.CENTER});
            row.add_suffix(button);
            row.activatable_widget = button;
            group.add(row);
            let updating = false;
            watch(key, () => {
                const [red, green, blue] = parseColor(settings.get_string(key),
                    fallback);
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
            watch(modeKey, () => { row.sensitive = enabled(settings.get_string(modeKey)); });
        };
        colorRow(colors, 'primary-color', 'Primary color', 'color-mode', value => value !== 'rainbow', '#66ccff');
        colorRow(colors, 'secondary-color', 'Second color', 'color-mode', value => value === 'gradient', '#ff66cc');
        spin(colors, 'color-speed', 'Color cycling speed',
            'Slower or faster color changes. Has no effect in single-color mode.', 0.2, 4, 0.1, 1);

        const background = new Adw.PreferencesGroup({title: 'Background',
            description: 'Show smoke over your current wallpaper or a custom solid color. Changes apply immediately.'});
        page.add(background);
        const backgrounds = ['wallpaper', 'solid'];
        const backgroundMode = new Adw.ComboRow({title: 'Background mode',
            model: Gtk.StringList.new(['Keep wallpaper', 'Solid color'])});
        background.add(backgroundMode);
        watch('background-mode', () => {
            backgroundMode.selected = backgrounds.indexOf(settings.get_string('background-mode'));
        });
        backgroundMode.connect('notify::selected', () => {
            if (backgrounds[backgroundMode.selected])
                settings.set_string('background-mode', backgrounds[backgroundMode.selected]);
        });
        colorRow(background, 'background-color', 'Background color', 'background-mode',
            value => value === 'solid', '#000000');

        const fluid = new Adw.PreferencesGroup({title: 'Fluid motion',
            description: 'Adjust how the clouds roll and rise.'});
        page.add(fluid);
        spin(fluid, 'swirl', 'Swirl', 'Gentler or stronger curls.', 4, 12, 0.5, 1);
        spin(fluid, 'viscosity', 'Viscosity',
            'Lower values keep sharper detail; higher values smooth the flow.', 0.05, 0.6, 0.05, 2);
        spin(fluid, 'momentum-spread', 'Momentum spread',
            'Narrow or widen the area stirred around each plume.', 1, 4, 0.1, 1);
        spin(fluid, 'buoyancy', 'Rise',
            'Reduce or increase upward lift. −1.5 removes lift entirely.', 0, 18, 0.5, 1);
        spin(fluid, 'fine-detail', 'Fine curls',
            'Smoother edges or finer, frilled curls.', 0, 1, 0.05, 2);
        const lighting = new Adw.PreferencesGroup({title: 'Lighting',
            description: 'Adjust the brightness, halo and shading of the smoke.'});
        page.add(lighting);
        spin(lighting, 'brightness', 'Brightness',
            'Dim the smoke or brighten faint wisps.', 0.5, 4, 0.1, 1);
        spin(lighting, 'glow', 'Glow',
            'Reduce or increase the soft halo around the clouds.', 0, 1, 0.05, 2);
        spin(lighting, 'fold-shading', 'Fold shading',
            'Flatten or strengthen the lighting on smoke folds.', 0, 1, 0.05, 2);
        const resetGroup = new Adw.PreferencesGroup();
        const reset = new Gtk.Button({label: 'Reset to standard', halign: Gtk.Align.CENTER,
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
