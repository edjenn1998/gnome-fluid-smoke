# Fluid Smoke

Interactive rainbow smoke wallpaper for **GNOME Shell 51 on Wayland**.
Move the pointer to stir colored smoke across a black desktop, behind applications
and desktop controls. Simulation stays inside GNOME using Cogl GPU textures;
there is no external renderer or downloaded runtime dependency.

## Version 1.0.0 — first stable release

**The user-approved alpha.7 build is now version 1.0.0.** Alpha.6 remains the
default appearance and an explicit preset. Preferences also offer reference-photo
and reference-video recipes, plus live plume width,
momentum spread, rise, fine curls, brightness, glow, fold shading and color-speed
controls. See [REFERENCE_STYLES.md](REFERENCE_STYLES.md) for the reference study,
settings, previews, preservation check and installation/rollback guide.

The fluid-simulation builds replace the original upward-drifting
trails with mouse-driven velocity, buoyancy, swirling vorticity, pressure
projection and advected rainbow dye. Density-based shading gives the color a
soft, translucent appearance against black. Alpha.2 adds higher-resolution dye,
limited MacCormack transport, explicit viscosity and narrower momentum-driven
injection. This build corrects incompatible pressure/projection stencils, keeps
24 warm-started iterations, separates dye from the wider momentum envelope, and
reduces dense source loading and optical saturation. Midpoint velocity tracing
and smoothed confinement encourage larger rolling structures. Live preferences
retain smoke amount, colors, linger time and modest swirl/viscosity adjustments.
Version 1.0.0 preserves the approved simulation and rendering unchanged.

The visuals were refined through the alpha releases and approved by the user
for version 1.0.0. Automated shader and GPU numerical checks supplement that
feedback. See [TESTING.md](TESTING.md) for validation records and remaining
hardware/performance coverage.

### Features

- Independent, bounded floating-point fluid state for each logical monitor.
- Semi-Lagrangian velocity advection, limited MacCormack dye transport, viscosity,
  buoyancy and vorticity confinement.
- Divergence calculation, 24 Jacobi pressure iterations and velocity projection.
- Smooth pointer-segment injection with capped momentum and changing RGB color.
- Live preferences for amount, colors, lingering and fluid motion.
- Black background, configurable idle clear (ten seconds by default) and simulation suspension.
- Pointer observation over applications without capturing input.
- Monitor rebuild, fullscreen, lock, Overview and reduced-motion suspension.
- Lifecycle cleanup and rollback on initialization/runtime errors.

The pressure solve is a bounded approximation, not an exact incompressibility
guarantee. Grids are capped at 384 pixels on the longest edge. Quality selection
and target-hardware performance measurements are future work.

## Download and install

Download `fluid-smoke@edjenn1998.github.io.shell-extension.zip` from the
[v1.0.0 stable release](https://github.com/edjenn1998/gnome-fluid-smoke/releases/tag/v1.0.0).
The release also includes `SHA256SUMS` to verify the extension ZIP.
The [alpha.7 release](https://github.com/edjenn1998/gnome-fluid-smoke/releases/tag/v0.2.0-alpha.7)
retains `fluid-smoke-alpha7-previews.zip` and the separate original alpha.6
rollback ZIP. Extract the previews archive and open `reference-previews/index.html`
to see the reference-inspired looks.
The [original alpha.6 release](https://github.com/edjenn1998/gnome-fluid-smoke/releases/tag/v0.2.0-alpha.6)
and its comparison archive remain available.
The extension ZIP is available locally in `dist/` after `python3 tools/package.py`.
See [FLUID_QUALITY.md](FLUID_QUALITY.md) for the investigation, controlled preview
comparisons and native diagnostic instructions.

For an existing installation, first disable it:

```sh
gnome-extensions disable fluid-smoke@edjenn1998.github.io
```

From the directory containing the downloaded ZIP:

```sh
gnome-extensions install --force fluid-smoke@edjenn1998.github.io.shell-extension.zip
```

**Log out and back in.** This reloads extension JavaScript in a fresh Shell
process on Wayland. Save your work before logging out. Then:

```sh
gnome-extensions enable fluid-smoke@edjenn1998.github.io
gnome-extensions info fluid-smoke@edjenn1998.github.io
```

Expect version `1.0.0` / numeric version `10` for this build. GNOME 51 / Wayland is the
only target; development began for CachyOS GNOME 51.1. Matching GNOME Shell/Mutter
packages and a driver supporting renderable/filterable RGBA16F textures supply
the runtime dependencies.

### What to try

Move the mouse in circles, then stop. Look for curls, rising wisps and dispersal
rather than a line tracing the cursor. Try slow and fast motion. Move over
Firefox, then move/minimize it to reveal smoke generated underneath. After ten
seconds without motion the desktop should be exactly black and simulation should
stop. Disabling should restore your wallpaper immediately.

## Build from source

Build requirements: Python 3 and `glib-compile-schemas` (GLib tools).
Isolated tests: Node.js 22+.

```sh
git clone https://github.com/edjenn1998/gnome-fluid-smoke.git
cd gnome-fluid-smoke
npm test
python3 tools/package.py
python3 -m zipfile -t dist/fluid-smoke@edjenn1998.github.io.shell-extension.zip
```

Install the ZIP in `dist/` as described above. The package builder uses a fixed
file allowlist and deterministic timestamps, and includes the compiled GSettings schema.

Optional developer checks (not extension dependencies):

```sh
# Requires glslangValidator (glslang package on Arch/CachyOS)
npm run test:shaders
# Requires EGL/GLES3 libraries and a usable offscreen driver
npm run test:gpu
```

## Configuration and performance

Open the extension's settings in the Extensions app, or run:

```sh
gnome-extensions prefs fluid-smoke@edjenn1998.github.io
```

Changes apply immediately and persist across sessions:

| Setting | Range / choices | Default |
| --- | --- | --- |
| Smoke amount | 0.5–3× source strength (dense sources self-limit) | 1.75× |
| Color mode | Rainbow, single custom color, two-color blend | Rainbow |
| Primary / second color | Color pickers; enabled for relevant modes | Blue / pink |
| Linger time | 4–20 seconds; adjusts fade rate and idle clear together | 10 seconds |
| Swirl | 4–10; gentle to livelier curls | 8 (alpha.2) |
| Viscosity | 0.05–0.60; higher smooths flow more | 0.15 (alpha.2) |

Reset to defaults restores the visual preferences. Existing values survive an
upgrade; source strength now uses the alpha.6 density-aware emission model.
New colors affect newly emitted smoke; existing smoke fades naturally.
Disable/re-enable to pause and clear.
GNOME reduced motion stops animation. Fullscreen monitors suspend; lock and
Overview suspend the session. Display changes reset all fields.

Logical coordinates handle negative origins and mixed scaling. Monitor transitions
reset the pointer segment. Hardware validation of all layouts remains pending.

Active work targets 17 ms, accounting for submission time, and falls back to 33 ms
after sustained callback/submission overload. Idle pointer checks use 80 ms.
These are timer targets, not measured FPS or GPU timings. Each simulation substep
uses 32 GPU draws, with at most two substeps after a stall. Dye has twice the flow
grid's width/height, up to 768 pixels on its long edge. Textures are reused;
there is no production CPU readback. Explicit display-power handling, adaptive
quality and long-run profiling remain future work.

## Troubleshooting

```sh
gnome-extensions info fluid-smoke@edjenn1998.github.io
journalctl --user -b -o cat /usr/bin/gnome-shell
# If your distribution uses the system journal instead:
journalctl -b _COMM=gnome-shell -o cat
```

- **Old version after updating:** complete logout/login, then check version.
- **Black desktop without smoke:** check extension state, reduced motion,
  fullscreen and logs. Report any Cogl/shader/GJS error.
- **Wallpaper covers smoke:** report wallpaper reload timing and other wallpaper
  extensions; integration uses GNOME's private background group.
- **Slow desktop:** disable and report GPU/driver, monitor sizes/scales and whether
  it occurred during pointer motion or after idle.

A short recording is useful for visual feedback. The extension does not log
coordinates; review unrelated journal output before sharing it.

## Disable and uninstall

```sh
gnome-extensions disable fluid-smoke@edjenn1998.github.io
gnome-extensions uninstall fluid-smoke@edjenn1998.github.io
```

No wallpaper setting is modified. No services, helper binaries or persistent
pointer records are installed.

## Development, privacy and license

See [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md),
[TESTING.md](TESTING.md) and [CHANGELOG.md](CHANGELOG.md).

All original code is **GPL-3.0-or-later**; see [LICENSE](LICENSE). No warranty.
Runtime is local: no network, telemetry, keystroke/clipboard access, coordinate
logging or saved movement history. Only the previous pointer sample is retained
transiently to connect movement.

AI-generated personal-use notices are included. This is not an official GNOME
project or an extensions.gnome.org submission. EGO publication requires maintainer
understanding and review of the JavaScript.

Thanks to GNOME Shell/Mutter and GJS documentation contributors. Hanabi and
ShaderPaper were architectural references; no code/assets were copied. Sources
and attribution are recorded in `ARCHITECTURE.md`.
