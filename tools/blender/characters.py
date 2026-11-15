"""Traveller characters for the map, built from blocks.

The map draws a character as stacked extruded shapes (src/map/characters), so each
character here is a table of boxes. This script is the source of truth:

  1. builds the boxes in Blender (one collection per character and walk frame) for preview,
  2. writes src/map/characters/models.json, which the app imports.

Run inside Blender (MCP `execute_blender_code`):
    exec(open(r"<repo>/tools/blender/characters.py").read())

Units are the app's "design px" (1 unit = 1 screen px at any zoom): x right, y forward
(the heading), z up. Tones are colour names resolved in src/map/characters/tones.ts.
Re-running replaces only the collections this script created (prefix "OdysseyChar").
"""
import json
import os

import bpy

REPO = r"C:\Users\benos\Code\fight-or-flight-FE"
OUT = os.path.join(REPO, "src", "map", "characters", "models.json")
PREFIX = "OdysseyChar"

TONES = {
    "wood": (0.69, 0.48, 0.24),
    "woodDark": (0.43, 0.27, 0.13),
    "gold": (1.0, 0.8, 0.0),
    "iron": (0.2, 0.2, 0.23),
    "ironDark": (0.11, 0.11, 0.13),
    "ironLight": (0.31, 0.31, 0.35),
    "blade": (0.62, 0.62, 0.66),
    "crest": (0.6, 0.0, 0.0),
}


def box(tone, x0, x1, y0, y1, z0, z1):
    return {"tone": tone, "x": [x0, x1], "y": [y0, y1], "z": [z0, z1]}


def mirror(tone, x0, x1, y0, y1, z0, z1):
    """The same box on both sides of the centre line."""
    return [box(tone, x0, x1, y0, y1, z0, z1), box(tone, -x1, -x0, y0, y1, z0, z1)]


# ── Little wooden horse: a toy Trojan horse on a wheeled platform ──────────────
HORSE = [
    box("woodDark", -7, 7, -14, 14, 2, 4),       # platform
    *mirror("woodDark", 6, 9, 8, 13, 0, 5),      # front wheels
    *mirror("woodDark", 6, 9, -13, -8, 0, 5),    # back wheels
    *mirror("wood", 2, 5, 5, 9, 4, 13),          # front legs
    *mirror("wood", 2, 5, -10, -6, 4, 13),       # back legs
    box("wood", -5, 5, -11, 10, 13, 22),         # body
    box("gold", -5.5, 5.5, -4, 2, 22, 23.5),     # saddle cloth
    box("wood", -3, 3, 6, 11, 22, 30),           # neck
    box("wood", -3, 3, 9, 18, 27, 33),           # head
    box("woodDark", -1, 1, 3, 8, 22, 32),        # mane
    *mirror("woodDark", 1, 3, 9, 11, 33, 36),    # ears
    box("woodDark", -1.5, 1.5, -14, -11, 13, 23),  # tail
]


# ── Little warlord: all in black iron. Tall narrow red plume, broad shoulders, a cape to the
# ground that wraps the sides, twin chest discs, sword held point-down in front. Two walk frames.
def warrior(left_forward):
    lead, trail = (0, 5), (-4, 1)
    ly, ry = (lead, trail) if left_forward else (trail, lead)
    return [
        box("iron", -4, -1, ly[0], ly[1], 0, 13),        # left leg
        box("iron", 1, 4, ry[0], ry[1], 0, 13),          # right leg
        box("ironDark", -7.5, 7.5, -6.5, -3, 0, 26),     # cape, back
        *mirror("ironDark", 6, 8, -3, 1.5, 0, 24),       # cape, wrapping the sides
        box("iron", -5.5, 5.5, -3, 3, 13, 26),           # cuirass
        *mirror("gold", 1.5, 4, 3, 3.5, 21, 23.5),       # chest discs
        *mirror("ironLight", 5.5, 9, -3.5, 3.5, 23, 27.5),  # broad pauldrons
        *mirror("iron", 6, 8.5, 1, 4, 13, 23),           # forearms, brought forward to the hilt
        box("blade", -0.6, 0.6, 4, 5, 1, 17),            # sword, point down
        box("ironLight", -3, 3, 4, 5, 17, 18.5),         # crossguard
        box("ironLight", -3.5, 3.5, -3.5, 3.5, 26, 35),  # helmet
        box("ironDark", -0.8, 0.8, 3.5, 4, 27, 33),      # eye slit
        box("ironDark", -1.2, 1.2, -2.5, 2.5, 35, 39),   # plume holder
        box("crest", -1.2, 1.2, -4, 1.5, 39, 47),        # tall red plume
    ]


CHARACTERS = [
    {"id": "horse", "label": "Wooden horse", "strideM": 0, "frames": [HORSE]},
    {"id": "warrior", "label": "Trojan", "strideM": 0.7, "frames": [warrior(True), warrior(False)]},
]


def material(tone):
    name = f"{PREFIX}_{tone}"
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    r, g, b = TONES[tone]
    mat.diffuse_color = (r, g, b, 1.0)
    return mat


def build():
    for coll in [c for c in bpy.data.collections if c.name.startswith(PREFIX)]:
        for obj in list(coll.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(coll)
    built = {}
    offset = 0.0
    for ch in CHARACTERS:
        for f, boxes in enumerate(ch["frames"]):
            coll = bpy.data.collections.new(f"{PREFIX}_{ch['id']}_{f}")
            bpy.context.scene.collection.children.link(coll)
            for i, b in enumerate(boxes):
                mesh = bpy.data.meshes.new(f"{ch['id']}_{f}_{i}")
                (x0, x1), (y0, y1), (z0, z1) = b["x"], b["y"], b["z"]
                verts = [(x, y, z) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]
                faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
                mesh.from_pydata(verts, [], faces)
                mesh.materials.append(material(b["tone"]))
                obj = bpy.data.objects.new(mesh.name, mesh)
                obj.location = (offset, 0, 0)
                coll.objects.link(obj)
            built[coll.name] = len(boxes)
            offset += 40.0
    return built


def export():
    data = {"tones": {k: "#%02x%02x%02x" % tuple(round(c * 255) for c in v) for k, v in TONES.items()}, "characters": CHARACTERS}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(data, fh, indent=1)
        fh.write("\n")
    return OUT


result = {"built": build(), "wrote": export()}
