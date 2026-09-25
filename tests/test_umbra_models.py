"""The UMBRA T-Rex model the build embeds: well-formed, and carrying every bone the animation drives.

models/rex.json is written by models/prepare_rex.py; 24-rex-model.js names the bones it moves.
If the two drift apart (a re-export renames bones, a new model arrives), the game quietly falls
back to the procedural T-Rex. These tests make that visible.
"""

import base64
import json
import re
import struct
from pathlib import Path

import pytest

WEB = Path(__file__).resolve().parent.parent / "games" / "expedition-d05" / "web"
MODEL = WEB / "models" / "rex.json"
pytestmark = pytest.mark.skipif(not MODEL.is_file(), reason="UMBRA T-Rex model not present")


@pytest.fixture(scope="module")
def model():
    return json.loads(MODEL.read_text(encoding="utf-8"))


def raw(model, key):
    return base64.b64decode(model[key])


def test_arrays_match_the_vertex_count(model):
    n = model["count"]
    assert len(raw(model, "position")) == n * 12
    assert len(raw(model, "normal")) == n * 12
    assert len(raw(model, "uv")) == n * 8
    assert len(raw(model, "skinIndex")) == n * 4
    assert len(raw(model, "skinWeight")) == n * 4
    assert len(raw(model, "ibm")) == len(model["bones"]) * 64


def test_indices_stay_inside_the_mesh(model):
    ib = raw(model, "index")
    fmt = "I" if model["index32"] else "H"
    idx = struct.unpack(f"<{len(ib) // struct.calcsize(fmt)}{fmt}", ib)
    assert len(idx) % 3 == 0
    assert max(idx) < model["count"]


def test_four_influences_sum_to_one(model):
    w = raw(model, "skinWeight")
    j = raw(model, "skinIndex")
    nb = len(model["bones"])
    for v in range(model["count"]):
        assert sum(w[v * 4:v * 4 + 4]) == 255, f"vertex {v}"
        assert all(x < nb for x in j[v * 4:v * 4 + 4])


def test_bone_parents_form_one_tree(model):
    bones = model["bones"]
    roots = [i for i, b in enumerate(bones) if b["parent"] < 0]
    assert len(roots) == 1
    for i, b in enumerate(bones):
        seen, p = set(), i
        while p >= 0:
            assert p not in seen, f"cycle through bone {i}"
            seen.add(p)
            p = bones[p]["parent"]


def test_every_animated_bone_exists(model):
    src = (WEB / "src" / "24-rex-model.js").read_text(encoding="utf-8")
    block = src[src.index("const REX_BONES"):src.index("};", src.index("const REX_BONES"))]
    wanted = set(re.findall(r"'(Bone_\d+)'", block))
    assert len(wanted) > 30, "the bone table was not found"
    have = {b["name"] for b in model["bones"]}
    assert not wanted - have, f"missing bones: {sorted(wanted - have)}"


def test_textures_are_small_jpegs(model):
    for key in ("map", "normalMap", "roughnessMap"):
        url = model["maps"][key]
        assert url.startswith("data:image/jpeg;base64,")
        assert len(url) < 1_000_000, f"{key} is too large for the page"
