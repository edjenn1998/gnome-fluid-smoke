# Reference styles: preserved alpha.6 and adjustable presets

Alpha.6 is the default and an explicit **Alpha.6 — original** preset. The new
reference presets are adjustable starting points, not a verified reproduction.
Introduced in alpha.7 and promoted unchanged to stable version 1.0.0 (numeric
version 10) following user approval.

## What was studied

* `testphotos/what it should look like.png`: a thin trailing feed entering a broad
  rolled head, luminous green/cyan rim, pink core, smooth internal folds and dim
  residual smoke against black.
* `Testvideo/reference video of Liquid Smoke - Fluid Simulation.mp4`: 720×1280,
  about 30 fps, 14.999 seconds. Decoded frames at 0, .267, .5, .767, 1, 2, 4, 6,
  8, 10, 12 and 14 seconds. The subsecond sequence shows the head advancing and
  spreading; later frames show broad, frilled clouds, moving curls, bright new
  cores, mixed-color older clouds and dim surrounding haze. The existing contact
  sheet was also inspected, separately from the decoded video frames.

These suggest independent controls for source footprint, the wider driven flow,
fine versus smooth confinement, lift, persistence and lighting. Increasing only
smoke amount would concentrate more dye without providing those controls.

## Preferences

Open `gnome-extensions prefs fluid-smoke@edjenn1998.github.io`. Apply a preset at
the top, then adjust the controls below. Preset application replaces all visual
settings, including colors. Changes affect existing smoke immediately; wait for
idle clear before comparing fresh strokes. Existing installations retain saved
settings until explicitly changed. Reset to defaults restores the alpha.6 recipe.

| Control | Alpha.6 | Reference photo | Reference video |
| --- | ---: | ---: | ---: |
| Smoke amount | 1.75 | 1.75 | 1.75 |
| Linger time, seconds | 10 | 14 | 18 |
| Plume width | 1 | 1.8 | 2.8 |
| Momentum spread / dye radius | 2.5 | 2.2 | 1.8 |
| Rise | 6 | 1.5 | 0 |
| Swirl | 8 | 8 | 11 |
| Viscosity | .15 | .15 | .05 |
| Fine curls | 0 | .2 | .85 |
| Brightness | 1 | 2.4 | 2.1 |
| Glow | 0 | .4 | .25 |
| Fold shading | 0 | .35 | .65 |
| Color cycling speed | 1 | 1.6 | 2.5 |

All presets start in rainbow mode; solid and two-color modes still work.

* **Photo:** start with a sweep or a slow arc, then stop. For a broader head,
  increase plume width. Reduce fine curls for cleaner smooth rims. Increase
  brightness before increasing smoke amount if faint wisps are hard to see.
* **Video:** stir with several broad strokes, change direction and stop. Fine
  curls adds smaller scalloped edges to the actual flow. Lower it or swirl for
  smoother clouds. Increase linger time for more old smoke between strokes.
* **Original:** apply Alpha.6 at any point. New simulation parameters default to
  its exact old constants; optional lighting and fine-curl sampling are off.

## Implementation and limits

The compatible pressure operators, 24 warm-start iterations, bounded stepping,
speed caps, dye limiter and lifecycle clear are retained. Fine curls blends the
two-cell smoothed confinement with local confinement from the same curl field.
No procedural displacement or random velocity field is added.

Brightness changes presentation, not smoke mass. Glow uses eight neighboring
dye samples in two sparse rings in the presentation pass; it is an inexpensive
halo approximation, not full-resolution bloom. Fold shading is density-gradient
relief lighting, not volumetric depth. Exposure above 1 uses a soft highlight
shoulder. Zero dye remains exact black with every lighting option.

No simulation passes or render targets are added. Optional settings add shader
sampling/ALU cost, including full-screen presentation cost. Flow remains capped
at 384 on the longest edge and dye at twice flow resolution; fine detail cannot
recover structures below that grid. Reference likeness and native performance
must be judged on the actual GNOME installation.

## Verification and reproduction

* All 24 isolated JS tests pass, including schema-default parity, complete preset
  restoration, range checking, existing lifecycle behavior and color modes.
* All 11 GLSL 1.20 shaders compile. Offscreen RGBA16F numerical checks pass on
  Radeon 8060S / radeonsi, including finite bounded optional lighting and exact
  black at all preset lighting values and the maximum settings.
* Replayed the original alpha.6 checkout (`3cba20d`) and the new default recipe
  with identical rapid-circle input: **all four PNG snapshots match byte for
  byte**, at stop and +1/+2/+3 seconds. This is a same-driver offscreen check,
  not a cross-driver or native Cogl equivalence claim.
* Generated/inspected photo fast-circle and straight-sweep strips, video
  fast-circle and reversal strips. Each continues deforming after stopping.
  The photo produces brighter smooth rolls and the video produces broader
  multicolored frilled clouds. Sparse strokes remain smaller and less layered
  than the supplied reference. Each snapshot checks finite velocity/density/
  presentation and density within the safety cap.

Generated PNG strips and JSON measurements are in `dist/reference-previews/`.
They are also available in `fluid-smoke-alpha7-previews.zip` on the
[alpha.7 release](https://github.com/edjenn1998/gnome-fluid-smoke/releases/tag/v0.2.0-alpha.7).
Extract that archive and open `reference-previews/index.html`.
Each strip reads left to right: stop, +1s, +2s, +3s. To regenerate in an existing
directory with EGL/GLES available:

```sh
python3 tools/preview_gpu.py dist/reference-previews --scenario fast --preset photo --label photo
python3 tools/preview_gpu.py dist/reference-previews --scenario fast --preset video --label video
python3 tools/preview_gpu.py dist/reference-previews --scenario sweep --preset photo --label photo
python3 tools/preview_gpu.py dist/reference-previews --scenario reversal --preset video --label video
```

## Install or return to alpha.6

`dist/fluid-smoke@edjenn1998.github.io.shell-extension.zip` is version 1.0.0.
Download it from the [stable release](https://github.com/edjenn1998/gnome-fluid-smoke/releases/tag/v1.0.0).
The optional rollback ZIP is available from the alpha.7 release linked above;
when installing a download, use its actual path instead of the `dist/` path below.
`dist/fluid-smoke-0.2.0-alpha.6.shell-extension.zip` is the separately packaged,
unchanged original source, with its own SHA-256 sidecar. The original alpha.6
comparison archive is retained too.

```sh
gnome-extensions disable fluid-smoke@edjenn1998.github.io
gnome-extensions install --force dist/fluid-smoke@edjenn1998.github.io.shell-extension.zip
```

Log out/back in on Wayland, then enable and open preferences. Expect
`1.0.0`, numeric version 10. First try the Alpha.6 preset, then each
reference preset with the same pointer gesture. Verify live controls, fresh
strokes after idle clear, restart persistence, windows above the smoke, lock,
Overview, fullscreen and disabling. Glow and fold shading need actual laptop
frame-rate evaluation. See TESTING.md for the release validation record.

For binary rollback, apply the Alpha.6 preset first (restoring the original
keys), disable, install the separate alpha.6 ZIP, then log out/back in and enable.
New keys are unused by the old build. Its presets UI is naturally unavailable.
