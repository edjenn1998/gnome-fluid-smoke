# Testing

## 1.2.0 — 2026-11-01

- 29 JavaScript tests pass, including the new set-point controls and preset changes.
- All 11 GLSL 1.20 shaders compile.
- Offscreen RGBA16F checks pass on llvmpipe (LLVM 21.1.8), including the combined
  lighting settings, post-input transport, fade and background composition.
- The rebuilt extension ZIP passes Shexli with zero findings, errors or warnings.
- Standard and Less Smoke fast-circle previews were generated and inspected at
  input stop and +1/+2/+3 seconds. Files are in `dist/standard-previews/`.

Native preferences and the new standard still need the GNOME desktop checks below.

## Automated checks

```sh
npm test
npm run build
npm run test:shaders
npm run test:gpu
```

The JavaScript tests cover coordinate mapping, bounded timesteps, pass ordering,
read/write separation, partial-allocation cleanup, session suspension, hotplug,
settings conversion and preset restoration. Preferences tests exercise signed
adjustments, external settings changes, reset and signal cleanup with GTK doubles.

`test:shaders` requires `glslangValidator` and compiles all 11 shaders with a
Cogl-style GLSL 1.20 interface. A path can be supplied directly:

```sh
node tools/validate_shaders.js /path/to/glslangValidator
```

`test:gpu` requires EGL, GLES3 and a surfaceless driver. It runs the actual shader
bodies against RGBA16F targets, checking pressure projection, wall boundaries,
viscosity, fade rates, continued transport after input stops, bounded lighting,
wallpaper transparency and solid-background composition. It uses Python's standard
library and Node.js.

These tests do not run GJS, native GTK preferences or Clutter/Cogl presentation.
Use the desktop checks below for those paths.

## Package review

The builder strictly validates the schema, checks archive contents and integrity,
and writes `dist/SHA256SUMS`. It excludes compiled schemas, tests, previews and tools.

Run Shexli against the packaged files:

```sh
shexli dist/fluid-smoke@edjenn1998.github.io.shell-extension.zip
```

Schema defaults, the standard preset and solver defaults must agree. Existing
absolute settings must retain their meaning when displayed as adjustments.

## GNOME 51 Wayland checks

Install the local ZIP following the README, then log out and back in. Record the
Shell version, GPU/driver and monitor layout. Watch the Shell journal during tests.

### Preferences and appearance

- Open preferences without changing anything; saved custom settings stay intact.
- Apply **Luminous Rolls & Billowing Clouds — standard**; all numeric controls show zero.
- Adjust each control below and above zero. Check the expected reduction/increase.
- Apply **Less Smoke**; check the narrower plume and shorter fade. Its adjustments
  remain relative to the standard, including linger −8 and width −1.8.
- Try rainbow, single-color and two-color modes, including both color pickers.
- Change background mode and color while idle. Smoke presets keep that background.
- **Reset to standard** restores zero adjustments and solid black.
- Close/reopen preferences and log out/in to verify persistence.
- Use slow/fast strokes, circles and reversals. Smoke should keep deforming after
  input stops, then clear after the configured linger time (18 seconds at standard).

### Desktop integration

- Move the pointer over windows, then move/minimize them to reveal the smoke below.
- Click, type, drag and resize normally. Panels, icons and menus remain above smoke.
- Check independent state on multiple monitors, negative origins and mixed scaling.
- Cross monitor boundaries and warp the pointer; neither should draw a connecting streak.
- Hotplug a monitor or change scale/resolution; the state resets cleanly.
- Exercise fullscreen, Overview, lock, reduced motion and suspend/resume.
- Toggle the extension twenty times; check restoration, journal errors and memory
  after allowing time for garbage collection.
- Check responsiveness during extended activity and that GPU simulation stops after fade.

Explicit display-power suspension outside screen-shield paths remains on the roadmap.

```sh
gnome-shell --version
gnome-extensions info fluid-smoke@edjenn1998.github.io
journalctl --user -b -o cat /usr/bin/gnome-shell
ps -C gnome-shell -o pid,%cpu,rss,etime,args
```

## Renderer diagnostics

Set the schema directory for the installed copy:

```sh
export GSETTINGS_SCHEMA_DIR="$HOME/.local/share/gnome-shell/extensions/fluid-smoke@edjenn1998.github.io/schemas"
gsettings set org.gnome.shell.extensions.fluid-smoke debug-view 'velocity'
```

Move the pointer to wake the simulation. Available views:

| Value | Display |
| --- | --- |
| `normal` | Smoke over the selected background |
| `velocity` | Red: positive x; green: negative x; blue: absolute y velocity |
| `curl` | Orange/blue for opposite curl signs |
| `density` | Dye density in grayscale |
| `divergence` | Before projection on the left, after projection on the right |
| `layers` | Red, green and blue bands from distinct signed float textures |

Return to `normal` after testing. Field views add two draws and a scratch target;
the layer view adds three 1×1 targets. The normal pass graph is unchanged.

Looking Glass can inspect planner diagnostics while a debug view is active:

```js
Main.extensionManager.lookup('fluid-smoke@edjenn1998.github.io').stateObj._session.surfaces.map(s => s.simulation.diagnostics)
```

## Previous measurements

The 1.1.1 build passed 26 JavaScript tests, 11 shader compilation checks and
offscreen numerical/compositing tests. Earlier shader validation used both Radeon
8060S/radeonsi and llvmpipe. These are offscreen results, not GNOME frame-rate measurements.
The pressure-operator investigation and its measurements are in
[FLUID_QUALITY.md](FLUID_QUALITY.md); release history is in [CHANGELOG.md](CHANGELOG.md).
