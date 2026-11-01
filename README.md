# Fluid Smoke

Interactive smoke wallpaper for **GNOME Shell 51 on Wayland**. Move the pointer
to stir colored clouds behind your windows. Smoke can appear over your wallpaper
or a solid background color.

https://github.com/user-attachments/assets/0c146518-fa6c-4e6b-994d-b53b2beba1fd

<img width="1920" height="1080" alt="Fluid Smoke on the desktop" src="https://github.com/user-attachments/assets/7fcc9d2c-648c-4ac3-be42-26946d4da609" />

The simulation runs in Cogl textures inside GNOME Shell. Each logical monitor has
its own fluid state. The effect observes pointer movement without capturing input
or creating an application window.

## Install

Download `fluid-smoke@edjenn1998.github.io.shell-extension.zip` and `SHA256SUMS`
from the [latest release](https://github.com/edjenn1998/gnome-fluid-smoke/releases/latest).
In the download directory, run:

```sh
sha256sum --check SHA256SUMS
gnome-extensions install --force fluid-smoke@edjenn1998.github.io.shell-extension.zip
```

Log out and back in after installing or updating, then enable the extension:

```sh
gnome-extensions enable fluid-smoke@edjenn1998.github.io
```

## Appearance and settings

Open preferences from the Extensions app or run:

```sh
gnome-extensions prefs fluid-smoke@edjenn1998.github.io
```

**Luminous Rolls & Billowing Clouds** is the standard appearance: broad clouds,
fine curls, bright folds and a soft glow. **Less Smoke** keeps the former Alpha.6
look, with narrower plumes, a shorter fade and no glow. The separate **Luminous
Rolls** and **Billowing Clouds** presets are also available.

Every numeric smoke control is an adjustment from the standard:

- **0** leaves that setting at its standard value.
- A **negative** value reduces it; a **positive** value increases it.
- Linger time is adjusted in seconds; the other controls use their existing
  simulation or lighting units.

For example, linger time **−4** means 14 seconds rather than the standard 18.
Smoke amount **+0.25** raises source strength from 1.75 to 2.0. Glow **−0.4** removes
the standard halo. The reference point stays fixed when you apply a different
preset, so its differences are visible in the controls.

| Control | Standard value | Effect |
| --- | ---: | --- |
| Smoke amount | 1.75 | Source strength |
| Linger time | 18 seconds | Fade duration and idle clear |
| Plume width | 2.8 | Width of new smoke |
| Swirl | 11 | Curl strength |
| Viscosity | 0.15 | Flow smoothing |
| Momentum spread | 1.8 | Stirred area relative to plume width |
| Rise | 1.5 | Upward lift |
| Fine curls | 0.85 | Detail along cloud edges |
| Brightness | 2.4 | Exposure of visible smoke |
| Glow | 0.4 | Halo strength |
| Fold shading | 0.65 | Lighting on density folds |
| Color cycling speed | 2.5 | Rate of color changes |

Colors can cycle through the rainbow, use one color, or blend between two colors.
The background defaults to solid black. Choosing **Keep wallpaper** reveals your
current desktop wallpaper; the extension never changes GNOME's wallpaper setting.

Preferences apply immediately and persist across sessions. Saved custom values
survive updates. Apply the standard preset to adopt the new smoke defaults while
keeping your background, or use **Reset to standard** to reset both smoke and
background preferences. See [REFERENCE_STYLES.md](REFERENCE_STYLES.md) for recipes.

## Motion and performance

Smoke keeps moving after the pointer stops, then clears after the configured
linger time. Fullscreen pauses the affected monitor. Lock, Overview and reduced
motion pause the session. Monitor-layout changes recreate the simulation grids.

The flow grid is capped at 384 pixels on its longest edge; dye uses twice that
resolution. Each substep takes 32 GPU draws, including 24 pressure iterations.
Catch-up is limited to two substeps. The timer targets 17 ms while active and
falls back to 33 ms after sustained overload; idle pointer checks use 80 ms.
These are scheduling intervals, not measured frame rates.

## Build and check

Required: Python 3, `glib-compile-schemas`, and Node.js 22+ for tests.

```sh
npm test
npm run build
```

The installable ZIP and checksum are written to `dist/`. The package contains only
runtime files, schema XML and the license. GNOME compiles the schema on installation.

Optional graphics checks:

```sh
npm run test:shaders  # glslangValidator
npm run test:gpu      # EGL, GLES3 and an offscreen driver
```

See [TESTING.md](TESTING.md) for desktop checks and preview commands,
[ARCHITECTURE.md](ARCHITECTURE.md) for the renderer, and
[ROADMAP.md](ROADMAP.md) for remaining work.

## Troubleshooting

```sh
gnome-extensions info fluid-smoke@edjenn1998.github.io
journalctl --user -b -o cat /usr/bin/gnome-shell
```

If an update still shows old behavior, log out and back in to reload the JavaScript.
If smoke is absent, check reduced motion, fullscreen state and the Shell journal.
For rendering or performance reports, include the GNOME version, GPU/driver,
monitor sizes/scales and the settings used. A short recording helps.

To remove the extension:

```sh
gnome-extensions disable fluid-smoke@edjenn1998.github.io
gnome-extensions uninstall fluid-smoke@edjenn1998.github.io
```

## License

[GPL-3.0-or-later](LICENSE). The extension has no network access, telemetry or
saved pointer history. See [CHANGELOG.md](CHANGELOG.md) for release history.
