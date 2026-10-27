#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Render production solver commands to PNGs, without GNOME or Python packages."""
import argparse
import json
from pathlib import Path
import struct
import subprocess
import zlib

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
    parser.add_argument('--scenario', choices=['sweep', 'slow', 'fast', 'circle'], default='sweep')
    args = parser.parse_args()
    if not args.output.is_dir():
        parser.error('output directory must exist')
    recording = json.loads(subprocess.check_output(
        ['node', '--experimental-vm-modules', 'tools/preview_commands.js', args.scenario], cwd=ROOT))
    gpu = GPU(recording['width'], recording['height'])
    try:
        targets = [gpu.target(width=w, height=h) for w, h in recording['targets']]
        width, height = recording['width'] * 2, recording['height'] * 2
        screen = gpu.target(width=width, height=height)
        for command in recording['commands']:
            if 'clear' in command:
                gpu.upload(targets[command['clear']][0])
            elif 'snapshot' in command:
                gpu.draw('presentation', screen, [targets[command['dye']]],
                         fs_opacity=[1], fs_dye_size=[width, height])
                path = args.output / f"smoke-{args.scenario}-{command['snapshot']:03d}.png"
                png(path, width, height, gpu.read(screen))
                print(path)
            else:
                gpu.draw(command['name'], targets[command['output']],
                         [targets[i] for i in command['inputs']], command['dt'],
                         **command['uniforms'])
    finally:
        gpu.close()


if __name__ == '__main__':
    main()
