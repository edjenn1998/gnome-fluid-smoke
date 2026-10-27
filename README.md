# Fluid Smoke

Interactive, GPU-accelerated smoke wallpaper for GNOME — **in architecture
validation, not yet a fluid wallpaper**.

The goal is vivid rainbow smoke on pure black, driven by pointer motion anywhere
in the Wayland session while staying behind applications and desktop controls.
The current `0.1.0-poc.1` package is a small feedback-trail test used to validate
GNOME 51's GPU APIs before building a genuine incompressible-fluid solver.

**Please test the probe on your CachyOS GNOME 51.1 laptop first.** It deliberately
shows simple colored trails, not realistic smoke. No screenshots or demonstration
are available yet because compositor execution has not been tested here.

## Current scope

Implemented for validation:

* Native Cogl GPU two-pass persistent floating-point texture experiment.
* Opaque black desktop content without modifying wallpaper settings.
* Compositor pointer queries, including coordinates over application windows.
* Independent bounded texture state and clipped content for every logical monitor.
* Monitor layout rebuild, idle GPU suspension and fullscreen suspension paths.
* Synchronous lifecycle cleanup, screen-shield/Overview/reduced-motion suspension.
* Source-only local extension package and isolated coordinate/lifecycle tests.

These are implementation descriptions. **Live layering, GPU execution, pointer
tracking and hardware behavior still require validation.** See `TESTING.md`.

Not implemented yet: fluid velocity/pressure projection, vorticity, final rainbow
palette, live preferences, quality tiers, 30 FPS selection, adaptive quality,
complete visibility/power management or production performance tuning.

## Compatibility and dependencies

Target: **GNOME Shell 51 on Wayland**, particularly CachyOS GNOME 51.1.
`shell-version: ["51"]` selects the intended test platform; it is not a
compatibility certification. Other GNOME versions and X11 are not supported.
Runtime dependencies are supplied by GNOME: GJS, Mutter's Cogl/Clutter/Meta and
St typelibs, and a functioning GPU driver with renderable/filterable RGBA16F
textures. There are no downloaded runtime dependencies or external renderers.

Build: Python 3 only. Isolated tests: Node.js 22+ (VM modules flag used by script).
On an existing CachyOS/Arch GNOME installation, install missing tools explicitly:

```sh
sudo pacman -S --needed gjs python nodejs
```

Use the matching Shell/Mutter packages from your normal distribution updates;
do not mix their library/typelib versions. `gnome-extensions` is provided by
`gnome-shell`. A graphics-driver-specific performance tool is optional.

## Build and install the architecture probe

Work with the supplied project directory; no published GitHub repository is
required for this step:

```sh
cd ~/coding/gnome-fluid-smoke
node --experimental-vm-modules --test tests/*.test.js
python3 tools/package.py
gnome-shell --version
printf '%s\n' "$XDG_SESSION_TYPE"
gnome-extensions install dist/fluid-smoke@edjenn1998.github.io.shell-extension.zip
```

On first installation, **log out and back in** so GNOME discovers the extension.
Wayland does not support the X11 Alt+F2 `r` Shell restart. Then run:

```sh
gnome-extensions enable fluid-smoke@edjenn1998.github.io
gnome-extensions info fluid-smoke@edjenn1998.github.io
```

For an intentional update to this same probe, disable it first, then use
`gnome-extensions install --force` with the same archive and log out/in. Do not
overwrite another extension directory or bypass version validation.

### Expected result

Desktop areas become black. Moving the pointer makes small colored GPU trails
which drift upward and decay, including behind Firefox. Move/minimize Firefox
within a few seconds to reveal those trails. Stop moving for 10 seconds: the
desktop should become pure black and expensive drawing should stop. A completely
solid magenta rectangle means the floating-point feedback probe **failed**;
disable and collect logs. Magenta within a moving colored trail is normal.

## Configuration

There is **no preferences window in the architecture probe**. Pause/clear it by
disabling the extension; re-enable for a clean test. GNOME reduced motion stops
animation automatically. Final GTK4/Libadwaita settings and their defaults are
planned in `ROADMAP.md`; inactive controls are not shipped as placeholders.

## Multiple monitors and performance

Every logical monitor gets a separate state. Logical coordinates handle negative
origins, portrait orientation and mixed scaling without scaling mouse coordinates
twice. Cursor transitions reset the connecting segment. Display reconfiguration
resets all probe state. Mirrored physical displays share one logical simulation.
Hardware validation is pending.

The test grid is intentionally capped at 384 pixels on its longest edge; visible
softness is expected. A timer requests work approximately every 17 ms while active
and samples every 80 ms when idle. These are scheduling intervals, not achieved
FPS. Fullscreen monitors suspend and clear test trails. No CPU/GPU/FPS benchmark
is available yet. Follow `TESTING.md` for measurements before increasing quality.

## Troubleshooting and logs

```sh
gnome-extensions info fluid-smoke@edjenn1998.github.io
journalctl --user -b -o cat /usr/bin/gnome-shell
```

If your distribution does not route Shell output to the user journal:

```sh
journalctl -b _COMM=gnome-shell -o cat
```

Use `-f` to follow logs during enable/disable. Report relevant `Fluid Smoke`, GJS,
Cogl and shader errors, the Shell version, GPU/driver, Wayland status and monitor
layout. Review logs before sharing; journal entries from other components may
contain unrelated personal data. Fluid Smoke does not log pointer coordinates.

* **Not listed after install:** log out and back in; verify GNOME 51.
* **Black desktop, no trails:** check reduced motion, fullscreen, extension state
  and journal. Successful static tests do not prove GJS/Cogl runtime compatibility.
* **Solid magenta screen:** signed float storage or texture feedback failed.
* **Original wallpaper unexpectedly covers the probe:** report wallpaper reload
  timing and other wallpaper extensions; private background-group integration
  remains a validation item.
* **Any interaction/latency problem:** disable the probe and report the exact
  operation; it must never capture input or appear above windows.

## Disable and uninstall completely

```sh
gnome-extensions disable fluid-smoke@edjenn1998.github.io
gnome-extensions uninstall fluid-smoke@edjenn1998.github.io
```

Your wallpaper should reappear immediately on disable. This probe installs no
services, helper binaries, GSettings schema, system files or persistent input
records. The source directory and `dist/` are ordinary local project files; remove
them manually if no longer wanted. No GNOME wallpaper setting needs restoration.

## Development and status

* `ARCHITECTURE.md`: evidence, selected candidate and fallback analysis.
* `TESTING.md`: local results and laptop acceptance checklist.
* `ROADMAP.md`: gated full-fluid implementation and preferences plan.
* `CHANGELOG.md`: development milestones.
* `extension/extension.js`: lifecycle entry point.
* `extension/shell/`: monitor/session and Clutter content management.
* `extension/core/`: pure coordinate mapping.
* `extension/gpu/`: Cogl targets, shader passes and presentation.
* `tests/`: isolated math and mocked session lifecycle; not compositor tests.
* `tools/package.py`: deterministic allowlisted ZIP builder.

No GitHub repository has been created or pushed. Authentication was confirmed for
`edjenn1998`; the intended repository did not resolve through the authenticated
CLI. Publication requires confirmation and a usable, validated implementation.
No final release or extensions.gnome.org submission will be made before personal
testing and maintainer review. AI-generated personal-use notices are included per
GNOME guidance. This project has no official GNOME approval.

## Privacy, license and acknowledgments

All original project code is **GPL-3.0-or-later**; see `LICENSE`. There is no
warranty. Runtime behavior is local: no network calls, telemetry, keystroke or
clipboard access, coordinate logging or saved movement history. Only the previous
pointer sample is retained transiently to connect movement between observations.

Thanks to GNOME Shell/Mutter and GJS documentation contributors. Hanabi's design
was studied for controlled renderer/background integration; ShaderPaper was
studied as a shader-wallpaper concept. No code/assets from those projects were
copied. Dependency and source references are recorded in `ARCHITECTURE.md`.
