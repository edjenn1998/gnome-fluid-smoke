# Remaining work

## Desktop integration

- Add explicit display-power suspension outside the screen-shield path.
- Stress-test monitor hotplug, mixed scaling, portrait layouts and suspend/resume.
- Check wallpaper reloads and compatibility with desktop-icon extensions.
- Profile memory after extended use and repeated enable/disable cycles.

## Performance

- Measure Shell frame pacing, CPU/GPU load and memory on target hardware.
- Compare the standard lighting with Less Smoke, especially on integrated GPUs.
- Use those measurements to choose quality levels and pressure budgets.
- Investigate event-driven idle wakeups and fully obscured monitor suspension.

## Appearance

- Evaluate the combined standard on GNOME 51 with slow strokes, circles and reversals.
- Check whether finer grids improve wisps enough to justify their cost.
- Keep source strength, exposure and plume width independently adjustable.

Current implementation details are in [ARCHITECTURE.md](ARCHITECTURE.md).
Desktop test procedures are in [TESTING.md](TESTING.md).
