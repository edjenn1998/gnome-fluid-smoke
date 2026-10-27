# Development gates

## 1. Architecture research — completed as source investigation

Candidate A uses Cogl owned render targets and custom Clutter content. Runtime
feasibility remains unproven. Consult `ARCHITECTURE.md` for evidence and risks.

## 2. Technical proof — user reports working poc.2 visuals

The user reports the probe works and looks cool, but not like smoke. Full
`TESTING.md` acceptance on CachyOS GNOME 51.1 is still pending: black background below
windows/icons, GPU animated feedback, signed float survival, pointer tracking over
windows, correct multi-monitor geometry, no input interference and clean repeated
disable. Investigate any failed gate before extending the renderer.

## 3. Fluid dynamics — first alpha implemented; laptop validation pending

Implemented GPU velocity/dye advection, bounded timestep, buoyancy, divergence,
24-iteration pressure projection, vorticity confinement and rainbow injection.
Offscreen checks cover finite values, pressure residual/divergence reduction,
frame-rate decay and evolving curls. The ten-second idle clear remains in place.
Numerical diffusion is present; physical viscosity is not separately solved.
Next: validate actual smoke appearance and multi-texture Cogl execution on the
laptop, tune visuals and profile pressure/pass budgets before UI expansion.

## 4. Lifecycle / multi-monitor production hardening

Extend existing probe paths with display-power suspension, hotplug stress tests,
overview/workspace behavior, fullscreen/workspace changes, resume and long-run
resource evidence. Evaluate reliable obscuration and input/event-driven wakeups.
Target independent simulation for logical monitors, default fullscreen suspension.

## 5. Preferences

GSettings schema plus separate GTK4/Libadwaita preferences process. Validate ranges
and update settings live. Planned groups (only expose behavior actually supported):

| Group | Controls / intended defaults |
| --- | --- |
| Appearance | Rainbow (default) / single color, palette, density (medium), intensity, transparency, emission radius, fade duration (~10 s) |
| Flow | Swirl, turbulence, mouse sensitivity, momentum, viscosity, dye dissipation; descriptive tooltips |
| Performance | Low/Medium/High (Medium), 30/60 FPS (60), idle suspension (on), pause fullscreen (on), adaptive quality if validated |
| General | Restore defaults, clear smoke, pause animation, About / GPL-3.0-or-later |

Avoid redundant fade/dissipation controls if they ultimately govern the same
parameter; explain distinct meanings if both are retained. Respect reduced motion.

## 6. Optimization and test gate

Measure CPU/GPU/memory/frame pacing in active, idle, fullscreen, lock and multiple
display states; compare all quality modes. Start from half-logical-resolution
medium grids only when supported by measurements. Bound pressure iteration cost,
reuse textures, avoid readback, stop invisible work. Verify no monotonic resource
growth over extended activity and at least 20 enable/disable cycles.

## 7. Documentation / publication

Replace probe instructions with tested installation and actual settings docs.
Add authentic screenshots/demo and measured compatibility. Review all code,
dependencies and licensing, confirm GitHub publication, inspect status/diff/log
and secrets before milestone commits. Public repository: intended
`edjenn1998/gnome-fluid-smoke`. The user authorized a public alpha prerelease;
final stable release still requires laptop acceptance and measured performance.
EGO additionally requires a maintainer able to explain/debug the JavaScript.
