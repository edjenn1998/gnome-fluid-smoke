#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Build a deterministic GNOME extension archive with compiled settings; no installation."""
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "metadata.json", "extension.js", "prefs.js", "core/settings.js",
    "schemas/org.gnome.shell.extensions.fluid-smoke.gschema.xml",
    "core/coordinates.js", "core/simulation.js", "gpu/shaders.js",
    "gpu/feedback.js", "shell/surface.js", "shell/session.js",
]


def main():
    metadata = json.loads((ROOT / "extension/metadata.json").read_text())
    output = ROOT / "dist" / f"{metadata['uuid']}.shell-extension.zip"
    output.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="fluid-smoke-schemas-") as temporary:
        subprocess.run(["glib-compile-schemas", "--strict", f"--targetdir={temporary}",
                        str(ROOT / "extension/schemas")], check=True)
        sources = {name: (ROOT / "extension" / name).read_bytes() for name in FILES}
        sources["LICENSE"] = (ROOT / "LICENSE").read_bytes()
        sources["schemas/gschemas.compiled"] = (Path(temporary) / "gschemas.compiled").read_bytes()
    with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
        for name, data in sorted(sources.items()):
            info = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    with ZipFile(output) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == set(sources)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_name("SHA256SUMS").write_text(f"{digest}  {output.name}\n")
    print(f"Package: {output}")
    print(f"SHA256: {digest}")


if __name__ == "__main__":
    main()
