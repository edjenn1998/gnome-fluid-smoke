# Validation record and acceptance checklist

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

Install using `README.md`, log out/in, enable and verify version **3** /
`0.2.0-alpha.1`. Record Shell version, Wayland status, GPU/driver and display layout.
Watch Shell logs while enabling/disabling.

### Appearance and simulation

- [ ] Every desktop monitor is black; motion produces rainbow smoke.
- [ ] Slow/fast strokes and circles produce curls and spreading wisps, not lines.
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
