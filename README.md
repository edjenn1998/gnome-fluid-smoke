# Fluid Smoke

Interactive rainbow smoke wallpaper for **GNOME Shell 51 on Wayland**.
Move the pointer to stir colored smoke across a black desktop, behind applications
and desktop controls. Simulation stays inside GNOME using Cogl GPU textures;
there is no external renderer or downloaded runtime dependency.

## Status: 0.2.0-alpha.1

This first fluid-simulation prerelease replaces the original upward-drifting
trails with mouse-driven velocity, buoyancy, swirling vorticity, pressure
projection and advected rainbow dye. Density-based shading gives the color a
soft, translucent appearance against black.

The user tested `0.1.0-poc.2` and reported working visuals that looked cool but
did not resemble smoke. The new shaders passed offscreen software-rendered
numerical checks. **This alpha's appearance, multi-texture Cogl integration and
performance still need GNOME laptop testing.** See [TESTING.md](TESTING.md).

### Features

- Independent, bounded floating-point fluid state for each logical monitor.
- Semi-Lagrangian velocity/dye advection, buoyancy and vorticity confinement.
- Divergence calculation, 24 Jacobi pressure iterations and velocity projection.
- Smooth pointer-segment injection with capped momentum and changing RGB color.
- Black background, ten-second idle clear and simulation suspension.
- Pointer observation over applications without capturing input.
- Monitor rebuild, fullscreen, lock, Overview and reduced-motion suspension.
- Lifecycle cleanup and rollback on initialization/runtime errors.

The pressure solve is a bounded approximation, not an exact incompressibility
guarantee. Grids are capped at 384 pixels on the longest edge. Preferences,
quality selection and target-hardware performance measurements are future work.

## Download and install

Download `fluid-smoke@edjenn1998.github.io.shell-extension.zip` from
[v0.2.0-alpha.1 on GitHub](https://github.com/edjenn1998/gnome-fluid-smoke/releases/tag/v0.2.0-alpha.1).

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

Expect version `0.2.0-alpha.1` or numeric version `3`. GNOME 51 / Wayland is the
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

Build requirements: Python 3. Isolated tests: Node.js 22+.

```sh
git clone https://github.com/edjenn1998/gnome-fluid-smoke.git
cd gnome-fluid-smoke
npm test
python3 tools/package.py
python3 -m zipfile -t dist/fluid-smoke@edjenn1998.github.io.shell-extension.zip
```

Install the ZIP in `dist/` as described above. The source-only package builder
uses a fixed file allowlist and deterministic timestamps.

Optional developer checks (not extension dependencies):

```sh
# Requires glslangValidator (glslang package on Arch/CachyOS)
npm run test:shaders
# Requires EGL/GLES3 libraries and a usable offscreen driver
npm run test:gpu
```

## Configuration and performance

There is no preferences window yet. Disable/re-enable to pause and clear.
GNOME reduced motion stops animation. Fullscreen monitors suspend; lock and
Overview suspend the session. Display changes reset all fields.

Logical coordinates handle negative origins and mixed scaling. Monitor transitions
reset the pointer segment. Hardware validation of all layouts remains pending.

Active work is requested approximately every 17 ms; idle pointer checks use
80 ms. These are timer intervals, not measured FPS. Each simulation substep uses
30 GPU draws, with at most two substeps after a stall. Textures are reused;
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
