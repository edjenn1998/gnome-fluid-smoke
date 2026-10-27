#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Render production solver commands to PNGs, without GNOME or Python packages."""
import argparse
import json
import math
import os
from pathlib import Path
import struct
import subprocess
import zlib
import time

from validate_gpu import GPU, ROOT


def png(path, width, height, pixels):
    def chunk(kind, data):
        return (struct.pack('!I', len(data)) + kind + data
                + struct.pack('!I', zlib.crc32(kind + data)))
    rows = bytearray()
    for y in range(height):
        rows.append(0)
        for x in range(width):
            start = (y * width + x) * 4
            rows.extend(round(max(0, min(1, v)) * 255) for v in pixels[start:start + 3])
    path.write_bytes(b'\x89PNG\r\n\x1a\n'
                     + chunk(b'IHDR', struct.pack('!2I5B', width, height, 8, 2, 0, 0, 0))
                     + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b''))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path, help='Existing output directory')
    parser.add_argument('--scenario', choices=['sweep', 'slow', 'fast', 'circle', 'reversal'], default='sweep')
    parser.add_argument('--root', type=Path, default=ROOT, help='Shader/solver checkout to compare')
    parser.add_argument('--label', default='candidate')
    parser.add_argument('--pressure-iterations', type=int, default=24)
    parser.add_argument('--cold', action='store_true', help='Restart pressure each substep')
    parser.add_argument('--warm', action='store_true', help='Skip recorded pressure clears (historical solver comparison)')
    parser.add_argument('--benchmark', action='store_true', help='Also replay without snapshots, synchronized at end')
    parser.add_argument('--ablation', choices=['shared-source', 'centered-projection', 'euler', 'local-confinement', 'unrestricted-source'])
    parser.add_argument('--historical-root', type=Path, help='Alpha.5 shaders for centered-projection/local-confinement ablation')
    args = parser.parse_args()
    if not args.output.is_dir():
        parser.error('output directory must exist')
    if args.pressure_iterations < 24 or args.pressure_iterations % 2:
        parser.error('pressure iterations must be even and at least 24')
    recording = json.loads(subprocess.check_output(
        ['node', '--experimental-vm-modules', 'tools/preview_commands.js', args.scenario], cwd=ROOT,
        env={**os.environ, 'FLUID_ROOT': str(args.root.resolve())}))
    gpu = GPU(recording['width'], recording['height'], root=args.root)
    if args.ablation in ('centered-projection', 'local-confinement'):
        if not args.historical_root:
            parser.error('this ablation needs --historical-root')
        legacy = json.loads(subprocess.check_output([
            'node', '--input-type=module', '--eval',
            "import * as s from './extension/gpu/shaders.js'; console.log(JSON.stringify(s));"],
            cwd=args.historical_root))
        for name in (['divergence', 'project'] if args.ablation == 'centered-projection' else ['confine']):
            gpu.programs[name] = gpu.program(legacy[name])
    if args.ablation == 'euler':
        shader = dict(gpu.shaders['advectVelocity'])
        shader['body'] = shader['body'].replace('fs_dt * velocity(mid)', 'fs_dt * v')
        gpu.programs['advectVelocity'] = gpu.program(shader)
    if args.ablation == 'unrestricted-source':
        shader = dict(gpu.shaders['correctDye'])
        shader['body'] = shader['body'].replace(' * exp(-dye.a / 0.6)', '')
        gpu.programs['correctDye'] = gpu.program(shader)
    if args.ablation == 'shared-source':
        for c in recording['commands']:
            if c.get('name') == 'advectVelocity':
                c['uniforms']['fs_radius'][0] /= 2.5
    try:
        targets = [gpu.target(width=w, height=h) for w, h in recording['targets']]
        width, height = recording['width'] * 2, recording['height'] * 2
        screen = gpu.target(width=width, height=height)
        measure = gpu.target()
        snapshots, images = [], []
        previous = None
        pressure_index = 0
        started = time.perf_counter()
        draw_seconds = 0
        draws = 0
        for command in recording['commands']:
            if 'clear' in command:
                if args.warm and command['clear'] in (5, 6):
                    continue
                gpu.clear(targets[command['clear']])
            elif 'snapshot' in command:
                gpu.draw('presentation', screen, [targets[command['dye']]],
                         fs_opacity=[1], fs_dye_size=[width, height])
                pixels = gpu.read(screen)
                images.append(pixels)
                density = gpu.read(targets[command['dye']])[3::4]
                mass = sum(density)
                normalized = [d / mass for d in density]
                center = [sum((i % width) * d for i, d in enumerate(normalized)),
                          sum((i // width) * d for i, d in enumerate(normalized))]
                velocity = gpu.read(targets[command['velocity']])
                gpu.draw('curl', measure, [targets[command['velocity']]])
                curls = gpu.read(measure)[0::4]
                before = gpu.read(targets[command['divergence']])[0::4]
                gpu.draw('divergence', measure, [targets[command['velocity']]])
                after = gpu.read(measure)[0::4]
                rms = lambda a: math.sqrt(sum(v*v for v in a) / len(a))
                fw, fh = recording['width'], recording['height']
                flux_divergence = []
                for y in range(fh):
                    for x in range(fw):
                        i = 4*(y*fw+x)
                        right = velocity[i] if x < fw-1 else 0
                        bottom = velocity[i+1] if y < fh-1 else 0
                        left = velocity[i-4] if x else 0
                        top = velocity[i-4*fw+1] if y else 0
                        flux_divergence.append(right-left+bottom-top)
                snapshots.append(dict(afterStop=command['afterStop'], mass=mass,
                    peakDensity=max(density), centroid=center,
                    shapeL1FromStop=sum(abs(a-b) for a,b in zip(normalized, previous or normalized)),
                    speedRMS=rms([math.hypot(x,y) for x,y in zip(velocity[0::4], velocity[1::4])]),
                    curlRMS=rms(curls), divergenceBefore=rms(before), divergenceAfter=rms(after),
                    commonFluxDivergenceRMS=rms(flux_divergence),
                    brightPixelFraction=sum(max(pixels[i:i+3]) > 0.8 for i in range(0,len(pixels),4))/(width*height)))
                if previous is None:
                    previous = normalized
                path = args.output / f"{args.label}-{args.scenario}-{command['afterStop']}s.png"
                png(path, width, height, pixels)
                print(path)
            else:
                if command['name'] == 'pressure':
                    if pressure_index == 0 and args.cold:
                        for index in (5, 6):
                            gpu.clear(targets[index])
                    pressure_index += 1
                    # Even iteration counts preserve production ping-pong parity.
                start = time.perf_counter()
                gpu.draw(command['name'], targets[command['output']],
                         [targets[i] for i in command['inputs']], command['dt'],
                         **command['uniforms'])
                draw_seconds += time.perf_counter() - start
                draws += 1
                if command['name'] == 'pressure' and pressure_index == 24:
                    for _ in range((args.pressure_iterations - 24) // 2):
                        gpu.draw('pressure', targets[command['inputs'][0]],
                                 [targets[command['output']], targets[command['inputs'][1]]])
                        gpu.draw('pressure', targets[command['output']],
                                 [targets[i] for i in command['inputs']])
                        draws += 2
                    pressure_index = 0
        report = dict(label=args.label, scenario=args.scenario, root=str(args.root),
            pressureIterations=args.pressure_iterations, cold=args.cold,
            forceWarm=args.warm,
            ablation=args.ablation,
            elapsedSeconds=time.perf_counter()-started, submissionSeconds=draw_seconds,
            draws=draws, snapshots=snapshots)
        if args.benchmark:
            timings = []
            for _ in range(3):
                for target in targets:
                    gpu.clear(target)
                gpu.call('glFinish')
                start = time.perf_counter()
                index = 0
                for c in recording['commands']:
                    if 'snapshot' in c:
                        continue
                    if 'clear' in c:
                        if args.warm and c['clear'] in (5, 6):
                            continue
                        gpu.clear(targets[c['clear']])
                        continue
                    if c['name'] == 'pressure' and index == 0 and args.cold:
                        for p in (5, 6):
                            gpu.clear(targets[p])
                    gpu.draw(c['name'], targets[c['output']], [targets[i] for i in c['inputs']],
                             c['dt'], **c['uniforms'])
                    if c['name'] == 'pressure':
                        index += 1
                        if index == 24:
                            for _ in range((args.pressure_iterations - 24)//2):
                                gpu.draw('pressure', targets[c['inputs'][0]],
                                         [targets[c['output']], targets[c['inputs'][1]]])
                                gpu.draw('pressure', targets[c['output']], [targets[i] for i in c['inputs']])
                            index = 0
                gpu.call('glFinish')
                timings.append((time.perf_counter()-start)*1000/(360 if args.scenario in ['fast','slow','circle'] else 300))
            report['synchronizedReplayMsPerStep'] = timings
        (args.output / f'{args.label}-{args.scenario}.json').write_text(json.dumps(report, indent=2)+'\n')
        # Stop / +1s / +2s / +3s, left to right. No rescaling or exposure changes.
        sheet = []
        for y in range(height):
            for image in images:
                sheet.extend(image[y*width*4:(y+1)*width*4])
        png(args.output / f'{args.label}-{args.scenario}-strip.png', width*len(images), height, sheet)
    finally:
        gpu.close()


if __name__ == '__main__':
    main()
