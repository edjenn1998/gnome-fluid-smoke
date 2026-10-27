# Alpha.6 fluid-quality investigation — 2026-10-27

**Alpha test prerelease, numeric version 8. Native GNOME and visual acceptance
remain open.** The existing multipass Cogl renderer is retained.

## Findings and the focused correction

Reviewed `gpu/feedback.js`, `gpu/shaders.js`, `core/simulation.js`,
`shell/surface.js`, `shell/session.js`, the changelog, and tagged alpha.2–4 versus
alpha.5 (`b992561`). Also inspected the existing desktop/reference screenshots;
their exact installed build and input histories are not established.

### A. Injection and resolved shear

At 320×180, alpha.5's Gaussian radius is 1.62 flow cells; at 384×216 it is
1.944. That is the Gaussian e-folding radius, not a hard cutoff. Both dye and
momentum use it. The source is resolved by very few velocity cells, making
interpolation loss and small edge rolls disproportionately important. Increasing
emission paints the same thin path more densely, without widening its momentum
or entrainment region.

Alpha.6 uses `max(1.5, minDimension * .014)` for dye: 2.52 cells at 320×180.
Momentum uses 2.5 times that radius, 6.3 cells. It remains relaxation toward the
same capped 120-cell/s pointer impulse; the 180-cell/s pre-projection limiter is
unchanged. No random force or doubled pointer coupling is introduced.

A controlled shared-source ablation changes only that momentum radius back to
the dye radius. Its +3s speed RMS is 7.68 versus 14.35 cells/s for the candidate,
and normalized shape change from stop is 1.25 versus 1.56. The images show more
retention of the original ring with the shared source; the wider jet produces
larger entraining rolls. The velocity energy increase is expected from forcing
a wider region, and is not by itself visual acceptance.

### B. Projection: an operator mismatch, not just too few iterations

Alpha.5 uses centered divergence `D0` and centered gradient `G0`. In one dimension,

```
D0 G0 p[i] = (p[i+2] - 2*p[i] + p[i-2]) / 4
```

but its Jacobi pass solves the nearest-neighbor five-point Laplacian. Improving
that Poisson residual therefore does not necessarily remove actual divergence;
alternating cell-scale modes are especially poorly represented by centered
derivatives. The old smooth radial test is insufficient to reveal all of this.

Alpha.6 pairs backward divergence with forward gradient, whose composition is
exactly the existing five-point Laplacian. Pressure uses clamped Neumann wall
samples. Stored x/y components act as outgoing fluxes for projection: incoming
left/top wall fluxes are implicit zero, outgoing right/bottom wall fluxes are
explicit zero. This is a compatible projection on the existing texture layout,
**not a full staggered MAC-grid implementation**; advection and curl still sample
the shared velocity texture. Directional discretization error remains possible.

Pressure is retained as an initial guess between substeps; `clear()` still clears
both pressure targets on idle, suspension, monitor rebuild and reset. No extra
iterations or targets are needed in normal mode.

Rapid-circle production replay, four turns over 3s, followed by 3s without input:

| Pressure configuration | RMS divergence at stop | RMS divergence at +3s | Median synchronized ms/substep |
| --- | ---: | ---: | ---: |
| Alpha.5, original cold 24 | .3469 | .2181 | .768 |
| Alpha.5, warm 24 only | .3095 | .2161 | .758 |
| Alpha.5, cold 80 | .3171 | .2087 | 1.999 |
| Candidate, cold 24 | .5995 | .2006 | .756 |
| Candidate, warm 24 — selected | .2583 | .0246 | .749 |
| Candidate, warm 48 | .2107 | .0152 | 1.300 |
| Candidate, warm 80 | .1703 | .0111 | 1.974 |

Before/after measurements use each solver's own divergence operator **at flow-cell
centers**. They are not identical norms across different operators. The supplied
JSON/HTML also applies the same backward flux-divergence measurement to all final
fields: alpha.5 is .8514 at +3s, candidate .0246. Replacing just the candidate's
divergence/project shaders with alpha.5's leaves common divergence .4804 at +3s.
This isolates the operator issue from source/lighting changes.

Warm-starting alone does little for alpha.5's persistent mismatch. With compatible
operators it substantially improves projection of the broader jet. 48/80 iterations
further help, but take 56/88 draws per substep versus 32, without a proportionate
visual gain in these previews. Abrupt reversal still leaves .5056 divergence at
the stop frame, falling to .0369 at +3s: this bounded solve is not incompressible
to machine precision, particularly during changing forcing.

Timings are three sequential, synchronized full simulation replays on **Radeon
8060S / radeonsi**, 320×180 flow / 640×360 dye. They include Python/GL submission
and GPU completion, exclude compilation, image readback and desktop presentation.
They are not laptop or GNOME frame timings. Baseline clears use framebuffer clear,
not CPU texture re-upload, to avoid an artificial baseline penalty.

### C. Vorticity, circulation and transport

Cursor forcing creates shear at the jet boundary. Alpha.6's wider, resolved
envelope seeds larger rotational structures; buoyancy is reduced from 18 to 6
cells/s² per density unit, capped at density 2 rather than 3, so rise does not
dominate rolling motion. Velocity advection uses midpoint backtracing instead
of Euler tracing. Confinement samples a two-cell envelope and averages signed
curl before applying the usual curl-gradient force, keeping the swirl preference.

Controlled ablations retain all other candidate settings. At +3s, midpoint versus
Euler gives curl RMS 2.71 versus 2.45; smoothed versus original confinement gives
2.71 versus 2.37. Their images both still roll: these are modest supporting
changes, not a claim that either alone fixes smoke. Source separation is the
stronger visible change. No procedural displacement substitutes for advection.

### D. Density and presentation

Alpha.5's `1-exp(-1.6*density)` reaches 96% at density 2 and 99.8% at density 4.
Its increased default source loading makes overlapping strokes and jet heads
lose contrast. The moving source can catch its own dye and continually load it:
even the initial candidate reached the safety cap on a straight sweep.

Alpha.6 changes the source coefficient from .45 to .28, keeping the existing
user multiplier of 1.75. New emission is attenuated by `exp(-existingDensity/.6)`
after transport/decay, preventing repeated loading of an already-dense head.
It does not erase transported folds. The safety cap scales density-weighted RGB
and density together. Note that alpha.5's independent cap was mathematically
redundant for ideal RGB≤density≤4, but ratio-preserving limiting is more robust
to dense/perturbed states; it is not the main explanation for the old ribbons.

Presentation extinction is 1.1, with no low-density gamma amplification, halo or
synthetic specular lighting. On the straight-sweep ablation, removing only source
attenuation raises peak density from 1.22 to 4.0. In the fast-circle comparison,
alpha.5 peaks at 2.29, candidate at .69, with **less** total dye: 9676 versus 5998.
The candidate is selected for transport/roll structure, not brightness or quantity.

This remains a 2D density-weighted color mixture. Dark gaps and advected folds
can suggest translucent overlap; the solver does not represent depth-ordered
volumetric layers. In particular, faint +2/+3s wisps and short straight strokes
may be too dim on the laptop. Matching the supplied reference is not established.

## What the previous alphas establish

| Build | Relevant experiment | Assessment |
| --- | --- | --- |
| Alpha.2 | Narrow shared source, higher-resolution limited MacCormack dye, cold 24 projection | Genuine persistent fluid motion; limited resolved shear and operator mismatch remain. |
| Alpha.3 | Dye radius .055× smaller dimension, coefficient 3, slower decay, narrower momentum, halo/lighting | Large increase in visible loading and footprint plausibly explains filled bands; several simultaneous changes prevent single-cause attribution from screenshots. |
| Alpha.4 | Dye radius .028×.85, momentum radius .028×1.8, coefficient 1.2; doubled coupling, midpoint tracing, warm pressure, smoothed confinement and fold lighting | Source separation, midpoint and smoothing can help, but wider dye/loading, doubled momentum and lighting remain confounded. Warm-start-only replay does not reproduce a filled ribbon. |
| Alpha.5 | Reverted shaders/physics to alpha.2; added 1.75× emission and preferences | Concentrates more color in the old shared footprint; does not resolve projection or entrainment issues. |

The candidate selectively tests the useful ideas and corrects projection; it does
not restore alpha.4 as a bundle. No GNOME screenshot can be assigned a precise
numerical cause without its installed version, settings, timing and trajectory.

## Controlled visual evidence and reproduction

`dist/fluid-smoke-alpha6-comparisons.zip` contains a browsable `index.html`, PNGs,
and machine-readable metrics. Extract it and open `fluid-quality-comparisons/index.html`.
Each strip is stop / +1s / +2s / +3s, with identical scale and exposure.

* **Straight sweep:** thinner feed into a larger rolling head, translating and
  deforming after stopping. The feed/head is still recognizable; later dye is faint.
* **Slow circle:** fewer tiny scalloped coils and larger turning folds. The original
  circle still influences the distribution, but the head moves away after stopping.
* **Fast circle:** larger coherent rolls and smooth tendrils, changing position and
  shape throughout the three-second pause rather than only dimming in place.
* **Sudden reversal:** opposing momentum deforms the earlier feed, with a rolling
  head/tail after stopping; the newest feed remains briefly stroke-like.

Inputs: straight half-width sweep in 2s; one ellipse turn in 3s; four ellipse turns
in 3s; half-width out-and-back in 2s with instantaneous reversal. All use 60 Hz,
amount 1.75, viscosity .15, swirl 8, default rainbow phase and decay .65/s. The
same trajectory recorder loads alpha.5 and candidate production pass graphs.
Extra experiments isolate pressure budgets and five individual changes. All
76 snapshot images were generated; representative paired strips and ablations
were inspected. No visual acceptance is inferred just from shape-change metrics.

Reproduce in an existing output directory, with working EGL/GLES libraries:

```sh
git worktree add --detach /tmp/fluid-smoke-alpha5 v0.2.0-alpha.5
python3 tools/compare_quality.py /tmp/previews --baseline /tmp/fluid-smoke-alpha5
```

`--root` selects historical shaders/solver while retaining the same current
trajectory generator. `--cold`, `--warm`, `--pressure-iterations` and `--ablation`
are offline experiment controls, not shipped visual preferences.

## Native Cogl verification on CachyOS GNOME 51.1

There is no GNOME Shell executable/session in the development environment.
Hardware GLES and llvmpipe shader tests cannot prove Cogl sampler generation,
GI uniform marshalling, compositor timing or correct painting. Use the actual
laptop installation for the following diagnostic observations.

The hidden `debug-view` key is deliberately absent from the preferences UI. It
defaults to `normal`; these developer displays add no CPU/GPU pixel readback.
They retain the background actor, windows above it, input observation and lifecycle.

After installing, set the schema path in a terminal:

```sh
export GSETTINGS_SCHEMA_DIR="$HOME/.local/share/gnome-shell/extensions/fluid-smoke@edjenn1998.github.io/schemas"
gsettings set org.gnome.shell.extensions.fluid-smoke debug-view 'layers'
```

Move the pointer to wake the surface. Expect **three solid vertical red / green /
blue bands**, in that order. Each comes from a different 1×1 RGBA16F texture
containing a negative value in a different channel. The shader negates/rescales
it. Wrong/repeated bands or black point to sampler binding, signed texture,
shader/uniform delivery or presentation problems; do not compensate with tuning.

Switch views with the same command, replacing `layers` with:

| View | What to observe |
| --- | --- |
| `velocity` | Red = +x, green = −x, blue = absolute y velocity. A fast circle should leave a changing, circulating field after stopping. Black means zero; display scale is fixed. |
| `curl` | Orange versus blue marks opposite signed curl, recomputed from projected velocity. Coherent regions should persist and move during the three-second pause. |
| `density` | Scalar dye in grayscale, independent of rainbow tint. Watch advected features stretch and move, not simply disappear at fixed coordinates. |
| `divergence` | Full field before projection on the left, after on the right, at the same scale. Red/cyan are opposite signs; the right should be substantially darker, especially after input stops. It need not be black while forcing changes. |
| `normal` | Return to the actual wallpaper for visual acceptance. |

Diagnostics use two extra passes and one lazily allocated flow-size scratch
target for field views; the layer sentinel uses three 1×1 targets. Normal mode
retains 32 draws/substep, nine normal targets and no diagnostic passes/readback.
All diagnostic targets are owned by the simulation and released on teardown.

For CPU-side timing/planner inspection, open Looking Glass (`Alt+F2`, `lg`),
then inspect this expression in its evaluator:

```js
Main.extensionManager.lookup('fluid-smoke@edjenn1998.github.io').stateObj._session.surfaces.map(s => s.probe.diagnostics)
```

While a diagnostic view is active, sample before and after moving/stopping.
`frame` should advance, `input` become false after stopping, `elapsed` and
`integrated` should remain positive, and `substeps` should be 1 normally, at most
2 after stalls. `pressureIterations` is 24. No coordinates are logged. The
Looking Glass overlay may obscure the wallpaper, so use it to inspect timing,
then close it for visual observation. These fields show CPU submission intent,
not proof that the GPU received each uniform.

If the fields disagree with offscreen behavior, the next quantitative gate is a
**single native graphics frame capture** (for example RenderDoc on a suitable
isolated/nested GNOME 51 test session). Inspect RGBA16F velocity before/after
advection and projection, dye forward/corrected targets, curl, divergence and
pressure; verify distinct attachment/sampler IDs, flow/dye viewport dimensions,
the three-input correction pass, and actual `fs_dt`, `fs_size`, `fs_segment` and
`fs_emit` uniforms. Compute divergence RMS/pressure residual from captured arrays
offline, using the same stencils. Compare two captures after input stops to
establish persistent transport and curl. Capturing a compositor is environment-
dependent; this is a proposed verification procedure, not a completed capture.

Return to normal explicitly:

```sh
gsettings set org.gnome.shell.extensions.fluid-smoke debug-view 'normal'
```

## Install and visual acceptance

Copy `dist/fluid-smoke@edjenn1998.github.io.shell-extension.zip` to the laptop.
From its download directory:

```sh
gnome-extensions disable fluid-smoke@edjenn1998.github.io
gnome-extensions install --force fluid-smoke@edjenn1998.github.io.shell-extension.zip
```

**Log out and back in** to reload JavaScript on Wayland, then:

```sh
gnome-extensions enable fluid-smoke@edjenn1998.github.io
gnome-extensions info fluid-smoke@edjenn1998.github.io
gnome-extensions prefs fluid-smoke@edjenn1998.github.io
```

Expect `0.2.0-alpha.6` / numeric version 8. Existing preferences persist. For the
controlled baseline, use Reset to defaults (amount 1.75, linger 10, swirl 8,
viscosity .15, rainbow), and set the hidden diagnostic key back to normal.

Record rapid circular motion followed by **three seconds of completely stationary
input**. Assess motion, new rolls, stretching tendrils, internal transparency,
position/shape changes, fading and eventual exact black. Include a slow sweep and
reversal. Judge actual wallpaper appearance separately from diagnostic views.
Note whether +2/+3s wisps are too dim and whether the newest source remains too
concentrated. Also check windows above the effect, pointer observation over
windows, all monitors, live preferences, idle clear, lock/Overview, fullscreen
and disabling. Report GNOME version, GPU/driver, monitor sizes/scales and settings
with the clip. This alpha remains pending that visual/runtime acceptance.
