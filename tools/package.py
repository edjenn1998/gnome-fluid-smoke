#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Build a deterministic, source-only GNOME extension archive; no installation."""
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "metadata.json", "extension.js", "core/coordinates.js", "gpu/shaders.js",
    "gpu/feedback.js", "shell/surface.js", "shell/session.js",
]


def main():
    metadata = json.loads((ROOT / "extension/metadata.json").read_text())
    output = ROOT / "dist" / f"{metadata['uuid']}.shell-extension.zip"
    output.parent.mkdir(exist_ok=True)
    with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
        for name in sorted([*FILES, "LICENSE"]):
            source = ROOT / "LICENSE" if name == "LICENSE" else ROOT / "extension" / name
            info = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, source.read_bytes())
    with ZipFile(output) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == {*FILES, "LICENSE"}
    print(f"Package: {output}")
    print(f"SHA256: {hashlib.sha256(output.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    main()
