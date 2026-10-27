#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Optional offscreen shader/numerical check. Requires EGL + GLES3, not GNOME.

Runs the actual shader bodies, replacing only Cogl's generated interface with
GLSL ES 3 equivalents. This does not validate GJS, Cogl or Shell integration.
Uses Python's standard library and Node; no Python packages or runtime downloads.
"""
import ctypes as C
import json
import math
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
FLOAT = C.c_float
UINT = C.c_uint
INT = C.c_int
PTR = C.c_void_p


def bind(library, name, result, *arguments):
    function = getattr(library, name)
    function.restype = result
    function.argtypes = arguments
    return function


class GPU:
    def __init__(self, width=96, height=64):
        self.width, self.height = width, height
        self.egl = C.CDLL("libEGL.so.1")
        self.gl = C.CDLL("libGLESv2.so.2")
        get_display = bind(self.egl, "eglGetPlatformDisplay", PTR, UINT, PTR, C.POINTER(C.c_ssize_t))
        self.display = get_display(0x31DD, None, None)  # EGL_PLATFORM_SURFACELESS_MESA
        initialize = bind(self.egl, "eglInitialize", UINT, PTR, C.POINTER(INT), C.POINTER(INT))
        major, minor = INT(), INT()
        assert initialize(self.display, C.byref(major), C.byref(minor)), "EGL initialization failed"
        assert bind(self.egl, "eglBindAPI", UINT, UINT)(0x30A0)
        attributes = (INT * 7)(0x3040, 0x0040, 0x3033, 0x0001, 0x3024, 8, 0x3038)
        config, count = PTR(), INT()
        choose = bind(self.egl, "eglChooseConfig", UINT, PTR, C.POINTER(INT), C.POINTER(PTR), INT, C.POINTER(INT))
        assert choose(self.display, attributes, C.byref(config), 1, C.byref(count)) and count.value
        create = bind(self.egl, "eglCreateContext", PTR, PTR, PTR, PTR, C.POINTER(INT))
        self.context = create(self.display, config, None, (INT * 3)(0x3098, 3, 0x3038))
        assert self.context, "OpenGL ES 3 context creation failed"
        assert bind(self.egl, "eglMakeCurrent", UINT, PTR, PTR, PTR, PTR)(
            self.display, None, None, self.context)
        self.functions = {}
        self.dimensions = {}
        signatures = {
            "glCreateShader": (UINT, UINT),
            "glShaderSource": (None, UINT, INT, C.POINTER(C.c_char_p), C.POINTER(INT)),
            "glCompileShader": (None, UINT),
            "glGetShaderiv": (None, UINT, UINT, C.POINTER(INT)),
            "glGetShaderInfoLog": (None, UINT, INT, C.POINTER(INT), C.c_char_p),
            "glCreateProgram": (UINT,),
            "glAttachShader": (None, UINT, UINT),
            "glLinkProgram": (None, UINT),
            "glGetProgramiv": (None, UINT, UINT, C.POINTER(INT)),
            "glGetProgramInfoLog": (None, UINT, INT, C.POINTER(INT), C.c_char_p),
            "glDeleteShader": (None, UINT),
            "glGenTextures": (None, INT, C.POINTER(UINT)),
            "glBindTexture": (None, UINT, UINT),
            "glTexParameteri": (None, UINT, UINT, INT),
            "glTexImage2D": (None, UINT, INT, INT, INT, INT, INT, UINT, UINT, PTR),
            "glGenFramebuffers": (None, INT, C.POINTER(UINT)),
            "glBindFramebuffer": (None, UINT, UINT),
            "glFramebufferTexture2D": (None, UINT, UINT, UINT, UINT, INT),
            "glCheckFramebufferStatus": (UINT, UINT),
            "glViewport": (None, INT, INT, INT, INT),
            "glUseProgram": (None, UINT),
            "glGetUniformLocation": (INT, UINT, C.c_char_p),
            "glUniform1i": (None, INT, INT),
            "glUniform1fv": (None, INT, INT, C.POINTER(FLOAT)),
            "glUniform2fv": (None, INT, INT, C.POINTER(FLOAT)),
            "glUniform3fv": (None, INT, INT, C.POINTER(FLOAT)),
            "glUniform4fv": (None, INT, INT, C.POINTER(FLOAT)),
            "glActiveTexture": (None, UINT),
            "glDrawArrays": (None, UINT, INT, INT),
            "glReadPixels": (None, INT, INT, INT, INT, UINT, UINT, PTR),
            "glGetError": (UINT,),
            "glGetString": (C.c_char_p, UINT),
        }
        for name, (result, *arguments) in signatures.items():
            self.functions[name] = bind(self.gl, name, result, *arguments)
        print("Offscreen renderer:", self.call("glGetString", 0x1F01).decode())
        self.shaders = json.loads(subprocess.check_output([
            "node", "--input-type=module", "--eval",
            "import * as s from './extension/gpu/shaders.js'; console.log(JSON.stringify(s));",
        ], cwd=ROOT))
        self.programs = {name: self.program(shader) for name, shader in self.shaders.items()}
        self.parameters = json.loads(subprocess.check_output([
            "node", "--input-type=module", "--eval",
            "import {DEFAULT_PARAMETERS as p} from './extension/core/simulation.js'; console.log(JSON.stringify(p));",
        ], cwd=ROOT))
        self.call("glViewport", 0, 0, width, height)

    def call(self, name, *args):
        return self.functions[name](*args)

    def shader(self, kind, source):
        shader = self.call("glCreateShader", kind)
        text = C.c_char_p(source.encode())
        self.call("glShaderSource", shader, 1, C.byref(text), None)
        self.call("glCompileShader", shader)
        status = INT()
        self.call("glGetShaderiv", shader, 0x8B81, C.byref(status))
        log = C.create_string_buffer(16384)
        self.call("glGetShaderInfoLog", shader, len(log), None, log)
        assert status.value, log.value.decode()
        return shader

    def program(self, shader):
        vertex = self.shader(0x8B31, """#version 300 es
            out vec2 fs_uv;
            void main() {
                vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
                fs_uv = p;
                gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
            }
        """)
        source = """#version 300 es
            precision highp float;
            uniform sampler2D cogl_sampler0;
            uniform sampler2D cogl_sampler1;
            uniform sampler2D cogl_sampler2;
            in vec2 fs_uv;
            out vec4 cogl_color_out;
        """ + shader["declarations"] + "\nvoid main() {\n" + shader["body"] + "\n}"
        source = source.replace("texture2D", "texture").replace("cogl_tex_coord_in[0].xy", "fs_uv")
        fragment = self.shader(0x8B30, source)
        program = self.call("glCreateProgram")
        for item in [vertex, fragment]:
            self.call("glAttachShader", program, item)
        self.call("glLinkProgram", program)
        status = INT()
        self.call("glGetProgramiv", program, 0x8B82, C.byref(status))
        log = C.create_string_buffer(16384)
        self.call("glGetProgramInfoLog", program, len(log), None, log)
        assert status.value, log.value.decode()
        for item in [vertex, fragment]:
            self.call("glDeleteShader", item)
        return program

    def target(self, data=None, width=None, height=None):
        width, height = width or self.width, height or self.height
        texture, framebuffer = UINT(), UINT()
        self.call("glGenTextures", 1, C.byref(texture))
        self.call("glBindTexture", 0x0DE1, texture)
        self.dimensions[texture.value] = (width, height)
        for parameter, value in [(0x2801, 0x2601), (0x2800, 0x2601),
                                 (0x2802, 0x812F), (0x2803, 0x812F)]:
            self.call("glTexParameteri", 0x0DE1, parameter, value)
        self.upload(texture.value, data)
        self.call("glGenFramebuffers", 1, C.byref(framebuffer))
        self.call("glBindFramebuffer", 0x8D40, framebuffer)
        self.call("glFramebufferTexture2D", 0x8D40, 0x8CE0, 0x0DE1, texture, 0)
        assert self.call("glCheckFramebufferStatus", 0x8D40) == 0x8CD5, "RGBA16F not renderable"
        return texture.value, framebuffer.value

    def upload(self, texture, data=None):
        width, height = self.dimensions[texture]
        data = data if data is not None else [0.0] * (width * height * 4)
        assert len(data) == width * height * 4
        values = (FLOAT * len(data))(*data)
        self.call("glBindTexture", 0x0DE1, texture)
        self.call("glTexImage2D", 0x0DE1, 0, 0x881A, width, height,
                  0, 0x1908, 0x1406, values)

    def draw(self, name, output, inputs, dt=1 / 60, **uniforms):
        assert output not in inputs
        program = self.programs[name]
        self.call("glUseProgram", program)
        self.call("glBindFramebuffer", 0x8D40, output[1])
        self.call("glViewport", 0, 0, *self.dimensions[output[0]])
        for i, target in enumerate(inputs):
            self.call("glActiveTexture", 0x84C0 + i)
            self.call("glBindTexture", 0x0DE1, target[0])
            location = self.call("glGetUniformLocation", program, f"cogl_sampler{i}".encode())
            self.call("glUniform1i", location, i)
        defaults = dict(fs_size=[self.width, self.height], fs_dt=[dt],
                        fs_dye_size=list(self.dimensions[inputs[1][0]] if len(inputs) > 1
                                         else self.dimensions[output[0]]),
                         fs_velocity_decay=[self.parameters['velocityDissipation']],
                         fs_dye_decay=[self.parameters['dyeDissipation']],
                         fs_viscosity=[self.parameters['viscosity']],
                         fs_vorticity=[self.parameters['vorticity']])
        defaults.update(uniforms)
        for key, values in defaults.items():
            location = self.call("glGetUniformLocation", program, key.encode())
            self.call(f"glUniform{len(values)}fv", location, 1, (FLOAT * len(values))(*values))
        self.call("glDrawArrays", 0x0004, 0, 3)
        assert self.call("glGetError") == 0, f"GL error after {name}"

    def read(self, target):
        width, height = self.dimensions[target[0]]
        result = (FLOAT * (width * height * 4))()
        self.call("glBindFramebuffer", 0x8D40, target[1])
        self.call("glReadPixels", 0, 0, width, height, 0x1908, 0x1406, result)
        assert self.call("glGetError") == 0, "Float readback failed"
        assert all(math.isfinite(value) for value in result), "Non-finite simulation state"
        return list(result)

    def close(self):
        bind(self.egl, "eglMakeCurrent", UINT, PTR, PTR, PTR, PTR)(self.display, None, None, None)
        bind(self.egl, "eglDestroyContext", UINT, PTR, PTR)(self.display, self.context)
        bind(self.egl, "eglTerminate", UINT, PTR)(self.display)


def rms(values):
    return math.sqrt(sum(v * v for v in values) / len(values))


def validate(gpu):
    w, h = gpu.width, gpu.height
    velocity = [gpu.target(), gpu.target()]
    dw, dh = w * 2, h * 2
    dye = [gpu.target(width=dw, height=dh), gpu.target(width=dw, height=dh)]
    dye_forward = gpu.target(width=dw, height=dh)
    pressure = [gpu.target(), gpu.target()]
    curl, divergence, scratch = gpu.target(), gpu.target(), gpu.target()

    def transport(dt=1 / 60, **injection):
        gpu.draw("advectDye", dye_forward, [velocity[0], dye[0]], dt)
        gpu.draw("correctDye", dye[1], [velocity[0], dye[0], dye_forward], dt, **injection)
        dye.reverse()

    def project(iterations=24):
        gpu.draw("divergence", divergence, [velocity[0]])
        gpu.upload(pressure[0][0])
        for _ in range(iterations):
            gpu.draw("pressure", pressure[1], [pressure[0], divergence])
            pressure.reverse()
        gpu.draw("project", velocity[1], [velocity[0], pressure[0]])
        velocity.reverse()

    # Exact zero is a fixed point, including all boundary cells.
    project()
    assert max(abs(value) for value in gpu.read(velocity[0])[0::4]) == 0

    # A localized divergent vector field, with no source at the walls.
    field = []
    for y in range(h):
        for x in range(w):
            dx, dy = x - w * 0.5, y - h * 0.5
            weight = math.exp(-(dx * dx + dy * dy) / 80)
            field.extend([dx * weight * 3, dy * weight * 3, 0, 1])
    gpu.upload(velocity[0][0], field)
    gpu.draw("divergence", divergence, [velocity[0]])
    before = rms(gpu.read(divergence)[0::4])
    project()
    gpu.draw("divergence", scratch, [velocity[0]])
    after = rms(gpu.read(scratch)[0::4])
    assert after < before * 0.8, (before, after)
    print(f"24-iteration projection divergence RMS: {before:.6f} -> {after:.6f}")
    # More iterations must improve the Poisson residual on this smooth field.
    def residual():
        p, d = gpu.read(pressure[0])[0::4], gpu.read(divergence)[0::4]
        errors = []
        for y in range(h):
            for x in range(w):
                at = lambda xx, yy: p[max(0, min(h - 1, yy)) * w + max(0, min(w - 1, xx))]
                errors.append(at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1)
                              - 4 * at(x, y) - d[y * w + x])
        return rms(errors)
    residual24 = residual()
    gpu.upload(velocity[0][0], field)
    project(80)
    residual80 = residual()
    assert residual80 < residual24
    print(f"Poisson residual RMS, 24 vs 80 iterations: {residual24:.6f} -> {residual80:.6f}")
    state = gpu.read(velocity[0])
    assert all(state[4 * (y * w + x)] == 0 for y in range(h) for x in [0, w - 1])
    assert all(state[4 * (y * w + x) + 1] == 0 for x in range(w) for y in [0, h - 1])

    # Uniform dye, no velocity/source: exponential fade should agree at 30/60 Hz.
    gpu.upload(velocity[0][0])
    decays = []
    for fps in [30, 60]:
        gpu.upload(dye[0][0], [0.5, 0.25, 0.1, 1] * (dw * dh))
        for _ in range(fps):
            transport(1 / fps,
                     fs_emit=[0], fs_radius=[2], fs_segment=[0, 0, 0, 0], fs_color=[1, 0, 0])
        decays.append(gpu.read(dye[0])[3])
    assert abs(decays[0] - decays[1]) < 0.025
    assert all(abs(value - math.exp(-gpu.parameters['dyeDissipation'])) < 0.025 for value in decays)
    print(f"One-second RGBA16F dye fade, 30/60 Hz: {decays}")

    # A dye packet in persistent uniform flow MUST travel, not just fade. Compare
    # normalized centroid and density shape so dissipation alone cannot pass.
    gpu.upload(velocity[0][0], [12, 0, 0, 1] * (w * h))
    packet = []
    for y in range(dh):
        for x in range(dw):
            density = math.exp(-((x - dw * 0.3) ** 2 + (y - dh * 0.5) ** 2) / 18)
            packet.extend([density, density * 0.3, 0, density])
    gpu.upload(dye[0][0], packet)

    def centroid(snapshot):
        density = snapshot[3::4]
        mass = sum(density)
        return (sum((i % dw) * v for i, v in enumerate(density)) / mass,
                sum((i // dw) * v for i, v in enumerate(density)) / mass)

    start = centroid(gpu.read(dye[0]))
    for _ in range(60):
        transport(fs_emit=[0], fs_radius=[2], fs_segment=[0, 0, 0, 0],
                  fs_color=[1, 0, 0], fs_amount=[0])
    end = centroid(gpu.read(dye[0]))
    assert abs(end[0] - start[0] - 24) < 1, (start, end)
    assert abs(end[1] - start[1]) < 0.1, (start, end)
    print(f"No-input dye packet centroid, +1s: {start} -> {end} (expected +24 dye cells)")

    # Explicit viscosity must diffuse momentum while preserving uniform fields.
    gpu.draw("diffuseVelocity", velocity[1], [velocity[0]])
    assert abs(gpu.read(velocity[1])[4 * (w * (h // 2) + w // 2)] - 12) < 0.02
    impulse_field = [0.0] * (w * h * 4)
    impulse_field[4 * (w * (h // 2) + w // 2)] = 12
    gpu.upload(velocity[0][0], impulse_field)
    gpu.draw("diffuseVelocity", velocity[1], [velocity[0]], fs_viscosity=[3])
    diffused = gpu.read(velocity[1])[0::4]
    assert 0 < max(diffused) < 12 and min(diffused) >= 0

    for target in velocity + dye:
        gpu.upload(target[0])
    # Two seconds with circular pointer forcing followed by two seconds of free flow.
    snapshots = []
    for frame in range(240):
        angle = frame * 0.08
        segment = [0.5 + 0.18 * math.cos(angle), 0.5 + 0.18 * math.sin(angle),
                   0.5 + 0.18 * math.cos(angle + 0.08), 0.5 + 0.18 * math.sin(angle + 0.08)]
        radius = max(4, min(w, h) * 0.055)
        injection = dict(fs_segment=segment, fs_emit=[int(frame < 120)], fs_radius=[radius])
        impulse = [(segment[2] - segment[0]) * w * 60, (segment[3] - segment[1]) * h * 60]
        gpu.draw("diffuseVelocity", velocity[1], [velocity[0]])
        velocity.reverse()
        gpu.draw("advectVelocity", velocity[1], [velocity[0], dye[0]],
                 **{**injection, 'fs_radius': [radius * 0.7]}, fs_impulse=impulse)
        velocity.reverse()
        gpu.draw("curl", curl, [velocity[0]])
        gpu.draw("confine", velocity[1], [velocity[0], curl])
        velocity.reverse()
        project()
        transport(**injection, fs_color=[1, 0.25, 0.6],
                   fs_amount=[3 * min(1, math.hypot(*impulse) / 60 / radius)])
        if frame in [119, 179, 239]:
            snapshots.append(gpu.read(dye[0]))
            speed = gpu.read(velocity[0])
            assert max(abs(value) for value in speed) < 1000
    densities = [sum(snapshot[3::4]) for snapshot in snapshots]
    assert densities[0] > densities[1] > densities[2] > 0, densities
    assert rms([a - b for a, b in zip(snapshots[0], snapshots[1])]) > 0.005
    centers = [centroid(snapshot) for snapshot in snapshots]
    assert math.dist(centers[0], centers[1]) > 0.5, centers
    normalized = [[v / mass for v in snap[3::4]] for snap, mass in zip(snapshots, densities)]
    shape_change = sum(abs(a - b) for a, b in zip(normalized[0], normalized[1]))
    assert shape_change > 0.1, shape_change
    gpu.draw("curl", curl, [velocity[0]])
    assert max(abs(value) for value in gpu.read(curl)[0::4]) > 0.01
    gpu.draw("presentation", scratch, [dye[0]], fs_opacity=[1])
    displayed = gpu.read(scratch)
    assert all(value == 1 for value in displayed[3::4])
    print(f"Smoke density totals after emission / +1s / +2s: {[round(v, 3) for v in densities]}")
    print(f"After input stops: dye centroids {centers}; normalized shape change L1 {shape_change:.3f}")
    # Zero dye presents exact black, including opaque alpha.
    gpu.upload(dye[0][0])
    gpu.draw("presentation", scratch, [dye[0]], fs_opacity=[1])
    assert all(v == 0 for i, v in enumerate(gpu.read(scratch)) if i % 4 != 3)
    print("PASS: all ten shaders; projection, walls, viscosity, fade, post-input transport, curls, finite state, black")


if __name__ == "__main__":
    instance = GPU()
    try:
        validate(instance)
    finally:
        instance.close()
