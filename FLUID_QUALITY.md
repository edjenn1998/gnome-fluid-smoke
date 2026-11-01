# Fluid-quality investigation

These measurements were recorded on 2026-10-27 while correcting the Alpha.5
renderer. They use the appearance now called **Less Smoke**, not the combined
standard introduced later. The solver corrections remain in the current renderer.

## Source width

Alpha.5 used the same narrow Gaussian for dye and momentum. At 320×180 its radius
was 1.62 flow cells, leaving the source shear poorly resolved. Raising emission
made the same narrow path denser.

The correction uses `max(1.5, minDimension * .014)` for dye and a separately
adjustable momentum radius. In Less Smoke, those are 2.52 and 6.3 flow cells at
320×180. Pointer forcing still relaxes toward a capped 120-cell/s impulse.

Changing only the momentum radius back to the dye radius reduced speed RMS after
three seconds from 14.35 to 7.68 cells/s and normalized shape change from 1.56 to
1.25. The wider driven area produced larger rolling structures in the previews.

## Pressure operators

Alpha.5 combined centered divergence and centered pressure gradient with a
nearest-neighbor Jacobi solve. In one dimension, the centered composition is:

```text
D0 G0 p[i] = (p[i+2] - 2*p[i] + p[i-2]) / 4
```

That does not match Jacobi's five-point Laplacian. More pressure iterations could
reduce the Poisson residual without removing the actual remaining divergence.

The corrected solver pairs backward divergence with forward gradient. Their
composition matches the pressure stencil. Stored velocity components are outgoing
cell fluxes for projection: incoming left/top wall fluxes are zero, and outgoing
right/bottom fluxes are explicitly zero. Advection and curl still sample a shared
velocity texture; this is not a fully staggered MAC grid.

Pressure is warm-started between substeps and cleared with all other fields on
reset. A 24-iteration budget was retained.

### Rapid-circle replay

Four turns over three seconds, followed by three seconds without input:

| Configuration | Divergence RMS at stop | RMS at +3s | Median ms/substep |
| --- | ---: | ---: | ---: |
| Alpha.5, cold 24 | .3469 | .2181 | .768 |
| Alpha.5, warm 24 | .3095 | .2161 | .758 |
| Alpha.5, cold 80 | .3171 | .2087 | 1.999 |
| Corrected, cold 24 | .5995 | .2006 | .756 |
| Corrected, warm 24 | .2583 | .0246 | .749 |
| Corrected, warm 48 | .2107 | .0152 | 1.300 |
| Corrected, warm 80 | .1703 | .0111 | 1.974 |

Before/after values use each solver's own operator at flow-cell centers. Applying
the same backward-flux divergence norm to both final fields gives .8514 for
Alpha.5 and .0246 for the corrected solver at +3s. Replacing only the corrected
divergence/project shaders with Alpha.5's gives .4804.

Timings are three sequential synchronized replays on Radeon 8060S/radeonsi at
320×180 flow and 640×360 dye. They include Python/GL submission and GPU completion,
but exclude compilation, image readback and desktop presentation. They are not
GNOME frame times. Forty-eight and eighty iterations cost 56 and 88 draws per
substep, versus 32 at twenty-four iterations.

The fixed solve is incomplete during changing forcing. A sharp reversal left
.5056 divergence at input stop, falling to .0369 after three seconds.

## Transport and curl

Midpoint velocity backtracing and a smoothed two-cell curl envelope replaced Euler
tracing and local-only confinement. At +3s, midpoint versus Euler gave curl RMS
2.71 versus 2.45; smoothed versus local confinement gave 2.71 versus 2.37.
Both alternatives still rolled. Source separation was the stronger visual change.

Buoyancy was reduced from 18 to 6 cells/s² per density unit in Less Smoke, with
density capped at 2 for the buoyancy force. Presets now tune that lift independently.
Fine curls blends the smoothed envelope with cell-scale confinement.

## Density and lighting

The old extinction `1-exp(-1.6*density)` reached 96% coverage at density 2.
Repeated source loading saturated overlapping strokes and jet heads.

The correction lowered source coefficient .45 to .28, attenuated new emission by
`exp(-existingDensity/.6)` and lowered extinction to 1.1. The density cap scales
RGB and density together. On a straight sweep, removing source attenuation raised
peak density from 1.22 to 4.0. On the fast-circle comparison, Alpha.5 peaked at
2.29 versus .69 for the corrected renderer, with total dye 9676 versus 5998.

Glow and fold lighting were added later as independent presentation controls. They
do not add smoke mass or depth layers. Current recipes are in
[REFERENCE_STYLES.md](REFERENCE_STYLES.md).

## Reproduction

`tools/compare_quality.py` fixes the appearance to Less Smoke and compares against
an Alpha.5 checkout using the same trajectory generator. It records sweep, slow
and fast circles, reversal, pressure budgets and individual-change ablations.

With the checkout and output directory already available:

```sh
python3 tools/compare_quality.py /path/to/previews --baseline /path/to/alpha5
```

Each strip shows input stop, +1s, +2s and +3s at identical exposure. Reports include
density, centroid, curl, common-flux divergence and synchronized replay timings.
The historical comparison archive is attached to the
[Alpha.6 release](https://github.com/edjenn1998/gnome-fluid-smoke/releases/tag/v0.2.0-alpha.6).

For current offscreen checks and native diagnostic views, see [TESTING.md](TESTING.md).
