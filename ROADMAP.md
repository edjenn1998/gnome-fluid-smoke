# Development gates

## 1. Architecture research — completed as source investigation

Candidate A uses Cogl owned render targets and custom Clutter content. Runtime
feasibility remains unproven. Consult `ARCHITECTURE.md` for evidence and risks.

## 2. Technical proof — packaged; laptop acceptance required

Run `TESTING.md` on CachyOS GNOME 51.1. Required evidence: black background below
windows/icons, GPU animated feedback, signed float survival, pointer tracking over
windows, correct multi-monitor geometry, no input interference and clean repeated
disable. Investigate any failed gate before extending the renderer.

## 3. Genuine fluid dynamics — blocked by gate 2

Implement GPU velocity/dye advection, bounded timestep, viscosity, divergence,
pressure projection, vorticity confinement and smooth rainbow injection. Add
numerical validation: finite values, pressure convergence/divergence reduction,
different frame-rate equivalence and 10-second dissipation. Tune visuals and
profile draw-call/pressure budgets before UI expansion. No particle substitution.

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
`edjenn1998/gnome-fluid-smoke`. No release or EGO submission until personal tests;
EGO additionally requires a maintainer able to explain/debug the JavaScript.
