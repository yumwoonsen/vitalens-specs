"""Build the ward preview source: a local copy of Lens Studio's Plane source carrying the ward.

The Interactive source renders behind the Lens across the whole preview, like the real room seen
through the glasses, and its camera is what lets the preview open it. Plane has one camera, one
floor mesh and one texture, so this swaps the mesh and texture and refreshes the checksums.

GAIN sets the level of this source, by multiplying Plane's material colour, so it is cheap to retune
here without rebaking. The preview composites additively, source plus Lens, and caps a source near half
brightness, so a plate shows whatever source is behind it. The bright ward inside the frame comes from
the Lens copy (showWardInLens). The dim area outside the frame is a preview artefact: leave it. Raising
GAIN brightens that area but makes plates paler and Code Blue's red pinker. See WARD21 before changing it.

Run from the repository root: python tools/build_ward_preview_source.py
Then in Preview choose Interactive > From Lens Folder > demo/ward/preview-source. The output copies
files from your Lens Studio install, so it stays out of git.
"""
import base64
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLANE = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\Program Files\Snap Inc\Lens Studio\InteractiveResources.bundle\Scenes\Plane")
PARTS = ROOT / "demo" / "ward" / "preview"
OUT = ROOT / "demo" / "ward" / "preview-source"
# One switch for the preview look, measured in WARD22 (docs/DECISIONS.md). Each preset is a GAIN here
# plus the showWardInLens input on VitaLens Main:
#   "contrast"        option C, the default: showWardInLens on, GAIN 0.75. Dark plates, dim sides.
#   "contrast-bright" showWardInLens on, GAIN 1.0. Sides 88-93 instead of 66-70, plates still dark;
#                     Code Blue's red not yet checked at this level (it went pinker at 0.9).
#   "uniform"         showWardInLens OFF, GAIN 1.35, the highest before white clips at the ~127 cap.
#                     No step at the frame edge, but every plate goes pale over the bright source.
PRESET = "contrast"
GAIN = {"contrast": 0.75, "contrast-bright": 1.0, "uniform": 1.35}[PRESET]
# Values in Plane's scene.scn: its material's colour, and the UV scale that tiles its grid. The palette
# needs a UV scale of 1, or each material samples another material's row.
BASE_COLOR_OFFSET = 4799
UV_SCALE_OFFSET = 4989

if not PLANE.is_dir():
    raise SystemExit(f"Plane source not found: {PLANE}. Pass its folder as the first argument.")
if OUT.exists():
    shutil.rmtree(OUT)
shutil.copytree(PLANE, OUT)
shutil.copyfile(PARTS / "WardBaked.mesh", next(OUT.rglob("Plane.mesh")))
shutil.copyfile(PARTS / "palette.png", next(OUT.rglob("Grid_100cm_Neutral_Tex.png")))

scene = OUT / "scene.scn"
data = bytearray(scene.read_bytes())
if struct.unpack_from("<4f", data, BASE_COLOR_OFFSET) != (1.0, 1.0, 1.0, 1.0) or struct.unpack_from("<2f", data, UV_SCALE_OFFSET) != (10.0, 10.0):
    raise SystemExit("Plane's scene.scn has changed in this Lens Studio version: find baseColor and uv2Scale again.")
struct.pack_into("<4f", data, BASE_COLOR_OFFSET, GAIN, GAIN, GAIN, 1.0)
struct.pack_into("<2f", data, UV_SCALE_OFFSET, 1.0, 1.0)
scene.write_bytes(data)

checksums = OUT / "checksum.json"
entries = json.loads(checksums.read_text())
for relative in entries:
    entries[relative] = base64.b64encode(hashlib.md5((OUT / relative).read_bytes()).digest()).decode()
checksums.write_text(json.dumps(entries, indent=4))
print(f"Ward preview source ready: {OUT}")
