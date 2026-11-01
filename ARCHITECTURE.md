# Architecture

Fluid Smoke runs a two-dimensional fluid simulation in GNOME Shell's Cogl context.
JavaScript schedules draws and updates uniforms; shaders operate on persistent
RGBA16F textures. There is no separate renderer process or runtime pixel readback.

## Modules and ownership

| Module | Responsibility |
| --- | --- |
| `extension.js` | Create the session, roll back failed startup, destroy on disable |
| `shell/session.js` | Pointer sampling, signals, scheduling, monitor changes and suspension |
| `shell/surface.js` | One monitor actor, its content and simulation |
| `gpu/feedback.js` | Cogl targets, pipelines, pass ordering and presentation |
| `gpu/shaders.js` | Fluid, lighting and diagnostic shaders |
| `core/simulation.js` | Solver parameters and bounded timestep planning |
| `core/settings.js` | Presets, GSettings conversion and colors; no GI imports |
| `core/coordinates.js` | Logical-monitor coordinates and pointer segments |
| `prefs.js` | GTK4/libadwaita preferences in the separate preferences process |

The extension owns one `SmokeSession`, which owns the timer, signal connections,
background group and monitor surfaces. Each `MonitorSurface` owns a `FluidSimulation`.
Surfaces are recorded before initialization so a partial GPU allocation can be
released on failure.

Startup errors propagate after the extension releases the session. Signal and timer
callbacks log runtime errors and tear down the session. Monitor rebuilds use those
same callers for error handling rather than repeating teardown inside the rebuild.

Disabling removes the timer, disconnects signals, detaches content, destroys actors
and drops GPU owners. Cogl boxed objects are finalized by GJS; native release can
lag behind JavaScript cleanup.

## Scene placement and input

An extension-owned actor group sits inside `Main.layoutManager._backgroundGroup`.
That private Shell property is the only background-layer dependency. Wallpaper
reloads raise the smoke within this group, keeping it above wallpaper and below
windows. Destroying the group reveals the original wallpaper.

Actors are non-reactive and never receive focus. Pointer positions come from
`global.backend.get_cursor_tracker()`, including while the pointer is over a window.
Coordinates are logical desktop units: subtract the monitor origin, then normalize.
Monitor crossings, stationary samples and likely cursor warps emit no segment.

## Render targets and passes

Each monitor has nine normal-mode targets:

- Two velocity textures, two pressure textures, curl and divergence at flow resolution.
- Two dye textures and a forward-advection scratch texture at twice the flow dimensions.

The flow grid's longest edge is at most 384 pixels; dye's is at most 768. A
384×216 flow grid uses about 11.4 MiB of texture storage, excluding driver overhead.

Each substep performs:

1. Explicit viscous diffusion, skipped at zero viscosity.
2. Midpoint semi-Lagrangian velocity advection, drag, buoyancy and pointer forcing.
3. Curl calculation and vorticity confinement.
4. Backward divergence, 24 Jacobi pressure iterations and forward-gradient projection.
5. Forward dye advection, limited MacCormack correction, decay and source injection.

No pass samples its own destination. Ping-pong targets swap after each update.
The previous pressure is retained as the next initial guess; reset clears every field.
Backward divergence and forward gradient compose to the five-point Laplacian used
by the pressure solve. The fixed iteration budget reduces divergence without solving
it exactly. [FLUID_QUALITY.md](FLUID_QUALITY.md) records the stencil investigation.

Velocity is measured in flow cells per second. Pointer forcing is capped at 120
cells/s and velocity at 180 cells/s before projection. Dye has density-weighted RGB
and scalar density in alpha. New emission tapers in dense regions; the density cap
scales RGB and alpha together to preserve tint.

## Defaults and preferences

`STANDARD_PRESET` combines billowing motion with luminous lighting. Solver defaults
derive from it; tests compare it with the schema defaults. GSettings stores absolute
values so existing custom settings retain their meaning. Preferences display the
difference between each value and the standard, with zero at the set point.

Live changes update existing simulations and invalidate their content, including
background changes while idle. Color changes affect newly emitted dye. Presets
replace smoke settings but preserve the background; reset restores both.

Presentation converts density to coverage, applies fold shading and a sparse halo,
then composites over either transparent wallpaper or the selected solid color.
Fold lighting is a density-gradient effect, not volumetric depth.

## Scheduling and diagnostics

Active callbacks target 17 ms, subtracting submission work from the next delay.
Thirty consecutive callbacks taking over 8 ms or arriving more than 25 ms apart
select a 33 ms interval until session restart. Idle polling uses 80 ms.
Integration is bounded to two substeps of at most 1/24 second; pointer speed still
uses actual elapsed time. Excess wall time after a stall is discarded.

Lock, Overview and reduced motion remove the timer and clear the simulation.
Fullscreen clears and pauses only the affected monitor. Hotplug recreates surfaces.
Display-power suspension outside the screen shield is not separately handled yet.

The hidden `debug-view` setting selects velocity, curl, density, divergence or
signed-layer displays. Diagnostic targets are allocated lazily and released with
the simulation. Normal mode performs no diagnostic passes. See [TESTING.md](TESTING.md).

## API references

- [GNOME 51 port guide](https://gjs.guide/extensions/upgrading/gnome-shell-51.html)
- [Cogl textures](https://gnome.pages.gitlab.gnome.org/mutter/cogl/class.Texture2D.html)
- [Cogl offscreen framebuffers](https://gnome.pages.gitlab.gnome.org/mutter/cogl/class.Offscreen.html)
- [Clutter content](https://gnome.pages.gitlab.gnome.org/mutter/clutter/iface.Content.html)
- [Cursor tracker](https://gnome.pages.gitlab.gnome.org/mutter/meta/class.CursorTracker.html)

Hanabi and ShaderPaper were consulted during the original renderer investigation.
No source code or assets from either project are bundled.
