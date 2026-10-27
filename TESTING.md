# Validation record and acceptance checklist

## 0.2.0-alpha.6 — 2026-10-27

See [FLUID_QUALITY.md](FLUID_QUALITY.md) for source findings, historical comparison,
pressure/ablation measurements, preview observations, native diagnostics and the
CachyOS GNOME 51.1 installation/acceptance procedure.

* **22 JS tests pass**: normal pass graph/reset, isolated lazy diagnostics,
  lifecycle rollback/cleanup, settings and continued post-input updates.
* **11 GLSL 1.20 shader checks pass**, including the diagnostic shader.
* Offscreen RGBA16F checks pass on **Radeon 8060S / radeonsi** and **llvmpipe**.
  Hardware smooth-field cold projection: **.604336 → .408074**; Poisson residual
  at 24/80 iterations **.408061 / .216874**. Residual agrees with actual remaining
  divergence, detecting the previous operator mismatch. A cold 24 solve is still
  intentionally incomplete; production warm-start measurements are in the report.
* One-second fade at 30/60 Hz: **.516602 / .511719**. A no-input packet moves
  **23.757** hardware / **23.843** software dye cells (expected 24). Full production
  replay checks strictly decreasing density, continuing normalized deformation
  through each of three post-input seconds, persistent curl, finite velocity,
  tint preservation at the safety cap, signed three-layer sentinel and exact black.
* At 96×64 flow, hardware production density at stop / +1s / +2s / +3s:
  **669.543 / 389.058 / 222.010 / 119.007**; software:
  **662.168 / 374.234 / 213.508 / 113.292**. Chaotic half-float evolution is not
  expected to be pixel-identical across drivers. These numbers are not appearance
  or native Cogl acceptance criteria.
* Generated **76 snapshot PNGs plus 19 strips**: paired baseline/candidate input
  scenarios, pressure budgets and individual-change ablations. Flow 320×180,
  dye 640×360. Metrics use flow-cell-center stencils, plus a common flux-divergence
  norm across versions. Synchronized replay timing excludes compilation/readback.
* Strict schema compilation, preferences syntax, package metadata/allowlist and
  both extension/comparison ZIP CRC checks pass. Package is alpha.6, numeric
  version 8, with compiled GSettings schema. Published as a GitHub test prerelease.
* No GNOME session is available here. Native Cogl execution, preferences UI,
  target-device performance and the three-second visual acceptance test remain
  **pending laptop testing**.

The following sections preserve the historical validation records.

## 0.2.0-alpha.5 — 2026-10-27

Returned to the tagged alpha.2 baseline; `extension/gpu/shaders.js` is identical
to that tag. Added 1.75× default emission and live GSettings preferences.

* All **21 JS tests pass**, including emission scaling, custom colors, live settings,
  hotplug persistence, signal cleanup and extended linger-time behavior.
* All **ten GLSL 1.20 checks pass**, using the optional validator below.
* Offscreen llvmpipe RGBA16F checks pass using the optional EGL environment below.
  Projection RMS: **0.600750 → 0.409050**. One-second fade at 30/60 Hz:
  **0.516602 / 0.511719**. No-input dye packet moves **23.843** dye cells.
  Production density at stop / +0.5s / +1.5s: **2425.809 / 1959.009 / 1138.720**.
  Normalized shape change: **1.011**. Exact-black idle presentation passes.
* Strict schema validation, preferences JS syntax, package creation and ZIP CRC pass.
* No GNOME/GJS session is available here. Check the actual preferences window,
  color dialogs, live edits, saved values after logout/login, reset button, desktop
  appearance and target-device performance on GNOME 51 Wayland.

The sections below describe older builds and are historical validation records.

## 0.2.0-alpha.4 — 2026-10-27

Compared the three updated desktop screenshots with the supplied reference.
The new screenshots show filled rainbow ribbons and repetitive edge ripples;
the reference shows nested rolls, narrow feeds and translucent internal folds.

Changed the source width ratio, bounded pointer coupling, velocity backtrace,
warm-started pressure, smoothed confinement, density loading and fold lighting.
Reviewed 16 production-solver preview frames covering a sweep, slow stroke, fast
stroke and repeated circular stirring, each including post-input evolution.
The previews show large rolling heads, internal spirals and dark channels instead
of the earlier filled bands. Repeated stirring still fills a large area; this is
a 2D flow model, and reference equivalence is not established.

All 18 JS tests and ten GLSL 1.20 checks pass. GPU checks use llvmpipe and RGBA16F:

* One-second fade at 30/60 Hz: **0.631836 / 0.625977** (ideal 0.637628).
* No-input dye transport: **23.843 dye cells** in one second (expected 24).
* Production circular-stirring density at input stop / +0.5s / +1.5s:
  **11060.175 / 9535.919 / 5791.704**.
* Normalized density-shape change over the first no-input half-second: **1.194**.
* Projection remains **0.600750 → 0.409050** divergence RMS for the isolated
  cold-start test. This is not a divergence-free guarantee for production flow.
* Density-cap tint preservation, finite flow, continuing transport and exact
  opaque black for empty dye are checked. JS tests check warm-start preservation
  and pressure reset with the other fields.

The full-solver numerical check now replays production JS commands, avoiding a
separate Python implementation with potentially stale source/pressure settings.
Preview commands (use the optional EGL environment below when needed):

```sh
python3 tools/preview_gpu.py /tmp/opencode --scenario sweep
python3 tools/preview_gpu.py /tmp/opencode --scenario slow
python3 tools/preview_gpu.py /tmp/opencode --scenario fast
python3 tools/preview_gpu.py /tmp/opencode --scenario circle
```

Files are named `smoke-<scenario>-<frame>.png`. No GNOME session is available here;
Cogl integration, laptop appearance and target performance still need testing.

## 0.2.0-alpha.3 — 2026-10-27

Compared the two supplied desktop screenshots (thin jagged colored paths) with
`testphotos/what it should look like.png` (broad luminous folds and wisps). Tuned
source widths, additive momentum, buoyancy, dissipation, confinement and shading.

All 18 JS tests and ten GLSL 1.20 shader checks pass. Offscreen llvmpipe checks
using the new default parameters pass: one-second dye fade at 30/60 Hz is
**0.734375 / 0.729004** (ideal 0.740818); no-input packet displacement remains
**23.844 dye cells** (expected 24). Full-solver density totals at stop / +1s / +2s
are **17530.153 / 15478.984 / 11731.218**. First no-input second normalized shape
change is **1.156**. Projection checks are unchanged; empty dye stays exact black.

`tools/preview_gpu.py` records production `FluidSimulation.step()` commands via a
minimal JS recorder, then executes those shaders/uniforms at 320×180 flow and
640×360 dye resolution. A moving sweep followed by a pause produces four PNGs.
Visual review shows broad luminous folds and curled edges rather than thin lines.
This establishes offscreen appearance for that path, not reference equivalence
or GNOME/Cogl integration. Fine wisps and target-device performance remain open.

```sh
# Existing output directory; same optional EGL environment as below when needed.
python3 tools/preview_gpu.py /tmp/opencode
```

The preview files are `smoke-059.png`, `smoke-089.png`, `smoke-119.png` and
`smoke-179.png`. Tools and screenshots are excluded from the extension ZIP.

## 0.2.0-alpha.2 — 2026-10-27

Test prerelease only. No GNOME/GJS session is available in this environment.
The updated source passes 18 JS bookkeeping/lifecycle tests and all ten GLSL 1.20
shader checks. Offscreen execution uses Mesa llvmpipe, RGBA16F targets, a 96×64
flow grid and a **192×128 dye grid**, exercising distinct field resolutions and
the three-input dye correction pass. Validation dependencies are extracted under
`/tmp/opencode/fluid-smoke-validation`, never included in the extension.

Numerical results from the actual shader bodies:

* Pressure divergence RMS **0.600750 → 0.409050**; Poisson residual at 24/80
  iterations **0.406367 / 0.217060**. This remains an approximate projection.
* Uniform dye after one second, 30/60 Hz: **0.516602 / 0.511719** (ideal 0.522046).
* No-input transport: Gaussian dye packet in a persistent 12-flow-cells/s field
  moves from **(57.600, 64.000) to (81.443, 63.972)** in one second. Expected
  displacement: 24 dye cells. A fade-in-place implementation cannot pass.
* Full solver: two seconds of circular pointer force, then no emission. Density
  totals at stop / +1s / +2s: **2825.477 / 2160.608 / 1259.283**. Dye centroids:
  **(91.976,65.191) → (79.813,46.526) → (82.160,40.981)**. Normalized density
  shape L1 change over the first no-input second: **1.340**. Normalization removes
  uniform fading as an explanation. Curls persist and all checked values are finite.
* Viscosity smooths a localized velocity impulse without negative overshoot and
  preserves uniform interior velocity. Zero dye renders opaque exact black.
* Surface test verifies post-input updates continue without new segments, then
  clear and stop at ten seconds. Session test verifies the 30 Hz fallback.

MacCormack with a local limiter is not globally mass-conservative; these checks
demonstrate transport/deformation rather than an exact mass budget. They do not
prove wispy visual quality, absence of grid artifacts, Cogl layer binding, 60/30
FPS, native resource release, or responsiveness on the Dell XPS 13. Those remain
the laptop acceptance criteria below. No final release has been made.

For this environment's optional validation dependencies:

```sh
node tools/validate_shaders.js /tmp/opencode/fluid-smoke-validation/usr/bin/glslangValidator
LD_LIBRARY_PATH=/tmp/opencode/fluid-smoke-validation/usr/lib/x86_64-linux-gnu \
__EGL_VENDOR_LIBRARY_FILENAMES=/tmp/opencode/fluid-smoke-validation/usr/share/glvnd/egl_vendor.d/50_mesa.json \
LIBGL_ALWAYS_SOFTWARE=1 python3 tools/validate_gpu.py
```

## 0.2.0-alpha.1 — 2026-10-27

The user reports the earlier `0.1.0-poc.2` works and looks cool but resembles
trails rather than smoke. This supports the original feedback architecture;
it is not a completed hardware checklist or acceptance of the new fluid renderer.

### Local automated checks

Environment: Linux TTY, Node.js 22, Python 3.14, ESLint 6.4, Mesa llvmpipe
(LLVM 21.1.8, 256 bits). No GNOME Shell/GJS desktop session is available here.
Optional EGL/GLES libraries and glslangValidator were extracted under `/tmp` for
validation. None is bundled or downloaded by the extension.

| Check | Scope |
| --- | --- |
| `npm test` | 15 tests: coordinates; lifecycle/rollback/errors; bounded substeps, pointer partitioning, GPU pass ordering, read/write separation and owner cleanup |
| ESLint | `no-undef`, `no-unused-vars`, ES2020 parse, all seven extension modules |
| `node tools/validate_shaders.js` | Eight GLSL 1.20 fragment shaders with a minimal Cogl-style interface |
| `python3 tools/validate_gpu.py` | Actual shader bodies compiled/linked and run on RGBA16F offscreen GLES3 targets |
| Package checks | Allowlist, CRC, metadata, reproducible SHA-256 |
| GNOME 51 / Wayland fluid alpha | **Not run — laptop required** |
| Target CPU/GPU/FPS/memory/leaks | **Not measured** |

Mocks test JS bookkeeping, not GI marshalling, real signals, native release timing
or compositor integration. The offscreen harness replaces shader interface names
and GLSL version syntax, using the actual shader bodies. It does not test Cogl
texture-layer binding, GJS or Clutter painting.

### Offscreen numerical results

96×64 grid, RGBA16F, 24 Jacobi iterations:

- Smooth radial field divergence RMS: **0.600750 → 0.409050** after projection.
- Poisson residual RMS: **0.406367** at 24 iterations, **0.217060** at 80.
- Uniform dye after one second: **0.490723** at 30 Hz, **0.485840** at 60 Hz
  (ideal 0.496585). Half-float rounding contributes error.
- Two seconds of circular forcing, then free evolution: density totals
  **203.179 → 121.520 → 60.236** at input stop / +1 s / +2 s.
- Zero stays zero; wall-normal velocity is zero; tested states remain finite;
  curl persists and dye evolves after input stops; output background is opaque.

These are software-renderer correctness checks, not hardware benchmarks or a
claim of zero divergence. The bounded pressure budget still needs profiling.

### Reproduce

```sh
npm test
npm run test:shaders  # optional glslangValidator on PATH
npm run test:gpu      # optional EGL/GLES3 + offscreen driver
python3 tools/package.py
python3 -m zipfile -t dist/fluid-smoke@edjenn1998.github.io.shell-extension.zip
```

Node's VM modules warning is expected. The GPU harness uses Python's standard
library and Node, with no Python package dependencies. Validation tools are not
included in the extension ZIP.

ESLint command:

```sh
eslint --no-eslintrc --env es6 \
  --parser-options '{"ecmaVersion":2020,"sourceType":"module"}' \
  --global global --global console \
  --rule 'no-undef:error' \
  --rule 'no-unused-vars:[error,{"argsIgnorePattern":"^_"}]' \
  extension/extension.js extension/core/coordinates.js extension/core/simulation.js \
  extension/gpu/feedback.js extension/gpu/shaders.js \
  extension/shell/session.js extension/shell/surface.js
```

## Laptop acceptance checklist — new alpha remains untested

Install using `README.md`, log out/in, enable and verify version **6** /
`0.2.0-alpha.4`. Record Shell version, Wayland status, GPU/driver and display layout.
Watch Shell logs while enabling/disabling.

### Appearance and simulation

- [ ] Every desktop monitor is black; motion produces rainbow smoke.
- [ ] Slow/fast strokes and circles produce curls and spreading wisps, not lines.
- [ ] Reverse direction sharply: observe rolling structures, then stop and verify
      visible dye transport/stretching rather than stationary fading patches.
- [ ] Smoke evolves after the pointer stops; ten seconds idle returns to black.
- [ ] Ordinary movement is connected; pointer warps create no long streaks.
- [ ] Move over Firefox and minimize/move it within 2–5 seconds: smoke exists
      underneath. Repeat with the desktop fully covered by normal windows.
- [ ] No Cogl/shader/GJS errors, corrupted rectangles or runaway bright fields.

### Layering and input

- [ ] Move, resize, maximize, minimize and close applications normally.
- [ ] Click, type, select text and drag files/windows without interference.
- [ ] Desktop menus/icons, panels and notifications remain above the effect.
- [ ] No Fluid Smoke application/window appears in Alt+Tab or the dock.
- [ ] Change wallpaper while enabled; disabling reveals the newly chosen image.

### Monitors, suspension and lifecycle

- [ ] Multiple displays: alignment and independent state on each.
- [ ] Negative origins, portrait layout and mixed scaling where available.
- [ ] Crossing displays creates no artificial connecting streak.
- [ ] Hotplug and resolution/scale/layout changes reset cleanly.
- [ ] Twenty enable/disable cycles: clean restoration and no journal errors.
- [ ] Overview, lock, reduced motion and fullscreen pause/resume correctly.
- [ ] Suspend/resume creates no stale-coordinate streaks or long catch-up.
- [ ] Check display blanking separately: explicit display-power suspension is
      not implemented yet.

Native release is GC-dependent. Check for monotonic memory growth after a settling
period; immediate delayed release alone does not demonstrate a leak.

### Performance

Compare disabled, enabled-idle, pointer activity, fullscreen, lock, then disabled
again. Record workload duration, tools/versions and actual values.

- [ ] Shell remains responsive at the normal monitor refresh rate.
- [ ] Record CPU usage, GPU utilization, memory and frame pacing during activity.
- [ ] Expensive simulation stops after fade.
- [ ] Repeat on all monitors and after at least 30 minutes of activity.

```sh
gnome-shell --version
gnome-extensions info fluid-smoke@edjenn1998.github.io
journalctl --user -b -o cat /usr/bin/gnome-shell
ps -C gnome-shell -o pid,%cpu,rss,etime,args
```

Use vendor-specific tools for GPU measurements. No target benchmark or final
visual acceptance is claimed by this prerelease.

## Earlier history

Poc.1 failed on the laptop with removed `Meta.is_wayland_compositor()`. Poc.2
uses `global.context.get_wayland_compositor()` and hardened rollback. Its eleven
isolated tests passed; the user subsequently reported working visuals.
The old `B=-0.5` sentinel was probe-only data. The alpha uses RGBA for dye/density
and removes the magenta sentinel diagnostic.
