# Appearance presets

**Luminous Rolls & Billowing Clouds** is the standard. It combines the broad,
longer-lived flow and fine curls of Billowing Clouds with the brightness, glow,
smoothing and gentle lift of Luminous Rolls.

**Less Smoke** is the former Alpha.6 preset. It retains that preset's values:
narrower plumes, a ten-second fade and no optional lighting. Its source-strength
multiplier is unchanged; the smaller footprint and shorter lifetime produce the
lighter appearance.

## Recipes

The table lists the absolute values stored in GSettings. Preferences show each
numeric value minus the Standard column.

| Control | Standard | Less Smoke | Luminous Rolls | Billowing Clouds |
| --- | ---: | ---: | ---: | ---: |
| Smoke amount | 1.75 | 1.75 | 1.75 | 1.75 |
| Linger time, seconds | 18 | 10 | 14 | 18 |
| Plume width | 2.8 | 1 | 1.8 | 2.8 |
| Momentum spread | 1.8 | 2.5 | 2.2 | 1.8 |
| Rise | 1.5 | 6 | 1.5 | 0 |
| Swirl | 11 | 8 | 8 | 11 |
| Viscosity | .15 | .15 | .15 | .05 |
| Fine curls | .85 | 0 | .2 | .85 |
| Brightness | 2.4 | 1 | 2.4 | 2.1 |
| Glow | .4 | 0 | .4 | .25 |
| Fold shading | .65 | 0 | .35 | .65 |
| Color cycling speed | 2.5 | 1 | 1.6 | 2.5 |

All four presets use rainbow colors, with blue and pink as the saved custom-color
defaults. Applying a preset preserves your background mode and color. Resetting
restores the standard smoke and a solid black background.

## Adjusting a preset

The reference point stays fixed at the standard, even after applying a preset.
For example, Less Smoke shows **−8** for linger time, **−1.8** for plume width and
**−0.4** for glow. Setting any of those controls to zero restores that part of the
standard appearance.

Try a slow sweep, a broad circle and a sharp reversal, then stop for three seconds
to compare continued motion. Wait for idle clear before comparing fresh strokes.
Raise brightness to reveal faint wisps; raise amount to add dye; raise width to
spread the source. Those controls have different effects.

## Previews

The original photo and video references informed the separate luminous and
billowing presets. The renderer remains a two-dimensional density field: fold
shading suggests relief, and glow samples nearby dye. Neither adds depth layers.

With EGL/GLES3 available, generate previews in an existing directory:

```sh
python3 tools/preview_gpu.py dist --scenario fast --preset standard --label standard
python3 tools/preview_gpu.py dist --scenario fast --preset less-smoke --label less-smoke
python3 tools/preview_gpu.py dist --scenario sweep --preset luminous --label luminous
python3 tools/preview_gpu.py dist --scenario reversal --preset billowing --label billowing
```

Each strip shows the end of input, then one, two and three seconds later.
Offscreen previews exercise the production shaders and draw commands; desktop
appearance and frame pacing must be checked in GNOME.
