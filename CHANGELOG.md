# Changelog

## 0.2.0-alpha.1 — 2026-10-27 (first fluid prerelease)

* Replaced the two-pass feedback trail with GPU velocity, pressure and RGB
  dye/density fields: advection, buoyancy, curl, vorticity confinement,
  divergence, 24 Jacobi iterations and pressure-gradient projection.
* Added soft density-based presentation and a smoothly changing RGB palette.
* Bounded timesteps, pointer impulse and catch-up work; partitioned pointer
  injection across substeps. Kept conservative 384-pixel grids and idle cleanup.
* Preserved the poc.2 GNOME 51 compositor fix, error rollback and session guards.
* Added solver planning/pass-graph/allocation tests and optional GLSL/offscreen
  GPU numerical validation. Local checks pass; see `TESTING.md` for evidence.
* The user reported working poc.2 visuals. The new fluid alpha still requires
  on-device visual/performance testing; published as a prerelease by request.

## 0.1.0-poc.2 — 2026-10-27 (unpublished compatibility fix)

* Fixed startup at `shell/session.js:23`: replaced removed
  `Meta.is_wayland_compositor()` with the nullable compositor getter on
  `global.context`; removed the unused Meta import.
* Audited the remaining probe APIs against GNOME 51 documentation and Shell
  source; recorded the scope and remaining runtime validation in `ARCHITECTURE.md`.
* Signal callback failures now log and tear down the probe like timer failures.
  Cogl-context acquisition and initial reset are inside rebuild rollback handling.
* Added regression coverage for null compositor, extension startup rollback,
  context failure during hotplug, suspension reset failure and polling failure.
* Added identifiable extension version metadata and explicit update instructions.
* Local syntax/lint and all 11 isolated tests pass. No GNOME Shell/GPU execution
  was performed here; laptop acceptance remains required before a fluid solver.

## 0.1.0-poc.1 — 2026-10-27 (unpublished architecture probe)

* Investigated GNOME 51 ShaderEffect replacement, Cogl float offscreens,
  pointer tracking, background layering and existing wallpaper designs.
* Added candidate native two-pass GPU feedback experiment per logical monitor,
  signed-storage sentinel and non-reactive Clutter background content.
* Added coordinate mapping, lifecycle teardown, monitor rebuild and suspension
  paths, isolated tests and deterministic source-only extension packaging.
* Added architecture, installation, laptop validation and gated development docs.
* Full fluid solver and preferences intentionally await the technical proof gate.
* No live GNOME compatibility or performance result claimed; no public release.
