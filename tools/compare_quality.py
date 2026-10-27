#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Generate paired production-solver previews and a browsable measured report."""
import argparse
import html
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path, help='Existing output directory')
    parser.add_argument('--baseline', type=Path, required=True, help='Unmodified alpha.5 checkout')
    args = parser.parse_args()
    if not args.output.is_dir():
        parser.error('output directory must exist')
    reports = []

    def run(label, scenario, root, *options):
        subprocess.run(['python3', 'tools/preview_gpu.py', str(args.output.resolve()),
                        '--root', str(root.resolve()), '--scenario', scenario,
                        '--label', label, *options], cwd=ROOT, check=True)
        report = json.loads((args.output / f'{label}-{scenario}.json').read_text())
        reports.append(report)

    # Same trajectory generator, dimensions, dt, color phase and preference values.
    for scenario in ['sweep', 'slow', 'fast', 'reversal']:
        for label, root in [('alpha5', args.baseline), ('candidate', ROOT)]:
            run(label, scenario, root, *(['--benchmark'] if scenario == 'fast' else []))
    # Sequential benchmark runs avoid inter-process GPU contention.
    for label, root, options in [
        ('cold24', ROOT, ['--cold']),
        ('warm48', ROOT, ['--pressure-iterations', '48']),
        ('warm80', ROOT, ['--pressure-iterations', '80']),
        ('alpha5-warm24', args.baseline, ['--warm']),
        ('alpha5-cold80', args.baseline, ['--pressure-iterations', '80']),
    ]:
        run(label, 'fast', root, '--benchmark', *options)
    for ablation in ['shared-source', 'centered-projection', 'euler', 'local-confinement', 'unrestricted-source']:
        run(ablation, 'fast', ROOT, '--ablation', ablation,
            '--historical-root', str(args.baseline.resolve()))
    run('unrestricted-source', 'sweep', ROOT, '--ablation', 'unrestricted-source')
    (args.output / 'metrics.json').write_text(json.dumps(reports, indent=2)+'\n')
    page = ['<!doctype html><meta charset="utf-8"><title>Fluid Smoke alpha.6 comparisons</title>',
            '<style>body{background:#181818;color:#ddd;font:16px sans-serif;margin:2em}img{width:100%;max-width:1600px}td,th{padding:.4em;border:1px solid #555}table{border-collapse:collapse}</style>',
            '<h1>Fluid Smoke: alpha.5 versus alpha.6 candidate</h1>',
            '<p>Each strip: input stops, +1 second, +2 seconds, +3 seconds. Identical input and exposure; 320×180 flow / 640×360 dye, 60 Hz. Slow circle: one turn in 3s; fast: four turns in 3s. Sweep/reversal: 2s input. Defaults: amount 1.75, swirl 8, viscosity .15, linger 10s.</p>',
            '<p>2D density visualization, not volumetric smoke. Offscreen evidence does not establish GNOME/Cogl equivalence or laptop visual acceptance. Timing includes Python/GL submission and synchronized GPU completion, excludes screenshots, compilation and presentation; it is not Shell frame time. Before/after divergence uses each solver’s own operator at flow-cell centers; common flux divergence applies the same backward operator to every final field.</p>']
    for report in reports:
        label, scenario = report['label'], report['scenario']
        page.append(f'<h2>{html.escape(label)} — {scenario}</h2><img src="{label}-{scenario}-strip.png">')
        if 'synchronizedReplayMsPerStep' in report:
            page.append('<p>Synchronized ms/step, three runs: '+
                        ', '.join(f'{v:.3f}' for v in report['synchronizedReplayMsPerStep'])+'</p>')
        page.append('<table><tr><th>Seconds after stop<th>Density mass<th>Peak density<th>Speed RMS<th>Curl RMS<th>Divergence before → after<th>Common flux divergence<th>Normalized shape L1 from stop')
        for s in report['snapshots']:
            page.append(f'<tr><td>{s["afterStop"]}<td>{s["mass"]:.1f}<td>{s["peakDensity"]:.3f}'
                        f'<td>{s["speedRMS"]:.3f}<td>{s["curlRMS"]:.3f}'
                        f'<td>{s["divergenceBefore"]:.4f} → {s["divergenceAfter"]:.4f}'
                        f'<td>{s["commonFluxDivergenceRMS"]:.4f}'
                        f'<td>{s["shapeL1FromStop"]:.3f}')
        page.append('</table>')
    (args.output / 'index.html').write_text('\n'.join(page)+'\n')
    print(args.output / 'index.html')


if __name__ == '__main__':
    main()
