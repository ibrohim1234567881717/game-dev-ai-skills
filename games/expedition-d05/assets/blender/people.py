"""06–10: the expedition team. A-pose (arms 48° from vertical) so the meshes rig cleanly.

Every body is built at 1.80 m and scaled to the character's height on join.
Front faces -Y, feet on Z = 0. Parts overlap rather than weld: that is fine for
skinning, and each garment keeps its own material for Godot.
"""

import math

import mathutils

from lib import Asset, apply_modifiers, box, cyl, loft, mat, mesh_from, sphere, torus, tube

ARM = math.radians(48)


def _lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def _smooth(ob, levels=1):
    sub = ob.modifiers.new("Sub", "SUBSURF")
    sub.levels = levels
    apply_modifiers(ob)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def _tube(P, pts, radii, m, seg=12, levels=1, name="limb"):
    return _smooth(tube(pts, radii, m=m, parts=P, seg=seg, name=name), levels)


def _ellipsoid(P, center, direction, length, width, thick, m, seg=14, rings=8):
    """Ellipsoid whose long axis follows `direction`; `thick` is the axis nearest world Z."""
    d = mathutils.Vector(direction).normalized()
    ob = sphere(1.0, center, scale=(width, thick, length), m=m, parts=P, seg=seg, rings=rings)
    ob.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    return ob


def arm_joints(s, sw=1.0):
    sh = (s * 0.19 * sw, 0.0, 1.405)
    d = (s * math.sin(ARM), 0.0, -math.cos(ARM))
    el = (sh[0] + d[0] * 0.29, -0.012, sh[2] + d[2] * 0.29)
    wr = (el[0] + d[0] * 0.26, -0.04, el[2] + d[2] * 0.26)
    return sh, el, wr, d


# ------------------------------------------------------------------ body
def body(P, c, female=False, sw=1.0, sleeves="long", tuck=True):
    """Base figure. c = materials: skin, top, pants, boots, sole, sleeve (optional)."""
    k = (0.9 if female else 1.0) * sw
    hip = 1.05 if female else 1.0
    waist = 0.9 if female else 1.0
    bust = 0.016 if female else 0.0
    upper = [
        (1.0, 0, 0, 0.162 * hip, 0.104, 2.4), (1.07, 0, 0, 0.148 * waist, 0.1, 2.4), (1.18, 0, -0.003, 0.162 * k, 0.11, 2.4),
        (1.28, 0, -0.008 - bust / 2, 0.18 * k, 0.12 + bust, 2.4), (1.36, 0, -0.004, 0.186 * k, 0.114, 2.4),
        (1.42, 0, 0.004, 0.168 * k, 0.094, 2.6), (1.46, 0, 0.01, 0.105, 0.074, 2.2), (1.49, 0, 0.012, 0.062, 0.06, 2.0),
    ]
    loft(upper, m=c["top"], parts=P, name="torso", axis="Z", seg=20, levels=1)
    lower = [(0.8, 0, 0, 0.125 * hip, 0.088, 2.2), (0.86, 0, 0, 0.155 * hip, 0.104, 2.4), (0.93, 0, 0.004, 0.172 * hip, 0.114, 2.4),
             (1.0, 0, 0, 0.166 * hip, 0.108, 2.4), (1.06 if tuck else 1.02, 0, 0, 0.152 * waist, 0.103, 2.4)]
    loft(lower, m=c["pants"], parts=P, name="hips", axis="Z", seg=20, levels=1)
    _tube(P, [(0, 0.014, 1.46), (0, 0.01, 1.53), (0, 0.006, 1.585)], [0.054, 0.05, 0.05], c["skin"], name="neck")
    for s in (1, -1):
        # legs
        _tube(P, [(s * 0.09, 0, 0.94), (s * 0.095, -0.005, 0.75), (s * 0.1, -0.014, 0.52), (s * 0.1, -0.002, 0.36), (s * 0.1, 0.012, 0.2), (s * 0.1, 0.015, 0.1)],
              [0.088 * hip, 0.076 * hip, 0.056, 0.059, 0.048, 0.044], c["pants"], seg=14, name="leg")
        # boots: shaft + foot, sole
        _tube(P, [(s * 0.1, 0.016, 0.27), (s * 0.1, 0.016, 0.12)], [0.054, 0.056], c["boots"], name="boot_shaft")
        foot = [(0.075, s * 0.1, 0.075, 0.046, 0.07, 2.4), (0.0, s * 0.1, 0.07, 0.052, 0.07, 2.6), (-0.1, s * 0.1, 0.05, 0.05, 0.05, 2.6),
                (-0.18, s * 0.1, 0.04, 0.043, 0.038, 2.4), (-0.205, s * 0.1, 0.036, 0.028, 0.028, 2.0)]
        loft([(t, cx, cz, w, h, n) for t, cx, cz, w, h, n in foot], m=c["boots"], parts=P, name="boot", seg=16, levels=1)
        loft([(0.085, s * 0.1, 0.012, 0.05, 0.012, 3), (-0.2, s * 0.1, 0.012, 0.047, 0.012, 3), (-0.215, s * 0.1, 0.014, 0.03, 0.01, 2.4)],
             m=c["sole"], parts=P, name="sole", seg=12, levels=0)
        # arms
        sh, el, wr, d = arm_joints(s, k)
        sleeve = c.get("sleeve", c["top"])
        root = (s * 0.12, 0.004, 1.43)
        if sleeves == "long":
            # one continuous tube: separate capped segments read as mannequin joints at the elbow
            _tube(P, [root, sh, _lerp(sh, el, 0.5), el, _lerp(el, wr, 0.5), wr], [0.062, 0.058, 0.049, 0.043, 0.038, 0.032], sleeve, seg=14, name="arm")
            _tube(P, [_lerp(el, wr, 0.86), _lerp(el, wr, 1.02)], [0.035, 0.035], c.get("cuff", sleeve), name="cuff")
        else:
            _tube(P, [_lerp(sh, el, 0.75), el, _lerp(el, wr, 0.5), wr], [0.043, 0.041, 0.037, 0.03], c["skin"], seg=14, name="forearm")
            _tube(P, [root, sh, _lerp(sh, el, 0.5), el, _lerp(el, wr, 0.08)], [0.062, 0.058, 0.05, 0.046, 0.045], sleeve, seg=14, name="sleeve")
            _tube(P, [_lerp(el, wr, -0.03), _lerp(el, wr, 0.1)], [0.05, 0.049], sleeve, name="cuff_roll")
        hand_m = c.get("gloves", c["skin"])
        hc = tuple(w + dd * 0.075 for w, dd in zip(wr, d))
        _ellipsoid(P, hc, d, 0.082, 0.046, 0.021, hand_m)
        _ellipsoid(P, tuple(w + dd * 0.03 + o for w, dd, o in zip(wr, d, (0, -0.032, 0))), (s * 0.35, -0.6, -0.7), 0.034, 0.014, 0.014, hand_m, seg=10)
    return k


def head(P, c, female=False, hair="short", brows=True):
    """Head with simple face. c needs skin, hair, eye (iris), lip."""
    w = 0.94 if female else 1.0
    secs = [(1.54, 0, 0.01, 0.05, 0.055), (1.575, 0, -0.015, 0.052 * w, 0.074), (1.61, 0, -0.01, 0.066 * w, 0.092), (1.65, 0, -0.005, 0.074 * w, 0.1),
            (1.69, 0, 0.0, 0.077 * w, 0.102), (1.73, 0, 0.005, 0.079 * w, 0.102), (1.765, 0, 0.01, 0.073 * w, 0.094), (1.79, 0, 0.012, 0.055 * w, 0.072),
            (1.805, 0, 0.012, 0.026, 0.034), (1.81, 0, 0.012, 0.006, 0.006)]
    loft([(z, x, y, a, b, 2.0) for z, x, y, a, b in secs], m=c["skin"], parts=P, name="head", axis="Z", seg=20, levels=1)
    white = mat("sclera", "#e8e2d8", rough=0.25)
    pupil = mat("pupil", "#0c0906", rough=0.1)
    for s in (1, -1):
        sphere(0.012, (s * 0.032, -0.083, 1.692), m=white, parts=P, seg=12, rings=8)
        sphere(0.0068, (s * 0.032, -0.093, 1.692), m=c["eye"], parts=P, seg=10, rings=6)
        sphere(0.0034, (s * 0.032, -0.0985, 1.692), m=pupil, parts=P, seg=8, rings=5)
        if brows:
            _ellipsoid(P, (s * 0.034, -0.094, 1.711), (s, -0.25, 0.08), 0.019, 0.006, 0.005, c.get("brow", c["hair"]), seg=10, rings=6)
        _ellipsoid(P, (s * 0.077 * w, 0.008, 1.68), (0, 0.15, 1), 0.029, 0.018, 0.008, c["skin"], seg=10, rings=6)
    _ellipsoid(P, (0, -0.101, 1.66), (0, -0.45, -1), 0.026, 0.014, 0.017, c["skin"], seg=10, rings=6)
    _ellipsoid(P, (0, -0.093, 1.615), (1, 0, 0), 0.02, 0.005, 0.005, c["lip"], seg=10, rings=6)
    if hair:
        _hair(P, c["hair"], hair, w)


def _hair(P, m, style, w=1.0):
    # hair cap: rings pushed backwards at the bottom so the face stays clear
    cap = [(1.635, 0.047, 0.07 * w, 0.058), (1.67, 0.036, 0.08 * w, 0.074), (1.705, 0.024, 0.085 * w, 0.088), (1.74, 0.012, 0.086 * w, 0.106),
           (1.77, 0.012, 0.081 * w, 0.103), (1.795, 0.012, 0.064 * w, 0.083), (1.815, 0.012, 0.036, 0.046), (1.826, 0.012, 0.006, 0.007)]
    if style == "short":
        cap = [(z, y, a * 0.985, b * 0.985) for z, y, a, b in cap]
    loft([(z, 0, y, a, b, 2.0) for z, y, a, b in cap], m=m, parts=P, name="hair", axis="Z", seg=20, levels=1)
    if style == "ponytail":
        torus(0.017, 0.006, (0, 0.108, 1.725), rot=(80, 0, 0), m=mat("hair_tie", "#1a1a1a", rough=0.6), parts=P, seg=12, tseg=6)
        _tube(P, [(0, 0.1, 1.73), (0, 0.13, 1.7), (0, 0.145, 1.63), (0, 0.14, 1.55), (0, 0.125, 1.49)], [0.022, 0.026, 0.022, 0.016, 0.006], m, seg=10)


def _helmet_shell(P, m, face_open=True):
    rings = [(1.63, 0.05, 0.088, 0.075), (1.665, 0.035, 0.1, 0.095), (1.7, 0.02, 0.104, 0.112), (1.74, 0.006, 0.104, 0.122),
             (1.775, 0.008, 0.098, 0.118), (1.805, 0.01, 0.08, 0.098), (1.83, 0.012, 0.048, 0.06), (1.842, 0.012, 0.008, 0.01)]
    loft([(z, 0, y, a, b, 2.0) for z, y, a, b in rings], m=m, parts=P, name="helmet", axis="Z", seg=22, levels=1)


def _backpack(P, fabric, dark, sw=1.0, case=True):
    box((0.3, 0.15, 0.44), (0, 0.19, 1.2), m=fabric, parts=P, name="pack", bevel=0.03)
    box((0.31, 0.155, 0.08), (0, 0.19, 1.43), m=dark, parts=P, name="pack_flap", bevel=0.02)
    box((0.22, 0.06, 0.16), (0, 0.285, 1.08), m=fabric, parts=P, name="pack_pocket", bevel=0.018)
    for s in (1, -1):
        _tube(P, [(s * 0.1, -0.118, 1.2), (s * 0.115, -0.105, 1.36), (s * 0.11, -0.04, 1.46), (s * 0.1, 0.06, 1.45), (s * 0.1, 0.13, 1.38)], 0.012, dark, seg=6, levels=0)
        cyl(0.035, 0.2, (s * 0.165, 0.2, 1.1), m=dark, parts=P, seg=10, name="bottle")  # side water bottles
    cyl(0.06, 0.34, (0, 0.2, 0.95), rot=(0, 90, 0), m=dark, parts=P, seg=12, name="bedroll")
    if case:
        metal = mat("dna_case", "#3a3e40", rough=0.35, metal=0.6)
        box((0.24, 0.05, 0.15), (0, 0.29, 1.28), m=metal, parts=P, name="dna_case", bevel=0.012)
        lit = mat("dna_lit", "#6cf0b0", rough=0.3, emit="#6cf0b0", strength=4.0)
        empty = mat("dna_slot", "#15191a", rough=0.4)
        for i in range(6):
            x = -0.085 + i * 0.034
            cyl(0.011, 0.012, (x, 0.318, 1.3), rot=(90, 0, 0), m=lit if i < 5 else empty, parts=P, seg=10, name="dna_slot")
        box((0.2, 0.008, 0.03), (0, 0.316, 1.235), m=mat("case_label", "#c8b870", rough=0.5), parts=P, name="case_label")


def _biomonitor(P, s=-1, sw=1.0):
    sh, el, wr, d = arm_joints(s, sw)
    p = _lerp(el, wr, 0.78)
    band = mat("band", "#1c1e1e", rough=0.6)
    _tube(P, [_lerp(el, wr, 0.7), _lerp(el, wr, 0.88)], 0.036, band, seg=12, levels=0)
    scr = box((0.022, 0.04, 0.05), (p[0] + s * 0.028, p[1] - 0.006, p[2] + 0.028), rot=(0, s * -48, 0), m=mat("bio_screen", "#40d0ff", rough=0.2, emit="#40d0ff", strength=2.5), parts=P, name="bio_screen")
    return scr


def _pocket(P, loc, size, m, rot=(0, 0, 0)):
    box(size, loc, rot=rot, m=m, parts=P, name="pocket", bevel=min(size) * 0.3)


# ------------------------------------------------------------------ characters
def ethan():
    """06 Ethan Reed, field tracker: olive field shirt, rolled sleeves, cargo pants, pack with the DNA case."""
    a = Asset("ethan_reed", "characters", scale=1.82 / 1.8)
    P = a.parts
    c = {"skin": mat("skin_ethan", "#c69474", rough=0.55), "top": mat("shirt_olive", "#5c6446", rough=0.85), "pants": mat("cargo_khaki", "#6e6450", rough=0.9),
         "boots": mat("boots_brown", "#4a3424", rough=0.6), "sole": mat("sole", "#1a1816", rough=0.9), "hair": mat("hair_brown", "#3a2a1e", rough=0.7),
         "eye": mat("iris_green", "#4a6a4a", rough=0.2), "lip": mat("lip_m", "#9a6454", rough=0.6)}
    body(P, c, sleeves="rolled")
    head(P, c)
    # stubble: a darker jaw shell
    loft([(1.56, 0, -0.012, 0.053, 0.075, 2.0), (1.6, 0, -0.012, 0.066, 0.093, 2.0), (1.63, 0, -0.008, 0.071, 0.098, 2.0)],
         m=mat("stubble", "#8a6a52", rough=0.8), parts=P, name="stubble", axis="Z", seg=20, levels=1)
    belt = mat("belt", "#2e2a24", rough=0.6)
    loft([(1.02, 0, 0, 0.168, 0.11, 2.4), (1.065, 0, 0, 0.163, 0.108, 2.4)], m=belt, parts=P, name="belt", axis="Z", seg=20, levels=0)
    box((0.045, 0.012, 0.035), (0, -0.112, 1.043), m=mat("buckle", "#8a8a80", rough=0.3, metal=0.9), parts=P, name="buckle")
    pouch = mat("pouch", "#4a4c38", rough=0.85)
    for s in (1, -1):
        _pocket(P, (s * 0.1, -0.118, 1.3), (0.07, 0.02, 0.08), c["top"])  # chest pockets
        _pocket(P, (s * 0.175, -0.02, 0.62), (0.03, 0.09, 0.11), c["pants"])  # cargo pockets
        box((0.075, 0.05, 0.07), (s * 0.13, 0.08, 1.02), m=pouch, parts=P, name="belt_pouch", bevel=0.012)
    _backpack(P, mat("pack_olive", "#4e5438", rough=0.85), mat("pack_dark", "#2a2c22", rough=0.8))
    _biomonitor(P, -1)
    return a


def lucas():
    """07 Lucas Ortiz, pilot: one-piece flight suit, helmet with a tinted visor, headset boom."""
    a = Asset("lucas_ortiz", "characters", scale=1.78 / 1.8)
    P = a.parts
    suit = mat("flightsuit", "#6a705c", rough=0.8)
    c = {"skin": mat("skin_lucas", "#a8795a", rough=0.55), "top": suit, "pants": suit, "boots": mat("boots_black", "#1e1c1a", rough=0.5),
         "sole": mat("sole", "#1a1816", rough=0.9), "hair": mat("hair_black", "#1a1614", rough=0.7), "eye": mat("iris_brown", "#4a2e1a", rough=0.2),
         "lip": mat("lip_l", "#86523e", rough=0.6), "gloves": mat("pilot_gloves", "#3a3028", rough=0.7)}
    body(P, c, sleeves="long", tuck=True)
    head(P, c, hair="short")
    helm = mat("helmet_olive", "#5a6048", rough=0.5)
    _helmet_shell(P, helm)
    visor = mat("visor", "#2a1c10", rough=0.05, metal=0.8)
    _ellipsoid(P, (0, -0.03, 1.715), (0, 0, 1), 0.052, 0.104, 0.1, visor, seg=20, rings=10)
    box((0.12, 0.03, 0.03), (0, -0.075, 1.775), m=helm, parts=P, name="visor_housing", bevel=0.01)
    for s in (1, -1):
        cyl(0.036, 0.03, (s * 0.1, 0.01, 1.68), rot=(0, 90, 0), m=mat("ear_cup", "#2a2a28", rough=0.5), parts=P, seg=14, name="ear_cup")
    _tube(P, [(0.105, -0.01, 1.66), (0.085, -0.07, 1.63), (0.03, -0.105, 1.615)], 0.0045, mat("boom", "#1a1a1a", rough=0.4), seg=6, levels=0)
    zip_m = mat("zip", "#3a3c34", rough=0.5, metal=0.5)
    box((0.012, 0.012, 0.5), (0, -0.121, 1.18), m=zip_m, parts=P, name="zip")
    patch = mat("patch_origo", "#b04a2a", rough=0.7)
    for s in (1, -1):
        sh, el, wr, d = arm_joints(s)
        p = _lerp(sh, el, 0.35)
        box((0.012, 0.05, 0.05), (p[0] + s * 0.05, p[1] - 0.005, p[2] + 0.03), rot=(0, s * -48, 0), m=patch, parts=P, name="patch")
        _pocket(P, (s * 0.1, -0.12, 1.32), (0.075, 0.018, 0.09), suit)
        _pocket(P, (s * 0.12, -0.075, 0.66), (0.08, 0.02, 0.12), suit)
    box((0.07, 0.01, 0.025), (-0.1, -0.132, 1.36), m=mat("name_tape", "#c8c0a0", rough=0.6), parts=P, name="name_tape")
    return a


def lena():
    """08 Lena Arden, scientist: lab coat over a blue shirt, glasses, ponytail."""
    a = Asset("lena_arden", "characters", scale=1.68 / 1.8)
    P = a.parts
    coat = mat("lab_coat", "#e6e8e4", rough=0.75)
    c = {"skin": mat("skin_lena", "#e2b89c", rough=0.5), "top": mat("shirt_blue", "#6a86a0", rough=0.8), "pants": mat("pants_dark", "#2e3238", rough=0.85),
         "boots": mat("shoes_brown", "#5a3e2a", rough=0.5), "sole": mat("sole", "#1a1816", rough=0.9), "hair": mat("hair_auburn", "#6a3a22", rough=0.65),
         "eye": mat("iris_blue", "#4a6a8a", rough=0.2), "lip": mat("lip_f", "#b06a60", rough=0.5), "sleeve": coat}
    body(P, c, female=True, sleeves="long")
    head(P, c, female=True, hair="ponytail")
    k = 0.9
    ring = [(0.6, 0.012, 0.205, 0.152), (0.78, 0.004, 0.192, 0.138), (0.93, 0.004, 0.19, 0.128), (1.06, 0.0, 0.158, 0.114), (1.18, -0.003, 0.17 * k + 0.012, 0.122),
            (1.28, -0.016, 0.19 * k + 0.01, 0.142), (1.36, -0.004, 0.196 * k, 0.124), (1.42, 0.004, 0.176 * k, 0.104), (1.46, 0.012, 0.112, 0.08)]
    loft([(z, 0, y, w, d, 2.4) for z, y, w, d in ring], m=coat, parts=P, name="coat", axis="Z", seg=22, levels=1, cap=False)
    # open front: the shirt shows in a V down to the second button
    shirt = c["top"]
    for s in (1, -1):
        v = [(s * 0.004, -0.14, 1.26), (s * 0.06, -0.12, 1.45), (s * 0.018, -0.13, 1.45)]
        ob = mesh_from(v, [(0, 1, 2)], m=shirt, parts=P, name="v_neck")
        ob.modifiers.new("s", "SOLIDIFY").thickness = 0.01
        apply_modifiers(ob)
        # lapels
        box((0.05, 0.012, 0.16), (s * 0.06, -0.142, 1.37), rot=(-8, s * 12, s * 18), m=coat, parts=P, name="lapel", bevel=0.004)
        _pocket(P, (s * 0.12, -0.135, 0.9), (0.1, 0.012, 0.11), coat)
    _pocket(P, (-0.1, -0.148, 1.3), (0.075, 0.01, 0.07), coat)
    for i, z in enumerate((1.22, 1.08, 0.94, 0.8)):
        cyl(0.008, 0.006, (0.012, -0.132 - (0.012 if i == 0 else 0.0), z), rot=(90, 0, 0), m=mat("button", "#b8b8b0", rough=0.4), parts=P, seg=10, name="button")
    tube([(0.1, -0.15, 1.27), (0.1, -0.15, 1.33)], 0.005, m=mat("pen", "#2a4a8a", rough=0.3), parts=P, seg=6)
    box((0.04, 0.004, 0.055), (-0.1, -0.153, 1.25), m=mat("id_badge", "#f0f0e8", rough=0.4), parts=P, name="id_badge")
    frame = mat("glasses", "#2a2420", rough=0.3, metal=0.4)
    for s in (1, -1):
        torus(0.0165, 0.0022, (s * 0.032, -0.104, 1.692), rot=(90, 0, 0), m=frame, parts=P, seg=18, tseg=6)
        cyl(0.0018, 0.1, (s * 0.074, -0.05, 1.697), rot=(90, 0, 0), m=frame, parts=P, seg=5)
    cyl(0.002, 0.03, (0, -0.105, 1.697), rot=(0, 90, 0), m=frame, parts=P, seg=5)
    return a


def halm():
    """09 Viktor Halm, expedition lead: grey hair, moustache, field jacket over a shirt."""
    a = Asset("viktor_halm", "characters", scale=1.83 / 1.8)
    P = a.parts
    jacket = mat("jacket_field", "#4a4636", rough=0.85)
    c = {"skin": mat("skin_halm", "#d0a286", rough=0.6), "top": mat("shirt_grey", "#8a8a80", rough=0.8), "pants": mat("pants_olive", "#4e5040", rough=0.9),
         "boots": mat("boots_brown", "#4a3424", rough=0.6), "sole": mat("sole", "#1a1816", rough=0.9), "hair": mat("hair_grey", "#a8a49c", rough=0.7),
         "eye": mat("iris_grey", "#5a6a70", rough=0.2), "lip": mat("lip_h", "#9a6a5a", rough=0.6), "sleeve": jacket, "brow": mat("brow_grey", "#8a8680", rough=0.7)}
    body(P, c, sw=1.02, sleeves="long")
    head(P, c, hair="short")
    _ellipsoid(P, (0, -0.098, 1.628), (1, 0, 0), 0.03, 0.008, 0.009, c["hair"], seg=12, rings=6)  # moustache
    ring = [(0.9, 0.0, 0.18, 0.12), (1.0, 0.0, 0.176, 0.117), (1.1, 0, 0.17, 0.114), (1.2, -0.003, 0.178, 0.12), (1.28, -0.008, 0.192, 0.13),
            (1.36, -0.004, 0.197, 0.123), (1.42, 0.004, 0.18, 0.104), (1.47, 0.012, 0.114, 0.082)]
    loft([(z, 0, y, w, d, 2.4) for z, y, w, d in ring], m=jacket, parts=P, name="jacket", axis="Z", seg=22, levels=1, cap=False)
    torus(0.075, 0.018, (0, 0.012, 1.475), m=jacket, parts=P, seg=20, tseg=8)  # collar
    box((0.014, 0.012, 0.52), (0, -0.126, 1.19), m=mat("jacket_zip", "#2a2820", rough=0.5), parts=P, name="zip")
    for s in (1, -1):
        _pocket(P, (s * 0.1, -0.13, 1.3), (0.08, 0.02, 0.09), jacket)
        _pocket(P, (s * 0.11, -0.12, 0.98), (0.1, 0.022, 0.1), jacket)
        sh, el, wr, d = arm_joints(s, 1.02)
        _tube(P, [_lerp(el, wr, 0.84), _lerp(el, wr, 1.0)], 0.036, jacket, levels=0)
    box((0.1, 0.014, 0.12), (0.14, 0.02, 1.02), m=mat("map_case", "#3a2e22", rough=0.6), parts=P, name="map_case", bevel=0.01)
    _biomonitor(P, -1, 1.02)
    return a


def diego():
    """10 Diego Ramos, security: helmet, plate carrier with pouches, gloves, knee pads."""
    a = Asset("diego_ramos", "characters", scale=1.86 / 1.8)
    P = a.parts
    c = {"skin": mat("skin_diego", "#9a6a4a", rough=0.55), "top": mat("combat_shirt", "#3a3c36", rough=0.85), "pants": mat("combat_pants", "#5a5444", rough=0.9),
         "boots": mat("boots_tan", "#6a5a42", rough=0.7), "sole": mat("sole", "#1a1816", rough=0.9), "hair": mat("hair_black", "#1a1614", rough=0.7),
         "eye": mat("iris_brown", "#4a2e1a", rough=0.2), "lip": mat("lip_d", "#7a4a3a", rough=0.6), "gloves": mat("tac_gloves", "#1e1e1c", rough=0.7)}
    body(P, c, sw=1.08, sleeves="long")
    head(P, c, hair="short")
    helm = mat("helmet_tan", "#6a6448", rough=0.6)
    _helmet_shell(P, helm)
    box((0.05, 0.02, 0.035), (0, -0.11, 1.79), rot=(-30, 0, 0), m=mat("nvg_mount", "#1e1e1c", rough=0.4, metal=0.4), parts=P, name="nvg_mount")
    for s in (1, -1):
        box((0.02, 0.07, 0.03), (s * 0.104, 0.0, 1.76), m=mat("rail", "#2a2a26", rough=0.5), parts=P, name="rail")
    vest = mat("plate_carrier", "#4a4a3a", rough=0.85)
    k = 1.08
    for y0, sgn in ((-0.13, 1), (0.13, -1)):
        loft([(1.06, 0, y0 + sgn * 0.0, 0.17 * k, 0.03, 3.4), (1.22, 0, y0 - sgn * 0.004, 0.176 * k, 0.034, 3.4), (1.38, 0, y0 - sgn * 0.002, 0.168 * k, 0.03, 3.4),
              (1.42, 0, y0 + sgn * 0.01, 0.13, 0.026, 3.0)], m=vest, parts=P, name="plate", axis="Z", seg=16, levels=1)
    for s in (1, -1):
        box((0.05, 0.25, 0.14), (s * 0.19, 0.0, 1.16), m=vest, parts=P, name="cummerbund", bevel=0.01)
        _tube(P, [(s * 0.1, -0.15, 1.4), (s * 0.11, -0.08, 1.47), (s * 0.11, 0.04, 1.47), (s * 0.1, 0.15, 1.4)], 0.018, vest, seg=6, levels=0)
        _ellipsoid(P, (s * 0.1, -0.068, 0.52), (0, 0, 1), 0.075, 0.07, 0.035, mat("knee_pad", "#2a2a26", rough=0.6))
    pouch = mat("mag_pouch", "#524e3c", rough=0.85)
    for i in range(3):
        box((0.065, 0.045, 0.1), (-0.075 + i * 0.075, -0.2, 1.14), m=pouch, parts=P, name="mag_pouch", bevel=0.01)
    box((0.08, 0.04, 0.06), (0.1, -0.19, 1.3), m=pouch, parts=P, name="admin_pouch", bevel=0.01)
    box((0.04, 0.03, 0.08), (-0.12, -0.18, 1.33), m=mat("radio", "#1e1e1c", rough=0.4), parts=P, name="radio")
    cyl(0.004, 0.22, (-0.13, -0.17, 1.46), m=mat("antenna", "#1a1a1a", rough=0.5), parts=P, seg=5)
    belt = mat("battle_belt", "#3a382c", rough=0.7)
    loft([(0.98, 0, 0, 0.18, 0.12, 2.4), (1.04, 0, 0, 0.176, 0.118, 2.4)], m=belt, parts=P, name="belt", axis="Z", seg=20, levels=0)
    box((0.06, 0.1, 0.16), (0.2, 0.0, 0.86), m=mat("holster", "#22221e", rough=0.5), parts=P, name="holster", bevel=0.012)
    return a


BUILDERS = {
    "ethan_reed": ethan,
    "lucas_ortiz": lucas,
    "lena_arden": lena,
    "viktor_halm": halm,
    "diego_ramos": diego,
}
