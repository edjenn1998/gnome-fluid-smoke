// SPDX-License-Identifier: GPL-3.0-or-later
// Optional development check: glslangValidator [path can be passed as argv[2]].
import {spawnSync} from 'node:child_process';
import * as shaders from '../extension/gpu/shaders.js';

for (const [name, shader] of Object.entries(shaders)) {
    const input = `#version 120
        uniform sampler2D cogl_sampler0;
        uniform sampler2D cogl_sampler1;
        uniform sampler2D cogl_sampler2;
        varying vec4 cogl_tex_coord_in[1];
        #define cogl_color_out gl_FragColor
        ${shader.declarations}
        void main() { ${shader.body} }
    `;
    const result = spawnSync(process.argv[2] ?? 'glslangValidator', ['--stdin', '-S', 'frag'],
        {input, encoding: 'utf8'});
    if (result.error || result.status !== 0)
        throw new Error(`${name}: ${result.error ?? result.stdout + result.stderr}`);
    console.log(`PASS GLSL 1.20: ${name}`);
}
