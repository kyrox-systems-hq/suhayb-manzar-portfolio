#!/usr/bin/env python3
from pathlib import Path
import base64, hashlib, zipfile
root = Path(__file__).resolve().parent
output = root.parent / "euphoria-revised-mockup-source.zip"
expected_sha = "eb87c8bb00c9d57abcc6b400ebb89721160d8bcd9be70b25be663c3099ad0367"
expected_files = ["index.html", "styles.css", "assets/hero.webp", "assets/store.webp", "assets/pivot1.webp", "assets/pivot2.webp", "assets/pivot3.webp", "assets/pivot4.webp"]
parts = sorted(root.glob("part-*.b64"))
if len(parts) != 4:
    raise SystemExit(f"Expected 4 parts, found {len(parts)}")
raw = base64.b64decode("".join(p.read_text().strip() for p in parts), validate=True)
actual_sha = hashlib.sha256(raw).hexdigest()
if actual_sha != expected_sha:
    raise SystemExit(f"SHA-256 mismatch: {actual_sha}")
output.write_bytes(raw)
with zipfile.ZipFile(output) as zf:
    if zf.namelist() != expected_files:
        raise SystemExit(f"Unexpected entries: {zf.namelist()}")
    bad = zf.testzip()
    if bad:
        raise SystemExit(f"Corrupt member: {bad}")
print(output)
print(actual_sha)
