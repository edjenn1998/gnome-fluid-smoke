# Fluid Smoke architecture decision

**Status: candidate Architecture A; Phase 2 validation gate OPEN.**

This is an architecture probe, not a completed wallpaper or fluid simulation.
No GNOME compositor execution has been performed here. Do not begin Phase 3
until the laptop acceptance tests in `TESTING.md` pass. If float feedback,
GJS paint-node dispatch, layering, or cleanup fails, resolve it or reconsider
the backend before implementing a solver.

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
