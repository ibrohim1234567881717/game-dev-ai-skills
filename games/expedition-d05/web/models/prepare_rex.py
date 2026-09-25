#!/usr/bin/env python3
"""Turn the author's Meshy T-Rex into the compact model the game embeds.

    python games/expedition-d05/web/models/prepare_rex.py

Reads assets/meshy/trext.glb (57 MB: its colour texture alone is 8192 x 8192) and writes
models/rex.json (about 1.5 MB), which build.py embeds as window.MODEL_REX:

- textures scaled down to what a browser game shows (colour 1024, normal 1024, roughness 512)
  and stored as JPEG data: URLs;
- the skin cut from twelve bone influences per vertex to the four three.js supports: the four
  strongest are kept and their weights renormalised, stored as bytes;
- vertices, normals, UVs, indices and inverse bind matrices as base64 typed arrays;
- the joints in skin order, each with its parent's index and its rest translation, rotation and
  scale.

Only what this export contains is supported: one mesh, one primitive, one skin, an armature node
without its own transform. Anything else stops the script instead of producing a broken model.

Development-time only: it needs Pillow, nothing at runtime imports it.
"""

from __future__ import annotations

import base64
import io
import json
import struct
import sys
from array import array
from pathlib import Path

from PIL import Image, ImageStat

HERE = Path(__file__).resolve().parent
SRC = HERE.parent.parent / "assets" / "meshy" / "trext.glb"
OUT = HERE / "rex.json"
SIZES = {"map": 1024, "normalMap": 1024, "roughnessMap": 512}
COMP = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def load(path: Path):
    data = path.read_bytes()
    magic, _version, _length = struct.unpack("<III", data[:12])
    if magic != 0x46546C67:
        sys.exit(f"{path}: not a GLB file")
    jlen, _ = struct.unpack("<II", data[12:20])
    gltf = json.loads(data[20:20 + jlen])
    blen, _ = struct.unpack("<II", data[20 + jlen:28 + jlen])
    return gltf, data[28 + jlen:28 + jlen + blen]


def accessor(gltf, bin_, i):
    a = gltf["accessors"][i]
    bv = gltf["bufferViews"][a["bufferView"]]
    code, size = COMP[a["componentType"]]
    n = NCOMP[a["type"]]
    if bv.get("byteStride", size * n) != size * n:
        sys.exit("interleaved buffers are not supported")
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    arr = array(code)
    arr.frombytes(bin_[start:start + a["count"] * n * size])
    return arr, n


def b64(arr) -> str:
    return base64.b64encode(arr.tobytes()).decode("ascii")


def image(gltf, bin_, tex_index, size, grey=False) -> tuple[str, Image.Image]:
    src = gltf["images"][gltf["textures"][tex_index]["source"]]
    bv = gltf["bufferViews"][src["bufferView"]]
    raw = bin_[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
    im = Image.open(io.BytesIO(raw)).convert("RGB").resize((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=88, optimize=True, progressive=False)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii"), im


def main() -> None:
    gltf, bin_ = load(SRC)
    if len(gltf["meshes"]) != 1 or len(gltf["meshes"][0]["primitives"]) != 1 or len(gltf.get("skins", [])) != 1:
        sys.exit("expected one mesh with one primitive and one skin")
    nodes = gltf["nodes"]
    mesh_node = next(n for n in nodes if "mesh" in n)
    for n in nodes:
        if ("mesh" in n or n.get("name") == "UniRigArmature") and any(k in n for k in ("translation", "rotation", "scale", "matrix")):
            sys.exit(f"node {n.get('name')} has its own transform: not supported")
    prim = gltf["meshes"][0]["primitives"][0]
    at = prim["attributes"]
    pos, _ = accessor(gltf, bin_, at["POSITION"])
    nrm, _ = accessor(gltf, bin_, at["NORMAL"])
    uv, _ = accessor(gltf, bin_, at["TEXCOORD_0"])
    idx, _ = accessor(gltf, bin_, prim["indices"])
    count = len(pos) // 3

    # twelve influences -> the four strongest, renormalised to bytes that sum to 255
    joints = [accessor(gltf, bin_, at[f"JOINTS_{k}"])[0] for k in range(3) if f"JOINTS_{k}" in at]
    weights = [accessor(gltf, bin_, at[f"WEIGHTS_{k}"])[0] for k in range(3) if f"WEIGHTS_{k}" in at]
    sk_i, sk_w = array("B"), array("B")
    dropped = 0.0
    for v in range(count):
        pairs = []
        for J, W in zip(joints, weights):
            for c in range(4):
                w = W[v * 4 + c]
                if w > 0:
                    pairs.append((w, J[v * 4 + c]))
        pairs.sort(reverse=True)
        total = sum(w for w, _ in pairs) or 1.0
        top = pairs[:4]
        dropped = max(dropped, 1 - sum(w for w, _ in top) / total)
        s = sum(w for w, _ in top) or 1.0
        q = [round(w / s * 255) for w, _ in top]
        if q:
            q[0] += 255 - sum(q)  # rounding: the strongest influence absorbs the remainder
        while len(top) < 4:
            top.append((0.0, 0))
            q.append(0)
        for (w, j), qq in zip(top, q):
            sk_i.append(j)
            sk_w.append(max(0, qq))

    skin = gltf["skins"][0]
    order = skin["joints"]
    where = {node: k for k, node in enumerate(order)}
    parent_of = {}
    for i, n in enumerate(nodes):
        for c in n.get("children", []):
            parent_of[c] = i
    bones = []
    for node in order:
        n = nodes[node]
        p = parent_of.get(node)
        bones.append({
            "name": n.get("name", f"joint{node}"),
            "parent": where.get(p, -1),
            "t": [round(x, 6) for x in n.get("translation", [0, 0, 0])],
            "r": [round(x, 7) for x in n.get("rotation", [0, 0, 0, 1])],
            "s": [round(x, 6) for x in n.get("scale", [1, 1, 1])],
        })
    ibm, _ = accessor(gltf, bin_, skin["inverseBindMatrices"])

    m = gltf["materials"][0]
    pbr = m.get("pbrMetallicRoughness", {})
    maps = {}
    maps["map"], _ = image(gltf, bin_, pbr["baseColorTexture"]["index"], SIZES["map"])
    maps["normalMap"], _ = image(gltf, bin_, m["normalTexture"]["index"], SIZES["normalMap"])
    maps["roughnessMap"], mr = image(gltf, bin_, pbr["metallicRoughnessTexture"]["index"], SIZES["roughnessMap"])
    # glTF packs roughness in G and metalness in B; a dinosaur has no metal, so only G is used
    metal = ImageStat.Stat(mr).mean[2] / 255
    if metal > 0.05:
        print(f"warning: the metalness channel averages {metal:.2f}; the game renders the model as non-metal")

    xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
    model = {
        "v": 1,
        "source": "assets/meshy/trext.glb (Meshy, CC BY 4.0)",
        "count": count,
        "bounds": [[min(xs), min(ys), min(zs)], [max(xs), max(ys), max(zs)]],
        "position": b64(pos), "normal": b64(nrm), "uv": b64(uv),
        "index": b64(array("H", idx)) if max(idx) < 65536 else b64(array("I", idx)),
        "index32": max(idx) >= 65536,
        "skinIndex": b64(sk_i), "skinWeight": b64(sk_w),
        "bones": bones, "ibm": b64(ibm),
        "doubleSided": bool(m.get("doubleSided")),
        "maps": maps,
    }
    OUT.write_text(json.dumps(model, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT.relative_to(HERE.parent.parent)}: {count} vertices, {len(idx) // 3} triangles, {len(bones)} bones, "
          f"{OUT.stat().st_size / 1048576:.2f} MB (largest weight dropped by the 4-influence cut: {dropped:.1%})")


if __name__ == "__main__":
    main()
