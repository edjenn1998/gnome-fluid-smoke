# Fluid Smoke architecture decision

**Status: Architecture A retained; first fluid alpha implemented.**

The user reported working poc.2 visuals and requested the fluid implementation.
The complete hardware checklist is still open. The new multi-texture renderer
has offscreen shader validation but awaits GNOME 51 laptop testing.

## Implementation audit and current renderer — 0.2.0-alpha.3

The original probe was **not fluid dynamics**: two GPU passes translated and
faded stored color and added a distance-to-pointer-segment splat. It had no
velocity, pressure, curl or momentum. Its 384-pixel grid, bilinear upscaling and
Gaussian injection explain coarse blurry patches; it had no random noise source.
We cannot identify the laptop's installed build from its appearance alone.

Alpha.1 source already contained genuine persistent velocity/dye, velocity and
dye advection, finite-difference divergence/curl, Jacobi pressure projection and
vorticity confinement. `MonitorSurface.update()` continued stepping after input
stopped, until the ten-second reset. Its deficiencies included first-order dye
transport on the same coarse grid, broad splats, weak pointer coupling, no physical
viscosity and gamma amplification of faint density. Those are source findings,
not evidence that its multipass Cogl path ran correctly on the laptop.

**Architecture assessment before changes:** `FluidSimulation` owns explicit Cogl
RGBA16F textures/framebuffers. Each draw samples only separate input attachments;
ping-pong swaps preserve fields across frames. This is a viable multipass solver
architecture, not a single ShaderEffect accumulating a picture. Offscreen GLES
tests establish shader feasibility; Cogl/GI execution and GPU cost still require
GNOME 51.1 testing. No source-level blocker justifies a separate renderer yet.

Alpha.2/3 use nine persistent targets per monitor: two velocity, two pressure,
curl and divergence at the flow resolution; two dye and one forward-transport
scratch target at twice its width and height. The flow long edge remains <=384,
dye <=768. A 384×216 flow grid uses ~11.4 MiB of texture storage, excluding driver
overhead. No per-frame texture/framebuffer allocation or CPU pixel loops occur.

Per substep (32 GPU draws at default viscosity):

1. Explicit viscous diffusion of velocity using a five-point Laplacian.
2. Bilinear semi-Lagrangian velocity advection, exponential drag, density buoyancy
   and additive mouse momentum along a continuous segment. Alpha.3 places broad
   dye around a narrower momentum jet so the dye straddles the rolling shear.
3. Finite-difference curl and vorticity confinement.
4. Divergence, 24 Jacobi pressure iterations from zero, pressure-gradient removal.
5. Forward dye advection followed by limited MacCormack error correction, decay
   and distance-scaled dye injection. Departure-cell extrema clamp corrected
   values to prevent overshoot/negative dye. Hardware LINEAR filtering applies
   throughout, including presentation upscaling.

Velocity is in flow cells/second; high-resolution dye shares normalized UVs and
uses flow dimensions for backtrace distance and dye dimensions for its limiter.
Reflected wall-normal velocity, clamped pressure and zero wall-normal projected
velocity implement approximate closed boundaries. The collocated pressure solve
reduces, rather than eliminates, divergence. MacCormack is limited and not globally
mass-conservative; physical 3D smoke, combustion and sub-cell turbulence are not
solved. Vorticity confinement restores small-scale spin lost to interpolation;
Gaussian source shape, rainbow palette and optical density shading are visual
models, not extra fluid equations. No procedural noise fakes motion.

Alpha.3 presentation uses density-based color plus four nearby dye samples for a
bounded soft halo. It preserves exact black for an empty field.

Developer tuning is in `core/simulation.js`: viscosity 0.4 cells²/s, velocity
dissipation 0.25/s, dye dissipation 0.3/s and confinement 3. Constructor overrides
are range-validated; viscosity <=3 keeps nu*dt <=0.125, below the explicit 0.25
stability limit. Zero viscosity skips its pass. There is no new preferences UI.

Wall time is bounded to two <=1/24 s substeps (headroom for 30 Hz timer jitter).
Pointer speed uses actual observed elapsed time, including idle polling, and is
capped at 120 cells/s. Stationary samples inject nothing. Velocity is capped at
180 cells/s before projection. After ten seconds without motion, already-decaying
dye is cleared exactly and GPU work stops. A cheap 80 ms observer wakes it.

The timer targets ~60 Hz, subtracting submission time from the next wait; 30
consecutive active callbacks taking >8 ms to submit or spaced >25 ms trigger a
sticky ~30 Hz fallback until session restart. These are overload heuristics, not
GPU timings or measured FPS. GJS submits a bounded pass graph on Shell's thread;
all cell calculations run in shaders. Driver stalls can still affect Shell.
No runtime readback/finish is used; `flush()` submits the final dye framebuffer.
Native object release remains GJS-GC-dependent. Background actors, Wayland cursor
tracking, multi-monitor layout and lifecycle paths are retained. See `TESTING.md`.

## Original architecture investigation and probe history

The sections below record the original candidate selection and poc.1/poc.2
investigation. Probe-only descriptions and original phase gates are historical;
the current renderer/status are described above.

## Evidence and API availability

Investigated 2026-10-27. Online documentation identifies Clutter/Cogl/Meta API
version 51. These are *documented C/GI surfaces*, not proof that every API is
correctly callable through the laptop's installed typelibs. Main-branch sources
were also inspected, pinned below for reproducibility. They are not represented
as the exact CachyOS GNOME 51.1 downstream build.

* [GNOME 51 port guide](https://gjs.guide/extensions/upgrading/gnome-shell-51.html):
  `Shell.GLSLEffect` and `ui/pointerWatcher.js` were removed. Use
  `Clutter.ShaderEffect` / `Cogl.Snippet` and `global.backend.get_cursor_tracker()`.
  `disable()` must be synchronous. `St.Settings.reducedMotion` is available.
* [ShaderEffect](https://gnome.pages.gitlab.gnome.org/mutter/clutter/class.ShaderEffect.html)
  and [its implementation](https://github.com/GNOME/mutter/blob/2b9c0787f99dacef16ba987656e28ffcb344b9a2/clutter/clutter/clutter-shader-effect.c):
  redirects an actor, decorates its pipeline, then presents it. This is NOT a
  feedback solver; chaining effects does not create persistent numerical fields.
* [Texture2D.new_with_format](https://gnome.pages.gitlab.gnome.org/mutter/cogl/ctor.Texture2D.new_with_format.html),
  [PixelFormat](https://gnome.pages.gitlab.gnome.org/mutter/cogl/enum.PixelFormat.html),
  [Offscreen](https://gnome.pages.gitlab.gnome.org/mutter/cogl/class.Offscreen.html),
  [Framebuffer draws](https://gnome.pages.gitlab.gnome.org/mutter/cogl/method.Framebuffer.draw_textured_rectangle.html):
  provide explicit float textures, framebuffer ownership and shader draws.
  The selected format is `RGBA_FP_16161616`; support must be tested on the GPU.
* [Backend.get_cogl_context](https://gnome.pages.gitlab.gnome.org/mutter/clutter/method.Backend.get_cogl_context.html):
  reached through `global.stage.context.get_backend()`. Cogl is compositor-owned
  and this API is described as experimental, not a cross-release stable ABI.
* [Content.paint_content](https://gnome.pages.gitlab.gnome.org/mutter/clutter/vfunc.Content.paint_content.html)
  and [PipelineNode.new](https://gnome.pages.gitlab.gnome.org/mutter/clutter/ctor.PipelineNode.new.html):
  present an owned Cogl pipeline without borrowing/modifying an effect's private
  target pipeline. This is why this probe uses a `Clutter.Content` implementor
  instead of `Clutter.ShaderEffect`. Both use Cogl snippets; the latter is not
  required for custom content and would allocate an unnecessary actor-sized FBO.
* [Shell layout source](https://github.com/GNOME/gnome-shell/blob/216e6d957fe534ac7bbfaf1187472585586935f9/js/ui/layout.js):
  creates `Main.layoutManager._backgroundGroup` at the bottom of
  `global.window_group`. This is the single isolated private layout dependency.
* [BackgroundActor](https://gnome.pages.gitlab.gnome.org/mutter/meta/class.BackgroundActor.html):
  specialized for backgrounds and occlusion. Our content actor is a child of the
  background group, not a `Meta.BackgroundActor`; do not assume its optimized
  occlusion behavior applies to this probe.
* [CursorTracker source](https://github.com/GNOME/mutter/blob/2b9c0787f99dacef16ba987656e28ffcb344b9a2/src/backends/meta-cursor-tracker.c)
  and [get_pointer](https://gnome.pages.gitlab.gnome.org/mutter/meta/method.CursorTracker.get_pointer.html):
  queries the compositor seat. The returned coordinates are a Graphene point,
  not the old `[x,y,modifiers]` signature. The probe expects GJS `[point,mods]`.

### poc.2 compatibility and lifecycle audit — 2026-10-27

The laptop reported `TypeError: (intermediate value).is_wayland_compositor is
not a function` with poc.1. Its exact source was `extension/shell/session.js:23`:
`if (!Meta.is_wayland_compositor())`. This legacy namespace function is absent
from GNOME 51. The probe now rejects a null result from
`global.context.get_wayland_compositor()` before allocating resources:

* [Shell.Global.get_context](https://gnome.pages.gitlab.gnome.org/gnome-shell/shell/method.Global.get_context.html)
  exposes the Shell-owned `Meta.Context` as the `context` property.
* [Meta.Context.get_wayland_compositor](https://gnome.pages.gitlab.gnome.org/mutter/meta/method.Context.get_wayland_compositor.html)
  returns a borrowed `Meta.WaylandCompositor` or null. The extension only checks
  this value; it must never destroy the Shell's context or compositor.

Reviewed every extension module, the GNOME 51 port guide, and the following
remaining external API groups. The GI documentation reviewed reports API/library
version 51; live main-branch Shell source was checked for private JS integration.
No further removed/nonexistent API was identified in this review.

| Area | Reviewed APIs / findings |
| --- | --- |
| Pointer and monitors | `Meta.Backend.get_cursor_tracker()`, `CursorTracker.get_pointer()` with Graphene point + modifiers out parameters, `Display.get_monitor_in_fullscreen()`, `in-fullscreen-changed` |
| Shell JS | `layoutManager.monitors`, `monitors-changed`, `_backgroundGroup`; `overview.visible`, `showing`/`hidden`; `screenShield.active`, `active-changed` remain in Shell source |
| Reduced motion | `St.Settings.get()`, `reducedMotion`, `notify::reduced-motion`, `St.ReducedMotion.REDUCE` match the GNOME 51 port guide |
| GPU context | `global.stage.context.get_backend().get_cogl_context()` matches the replacement for removed `Clutter.get_default_backend()` |
| GPU targets | `Texture2D.new_with_format()`, `PixelFormat.RGBA_FP_16161616`, `Texture.allocate()`, `Offscreen.new_with_texture()`, framebuffer `allocate()`, `orthographic()`, `set_dither_enabled()`, `clear4f()`, `BufferBit.COLOR` remain documented |
| Pipelines | `Pipeline.new()`, `Snippet.new()`/`set_replace()`, `SnippetHook.FRAGMENT`, `add_snippet()`, `set_blend()`, layer texture/filter/wrap setters and their enums, `get_uniform_location()`/`set_uniform_float()`, `draw_textured_rectangle()`, `flush()` remain documented |
| Presentation | `GObject.registerClass()` implementing `Clutter.Content`, three-argument `paint_content` vfunc, `PipelineNode.new()`, paint-node `add_rectangle()`/`add_child()`, actor content box/paint opacity, `Content.invalidate()` |
| Actor ownership | `Clutter.Actor` geometry/content/non-reactive/clip properties, `add_child()`, `child-added`, `set_child_above_sibling()`, `destroy()` |
| Scheduling / entry point | Synchronous `Extension.enable()`/`disable()`, GObject signal connect/disconnect, GLib monotonic time, one-shot `timeout_add()`/`SOURCE_REMOVE`, `Source.remove()` |

`set_uniform_float()` retains its explicit component/count arguments: the upstream
header annotates `value` as `(array)`, not `(array length=count)`. Documentation
alone does not establish successful GJS marshalling or shader execution.

Initialization records each surface before allocating its GPU resources, so
partial failures can release it. Rebuild rollback now also covers context lookup
and the initial reset. Signal callbacks now use the same log-and-teardown policy
as timer callbacks; a hotplug or suspension error must not leave polling/signals
running. Startup errors still propagate to the Extensions UI after rollback.
Repeated session destroy/extension disable is covered by isolated tests.

Remaining live risks include the private background group, content vfunc dispatch,
GI marshalling, float-target support, shader-driver behavior and GC-dependent GPU
release. This audit is a source/documentation compatibility check, **not a passed
GNOME Shell runtime test**. Rendering architecture and the Phase 3 gate are intact.

## Selection: native GPU, subject to on-device proof

Keep the simulation on the GPU in persistent Cogl textures. GJS will issue a
bounded number of draws, not iterate pixels. This minimizes runtime dependencies,
avoids cross-process GPU sharing, needs no surfaces/windows or input overlay,
and respects GNOME's scene layering directly.

The probe owns two float textures/FBOs **per logical monitor**. Each tick:

1. A → B: GPU upward translation and exponential decay of two test dye channels.
2. B → A: GPU distance-to-segment injection, with continuous color variation.
3. A → Clutter paint node: opaque presentation on black.

A's state persists into the next frame. No texture is sampled while attached
as that draw's destination. A negative blue-channel sentinel (`-0.5`) traverses
both passes. The display shader paints solid magenta if that value is lost.
This checks a requirement of signed velocity/pressure storage beyond merely
showing animation. Successful moving/fading trails prove sampled feedback;
absence of the magenta error field is the initial signed-storage check.
Numerical readback/pressure convergence testing is still required for Phase 3.

This **temporary translation/decay experiment is not a fluid approximation being
offered as the final product**. It has no velocity field, pressure solve or
vorticity. The grid is capped at 384 pixels on its longest edge for bounded
initial risk (two RGBA16F color attachments: at most 2.25 MiB for square grids,
excluding driver overhead). This is allocation arithmetic, not measured VRAM.
The final medium-quality half-logical-resolution target needs profiling first.

## Background, coordinates and lifecycle

An extension-owned group is appended inside the actual desktop background group,
above the user's wallpaper but below window actors. Reloading wallpaper raises
only this child within the background group. No GSettings wallpaper value is
written; destroying our actors reveals the original wallpaper. Actors are
non-reactive, never added to chrome/input regions, never given focus, and never
create a Wayland window. Icons implemented as desktop windows remain above it.
Compatibility with actual icon extensions must be checked.

Monitor geometry and pointer coordinates are logical desktop units; subtract the
monitor origin before normalization. Do not multiply pointer positions by output
scale. Each monitor has independent FBOs and a clipped actor. Negative origins,
portrait layouts and mixed scaling use the same mapping. On layout change,
all probe surfaces are recreated and previous pointer state is discarded.
Mirrored physical outputs sharing one logical monitor share its simulation.

Bounded sampling uses `Meta.CursorTracker.get_pointer()` every 17 ms when active,
80 ms when idle (approximately 59/12.5 callbacks/sec, not measured frame rates).
Only the most recent sample is retained in memory. Stationary movement injects
nothing. An analytic line-segment splat bridges samples. Monitor changes and
likely cursor warps discard the segment. A very fast within-monitor move larger
than half the shorter monitor dimension is deliberately ignored by this probe.

At 10 seconds after movement, the already faint test dye is cleared and GPU
draws stop. The cheap 80 ms observer remains to wake it. Fullscreen monitors do
not step or emit; state is cleared on suspension. Overview and reduced motion
stop the observer and clear test fields. Screen-shield activation stops it too;
the default `user` session mode additionally disables the extension on lock.
Display blanking outside ScreenShield/logind paths is **not yet separately
handled**. Fully obscured non-fullscreen monitors are not detected.

`disable()` synchronously removes the one timer, disconnects every owned signal,
destroys all actors, and drops content/pipeline/FBO/texture references. No helper
process exists. Cogl object finalization is GJS-GC-dependent; immediate VRAM
reclamation is not promised. Repeated-toggle memory testing is a required gate.
Explicit framebuffer allocation catches unsupported targets before lazy drawing;
initialization errors roll back allocated owners. Tick failures stop and tear
down the probe instead of repeatedly issuing failing work. Shader-driver failures
may only appear in the journal; they cannot all be caught as JavaScript errors.

## Architecture B investigation and fallback

[Hanabi](https://github.com/jeffshee/gnome-ext-hanabi) (GPL-3.0; inspected
`src/wallpaper.ts` and `src/waylandSubprocess.ts`) launches a controlled Wayland
client, identifies its windows, and clones their actors into backgrounds. This
demonstrates a practical external-renderer integration, but hiding/managing real
windows and Shell integration increase complexity. It is not a standard Wayland
wallpaper protocol and is not automatically safe to transplant.

[WerWolv/ShaderPaper](https://github.com/WerWolv/ShaderPaper) (GPL-2.0 repository
license reported by GitHub) is a Windows C#/WPF/C++ shader-wallpaper project,
not evidence of GNOME compatibility. Its shader-wallpaper concept is relevant;
its Windows desktop embedding is not reusable here. No code was copied from
either project. No third-party shader assets/dependencies are bundled.

If native GI access, shader cost or resource lifetime is unacceptable, reconsider
a separately installed renderer with explicit permission/lifecycle boundaries.
Possible output transports: owned Wayland client plus background cloning, or
shared GPU buffers via a verified integration. Neither is implemented or proven
here. CPU readback and frame-sized IPC uploads would be a poor default at 60 FPS.
Wayland layer-shell is not a general GNOME background integration solution.
There is no invented `importExternalTexture()` API or hidden renderer window in
this package. External renderer dependencies, IPC, zero-input surface behavior,
and crash isolation must receive a separate proof before selecting B.

## Planned genuine solver, after the gate

Implement semi-Lagrangian velocity advection, viscous diffusion, curl and
vorticity confinement, divergence, bounded Jacobi pressure iterations, gradient
subtraction, then dye advection/injection/dissipation. Separate velocity/pressure
grids from display/dye resolution as profiling warrants. Use consistent grid-cell
units, no-through-flow boundary conditions, timestep limits/substeps and bounded
forces. Exponential per-second dissipation and a final invisible-state clear
return the desktop to exact black. Injection must scale momentum by pointer
velocity, distribute dye independently of sample frequency, and avoid stationary
emission. Add numerical finite-value, divergence-reduction and frame-rate
equivalence tests; visual judgment alone does not validate incompressibility.

Only then add GSettings/GTK4/Libadwaita preferences, 30/60 FPS, quality tiers,
adaptive budgets, separate display-sleep suspension, long-run memory/latency
measurement and public-alpha documentation. None are claimed by the probe.

## Publication / maintainership

Reviewed the official [best practices](https://gjs.guide/extensions/review-guidelines/best-practices.html)
and [review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html).
Retain the personal-use AI notice until a maintainer has personally read,
understood and can support the code. GitHub distribution is separate from EGO
review; no submission, approval or verified GNOME compatibility is implied.
