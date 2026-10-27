# Validation record and acceptance checklist

## Actual results — 2026-10-27

Environment: Ubuntu-kernel Linux x86-64 (`7.0.0-38-generic`), TTY session,
Node.js `v22.22.1`, Python `3.14.4`, ESLint `v6.4.0`.
No `gjs`, `gnome-shell`, display server connection, `glslangValidator`, EGL or
GLESv2 runtime was available. No GPU shader execution, GJS GI marshalling or
compositor test has been run. No benchmark values can be reported.

| Check | Actual result |
| --- | --- |
| Pure coordinate tests | 3 passed: logical/negative/portrait geometry, transitions/warps, bounded 8K/tiny grids |
| Isolated session tests with mock GNOME objects | 3 passed: ten lifecycle/rebuild cycles, lock/overview/reduced-motion resume, partial initialization rollback |
| ESLint `no-undef`, `no-unused-vars`, ES2020 module parse | Passed for all six extension JavaScript modules |
| ZIP creation, allowlist and CRC integrity | Passed; source-only eight-file extension ZIP |
| Package reproducibility | Two builds produced identical SHA-256 (below) |
| Bundled GPL text compared with system GPL-3 | Byte-identical |
| GitHub CLI authentication | Active account `edjenn1998` confirmed |
| Intended GitHub repository lookup | Could not resolve `edjenn1998/gnome-fluid-smoke`; no create/push attempted |
| GNOME 51.1 / Wayland execution | **NOT RUN — laptop required** |
| Genuine fluid numerical tests | Not applicable yet; no fluid solver implemented |
| CPU/GPU/memory/FPS/leak measurements | **NOT RUN** |

Mock tests execute the actual session source with mocked imports. They validate
resource bookkeeping, not real signal availability, GI behavior, GPU lifetime,
screen-shield behavior or compositor integration. Coordinate tests model mixed
scaling using logical units; they do not exercise actual display hardware.

Packaged probe SHA-256:
`d46393aaaf26dc46113bc78be5455ee3e9c8419e1c2de5df75532119d2051025`.

### Reproduce local checks

```sh
cd ~/coding/gnome-fluid-smoke
node --experimental-vm-modules --test tests/*.test.js
python3 tools/package.py
python3 -m zipfile -t dist/fluid-smoke@edjenn1998.github.io.shell-extension.zip
```

Node's experimental VM warning is expected for isolated module mocking.
The available system ESLint 6 check was:

```sh
eslint --no-eslintrc --env es6 \
  --parser-options '{"ecmaVersion":2020,"sourceType":"module"}' \
  --global global --global console \
  --rule 'no-undef:error' \
  --rule 'no-unused-vars:[error,{"argsIgnorePattern":"^_"}]' \
  extension/extension.js extension/core/coordinates.js \
  extension/gpu/feedback.js extension/gpu/shaders.js \
  extension/shell/session.js extension/shell/surface.js
```

This command records the version actually used, not a requirement to install
obsolete ESLint on the laptop. A modern lint setup can replace it later.

## Laptop setup

Follow `README.md` to install the ZIP and log out/in. Do not install a renderer;
this candidate is extension-only. Record these results in a copy of this file:

```sh
gnome-shell --version
printf '%s\n' "$XDG_SESSION_TYPE"
gjs --version
uname -r
lspci -nnk
gnome-extensions info fluid-smoke@edjenn1998.github.io
```

Record GPU model/driver, display resolutions, refresh rates, scale factors and
relative positions from GNOME Settings → Displays. No pointer coordinates need
to be recorded. Open a terminal with Shell logs before enabling:

```sh
journalctl --user -b -o cat /usr/bin/gnome-shell -f
```

If empty, use `journalctl -b _COMM=gnome-shell -o cat -f` instead.

## Phase 2 acceptance gate — all boxes initially UNTESTED

### Background and feedback (mandatory)

- [ ] Enable; every desktop monitor has an opaque black background.
- [ ] No existing wallpaper shines through; no solid magenta error rectangle.
- [ ] Move the cursor in a circle on the desktop: smooth connected colored
      test trails appear at the correct position and drift upward.
- [ ] Stop: old trails continue changing while the pointer is stationary.
      This tests persistent sampled state, not just a pointer-position shader.
- [ ] Wait at least 10 seconds: scene returns to exact black and stays black.
- [ ] Repeat slowly and quickly; trails stay connected for ordinary movements.
- [ ] Open Firefox covering half the monitor. Move over Firefox, then move or
      minimize it within 2–5 seconds. Trails must have been generated underneath.
- [ ] Repeat while a monitor is fully covered by non-fullscreen windows; reveal
      within 2–5 seconds. State evolution must not depend on content being painted.
- [ ] No solid magenta diagnostic before/after activity or monitor reconfiguration.
      That shader checks preservation of `B=-0.5` through signed-float feedback.

Do not mark the feedback gate passed for a black screen alone. Successful animated
trails, temporal persistence, correct sampling and absence of the sentinel error
are jointly necessary. Any shader warnings/errors must be investigated.

### Layering and input (mandatory)

- [ ] Move, resize, maximize, minimize and close Firefox; effect stays below it.
- [ ] Click links, select text and type in applications; focus behaves normally.
- [ ] Drag windows and files; no unexpected pointer grabs or missed clicks.
- [ ] Desktop right-click menu works; desktop icons remain above the effect.
- [ ] Open panel menus and notifications; smoke never paints above them.
- [ ] Enter/leave Activities; transitions remain normal, probe work pauses.
- [ ] Alt+Tab/dock show no Fluid Smoke application/window.
- [ ] Change normal GNOME wallpaper while enabled; probe remains on top of the
      wallpaper (still behind windows). Disable; the newly chosen wallpaper appears.

### Multiple monitors (mandatory when hardware available)

- [ ] Two displays at once: exact position on each, no duplicate injection.
- [ ] Different resolutions; record both.
- [ ] Mixed scales (e.g. 100% and 150%); pointer and trails still align.
- [ ] Horizontal arrangement with a display left of primary.
- [ ] Vertical arrangement with a display above primary.
- [ ] Portrait/landscape arrangement if supported.
- [ ] Move across monitor boundaries; no artificial connecting streak.
- [ ] Disconnect/reconnect an external display during activity.
- [ ] Change resolution/scale/layout while enabled; reset is acceptable, errors
      or orphaned rendering are not.
- [ ] Mirroring, if used: one state per logical monitor is expected.

### Lifecycle / suspension (mandatory)

- [ ] Enable/disable 20 times; wallpaper restores immediately every time.
- [ ] No retained probe content visible after disable; no journal errors.
- [ ] Lock/unlock during activity; no animation/observation on lock, clean resume.
- [ ] Allow idle screen blanking; probe work stops, wakes cleanly.
- [ ] Suspend/resume; clean resume, no stale coordinates or long streak.
- [ ] Fullscreen an application on one monitor; only eligible monitors do work.
      Current probe resets all fields on fullscreen state changes.
- [ ] Switch fullscreen workspaces; behavior remains correct.
- [ ] Enable GNOME reduced motion; probe animation stops; changing back resumes.
- [ ] No helper process remains after disable (none should ever be spawned).

GPU deletion is GC-dependent: inspect memory after repeated activity/toggles and
a settling period. A brief delayed release is distinct from monotonic growth.
No claim of leak-free native resources is made by the JavaScript mock tests.

## Performance measurements — record actual values

GNOME Shell responsiveness takes priority. Measure the same workload with the
extension disabled, idle, active, fullscreen, and disabled again. Record sample
duration, hardware and tool/version alongside each value. For CPU and memory:

```sh
ps -C gnome-shell -o pid,%cpu,rss,etime,args
top -p "$(pgrep -n -x gnome-shell)"
```

If `sysstat` is installed, a 30-second sample provides clearer CPU averages:

```sh
pidstat -u -r -p "$(pgrep -n -x gnome-shell)" 1 30
```

Use an appropriate already-installed GPU utility, such as `nvtop`,
`intel_gpu_top`, `amdgpu_top`, or NVIDIA's `nvidia-smi`, recording GPU utilization
and memory where exposed. Tools/permissions differ; don't infer usage from FPS.
Shell performance is shared with all applications, so compare a consistent scene.

| Mode | CPU sample | RSS | GPU / VRAM | Frame pacing | Duration |
| --- | --- | --- | --- | --- | --- |
| Disabled baseline | unmeasured | unmeasured | unmeasured | unmeasured | — |
| Active one monitor | unmeasured | unmeasured | unmeasured | unmeasured | — |
| Active two monitors | unmeasured | unmeasured | unmeasured | unmeasured | — |
| Idle (>10 s) | unmeasured | unmeasured | unmeasured | unmeasured | — |
| Fullscreen | unmeasured | unmeasured | unmeasured | unmeasured | — |
| After 20 toggles | unmeasured | unmeasured | unmeasured | unmeasured | — |
| After 30 min activity | unmeasured | unmeasured | unmeasured | unmeasured | — |

The 17 ms timer does not establish 60 FPS. Capture frame timing with a suitable
GNOME/Sysprof compositor trace if available; record actual repaint intervals and
missed frames. Do not estimate achieved FPS from callback frequency.

## Final solver checklist — BLOCKED, not applicable to this probe

- [ ] Semi-Lagrangian velocity/dye fields evolve and remain finite under stress.
- [ ] Pressure projection measurably reduces divergence with correct boundaries.
- [ ] Vorticity produces natural curls/eddies, no particles or decorative noise.
- [ ] Faster pointer movement injects stronger momentum; stationary pointer emits none.
- [ ] Rainbow colors vary smoothly and mix, with wispy antialiased appearance.
- [ ] Ten-second fade is smooth and ultimately returns to pure black.
- [ ] 30/60 FPS physics are time-consistent; long frame gaps do not explode fields.
- [ ] Every actual preference applies live; defaults/reset/clear/pause work.
- [ ] Open/close GTK4 preferences repeatedly without leaking processes/resources.
- [ ] Low/Medium/High quality and adaptive mode are measured and compared.
- [ ] Display sleep outside screen-shield paths is handled explicitly.
- [ ] Dependency/license/maintainability review completed before publication.

## Report template / go-no-go

Send: Shell/GJS/GPU driver versions, display layout/scales, the failed checkbox,
reproduction steps and relevant journal errors. A short recording showing pointer
alignment and reveal-under-Firefox behavior is helpful once available.

**Gate status: OPEN / awaiting laptop results.** No full fluid implementation,
release, or EGO submission is approved by these isolated checks. If a mandatory
test fails, fix and retest the foundation before proceeding to Phase 3.
