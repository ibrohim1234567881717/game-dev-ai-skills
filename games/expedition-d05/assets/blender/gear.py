"""11–12: weapons and DNA-sampling equipment. Muzzles and business ends face -Y."""

import math

from lib import Asset, box, cyl, loft, mat, sphere, torus, tube


def _m():
    return {
        "steel": mat("gunmetal", "#2c2e30", rough=0.35, metal=0.85),
        "poly": mat("polymer", "#1e1f20", rough=0.6),
        "tan": mat("polymer_tan", "#8a7a5c", rough=0.65),
        "wood": mat("walnut", "#5e3a22", rough=0.55),
        "rubber": mat("rubber", "#141414", rough=0.9),
        "glass": mat("lens", "#10202a", rough=0.05, metal=0.6),
        "orange": mat("signal_orange", "#d8561e", rough=0.45),
        "olive": mat("olive_drab", "#4a4c34", rough=0.7),
        "alu": mat("aluminium", "#9a9ea0", rough=0.3, metal=0.9),
        "case": mat("case_shell", "#2e3234", rough=0.45, metal=0.3),
        "foam": mat("foam", "#141618", rough=0.95),
    }


def _trigger(P, y, z, m, r=0.022):
    torus(r, 0.004, (0, y, z), rot=(0, 90, 0), m=m, parts=P, seg=16, tseg=5, arc=0.55)
    box((0.004, 0.006, 0.02), (0, y - 0.003, z + 0.006), rot=(20, 0, 0), m=m, parts=P, name="trigger")


def rifle():
    """Carbine, ~0.9 m: receiver, rail handguard, optic, curved magazine, adjustable stock."""
    a = Asset("rifle", "equipment")
    P, M = a.parts, _m()
    box((0.05, 0.3, 0.085), (0, 0.0, 0.11), m=M["tan"], parts=P, name="receiver", bevel=0.006)
    box((0.02, 0.62, 0.012), (0, -0.14, 0.158), m=M["steel"], parts=P, name="top_rail")
    for i in range(22):
        box((0.024, 0.008, 0.006), (0, 0.15 - i * 0.028, 0.166), m=M["steel"], parts=P, name="rail_tooth")
    loft([(-0.14, 0, 0.115, 0.03, 0.034, 3.6), (-0.46, 0, 0.115, 0.028, 0.032, 3.6)], m=M["tan"], parts=P, name="handguard", seg=16, levels=0)
    for i in range(6):
        box((0.062, 0.03, 0.01), (0, -0.19 - i * 0.045, 0.115), m=M["poly"], parts=P, name="vent")
    cyl(0.009, 0.2, (0, -0.56, 0.12), rot=(90, 0, 0), m=M["steel"], parts=P, seg=12, name="barrel")
    cyl(0.014, 0.055, (0, -0.68, 0.12), rot=(90, 0, 0), m=M["steel"], parts=P, seg=12, name="muzzle")
    box((0.012, 0.03, 0.03), (0, -0.44, 0.176), m=M["steel"], parts=P, name="front_sight")
    # stock: buffer tube + adjustable butt
    cyl(0.016, 0.2, (0, 0.24, 0.12), rot=(90, 0, 0), m=M["poly"], parts=P, seg=12, name="buffer_tube")
    loft([(0.24, 0, 0.11, 0.022, 0.03, 3.0), (0.33, 0, 0.1, 0.024, 0.055, 3.0), (0.4, 0, 0.09, 0.024, 0.07, 3.2), (0.415, 0, 0.09, 0.024, 0.07, 3.2)],
         m=M["tan"], parts=P, name="stock", seg=14, levels=1)
    box((0.03, 0.014, 0.15), (0, 0.42, 0.09), m=M["rubber"], parts=P, name="butt_pad", bevel=0.005)
    # grip and magazine
    box((0.032, 0.04, 0.1), (0, 0.1, 0.035), rot=(-18, 0, 0), m=M["poly"], parts=P, name="grip", bevel=0.008)
    mag = loft([(z, 0, -0.06 + 0.25 * (0.07 - z) ** 2 * 10 - (0.07 - z) * 0.12, 0.013, 0.032, 3.2) for z in (0.07, 0.03, -0.01, -0.05, -0.08)],
               m=M["poly"], parts=P, name="magazine", seg=12, axis="Z", levels=0)
    _trigger(P, 0.055, 0.058, M["poly"])
    # optic
    box((0.022, 0.05, 0.022), (0, -0.02, 0.172), m=M["steel"], parts=P, name="optic_mount")
    cyl(0.02, 0.13, (0, -0.02, 0.2), rot=(90, 0, 0), m=M["poly"], parts=P, seg=16, name="optic")
    for y in (-0.086, 0.046):
        cyl(0.017, 0.004, (0, y, 0.2), rot=(90, 0, 0), m=M["glass"], parts=P, seg=16, name="optic_lens")
    box((0.01, 0.02, 0.012), (0.03, 0.06, 0.13), m=M["steel"], parts=P, name="charging_handle")
    return a


def shotgun():
    """Pump shotgun, ~1.0 m, walnut furniture, tube magazine."""
    a = Asset("shotgun", "equipment")
    P, M = a.parts, _m()
    box((0.046, 0.22, 0.072), (0, 0.0, 0.11), m=M["steel"], parts=P, name="receiver", bevel=0.008)
    cyl(0.0115, 0.56, (0, -0.39, 0.13), rot=(90, 0, 0), m=M["steel"], parts=P, seg=14, name="barrel")
    cyl(0.011, 0.44, (0, -0.33, 0.1), rot=(90, 0, 0), m=M["steel"], parts=P, seg=14, name="mag_tube")
    sphere(0.005, (0, -0.66, 0.145), m=M["alu"], parts=P, seg=8, rings=6, name="bead")
    loft([(-0.17, 0, 0.103, 0.024, 0.022, 2.2), (-0.2, 0, 0.1, 0.026, 0.026, 2.4), (-0.34, 0, 0.1, 0.026, 0.026, 2.4), (-0.36, 0, 0.103, 0.024, 0.022, 2.2)],
         m=M["wood"], parts=P, name="pump", seg=16, levels=1)
    for i in range(7):
        torus(0.0262, 0.0018, (0, -0.215 - i * 0.018, 0.1), rot=(90, 0, 0), m=M["poly"], parts=P, seg=16, tseg=4)
    loft([(0.1, 0, 0.1, 0.022, 0.032, 2.6), (0.17, 0, 0.075, 0.018, 0.035, 2.6), (0.24, 0, 0.07, 0.02, 0.045, 2.6), (0.36, 0, 0.065, 0.022, 0.06, 2.6),
          (0.44, 0, 0.06, 0.023, 0.07, 2.8), (0.455, 0, 0.06, 0.023, 0.07, 2.8)], m=M["wood"], parts=P, name="stock", seg=16, levels=1)
    box((0.03, 0.014, 0.145), (0, 0.46, 0.06), m=M["rubber"], parts=P, name="butt_pad", bevel=0.005)
    _trigger(P, 0.07, 0.07, M["steel"])
    box((0.008, 0.04, 0.02), (0.027, -0.02, 0.12), m=M["steel"], parts=P, name="ejection_port")
    return a


def pistol():
    """Service pistol, ~20 cm."""
    a = Asset("pistol", "equipment")
    P, M = a.parts, _m()
    box((0.028, 0.19, 0.034), (0, -0.01, 0.135), m=M["steel"], parts=P, name="slide", bevel=0.004)
    for i in range(7):
        box((0.03, 0.003, 0.022), (0, 0.055 + i * 0.006, 0.137), m=M["poly"], parts=P, name="serration")
    box((0.026, 0.17, 0.022), (0, -0.005, 0.108), m=M["poly"], parts=P, name="frame", bevel=0.004)
    box((0.03, 0.048, 0.115), (0, 0.055, 0.05), rot=(-17, 0, 0), m=M["poly"], parts=P, name="grip", bevel=0.008)
    cyl(0.006, 0.004, (0, -0.105, 0.14), rot=(90, 0, 0), m=M["rubber"], parts=P, seg=10, name="muzzle")
    for y in (-0.1, 0.075):
        box((0.008, 0.008, 0.008), (0, y, 0.156), m=M["steel"], parts=P, name="sight")
    _trigger(P, 0.0, 0.085, M["poly"], r=0.018)
    return a


def flare_gun():
    """Signal pistol, orange, 26.5 mm bore."""
    a = Asset("flare_gun", "equipment")
    P, M = a.parts, _m()
    cyl(0.021, 0.17, (0, -0.08, 0.13), rot=(90, 0, 0), m=M["orange"], parts=P, seg=18, name="barrel")
    cyl(0.0145, 0.005, (0, -0.166, 0.13), rot=(90, 0, 0), m=M["rubber"], parts=P, seg=14, name="bore")
    box((0.034, 0.07, 0.05), (0, 0.03, 0.12), m=M["orange"], parts=P, name="breech", bevel=0.008)
    box((0.032, 0.05, 0.11), (0, 0.06, 0.05), rot=(-15, 0, 0), m=M["orange"], parts=P, name="grip", bevel=0.01)
    box((0.012, 0.02, 0.025), (0, 0.065, 0.16), rot=(-30, 0, 0), m=M["poly"], parts=P, name="hammer")
    _trigger(P, 0.02, 0.085, M["orange"], r=0.02)
    return a


def ammo():
    """Ammo can with a spare magazine and a box of shells on the lid."""
    a = Asset("ammo", "equipment")
    P, M = a.parts, _m()
    box((0.11, 0.28, 0.17), (0, 0, 0.085), m=M["olive"], parts=P, name="can", bevel=0.006)
    box((0.118, 0.288, 0.03), (0, 0, 0.175), m=M["olive"], parts=P, name="lid", bevel=0.006)
    tube([(0, -0.07, 0.19), (0, -0.07, 0.205), (0, 0.07, 0.205), (0, 0.07, 0.19)], 0.006, m=M["steel"], parts=P, seg=6, name="handle")
    box((0.12, 0.02, 0.05), (0, 0.13, 0.15), m=M["steel"], parts=P, name="latch")
    box((0.08, 0.13, 0.05), (0, -0.05, 0.215), m=mat("shell_box", "#a82a1e", rough=0.8), parts=P, name="shell_box", bevel=0.003)
    box((0.03, 0.07, 0.15), (0.0, 0.08, 0.215), rot=(0, 90, 0), m=M["poly"], parts=P, name="spare_mag", bevel=0.004)
    for i in range(4):
        cyl(0.0095, 0.06, (0.075 + i * 0.022, -0.1, 0.0095), rot=(90, 0, 0), m=mat("shell_red", "#b02a20", rough=0.5), parts=P, seg=10, name="shell")
        cyl(0.01, 0.015, (0.075 + i * 0.022, -0.068, 0.0095), rot=(90, 0, 0), m=mat("brass", "#b8903a", rough=0.3, metal=0.9), parts=P, seg=10, name="shell_base")
    return a


# ------------------------------------------------------------------ DNA kit
DNA_COLOURS = ["#7ad86a", "#e0a040", "#40c8c0", "#f07a3a", "#e04040"]


def dna_case():
    """The six-slot DNA case, open: five filled vials glow, the sixth well is empty."""
    a = Asset("dna_case", "equipment")
    P, M = a.parts, _m()
    box((0.48, 0.32, 0.1), (0, 0, 0.05), m=M["case"], parts=P, name="base", bevel=0.012)
    box((0.45, 0.29, 0.02), (0, 0, 0.092), m=M["foam"], parts=P, name="foam")
    glass = mat("vial_glass", "#c8e0e8", rough=0.05, alpha=0.35)
    cap = mat("vial_cap", "#c0c4c6", rough=0.3, metal=0.9)
    for i in range(6):
        x = -0.175 + i * 0.07
        cyl(0.026, 0.006, (x, 0.02, 0.1), m=mat("well_ring", "#3a3e40", rough=0.4, metal=0.6), parts=P, seg=18, name="well")
        if i < 5:
            col = DNA_COLOURS[i]
            cyl(0.018, 0.075, (x, 0.02, 0.135), m=glass, parts=P, seg=16, name="vial")
            cyl(0.0145, 0.05, (x, 0.02, 0.124), m=mat("dna_%d" % i, col, rough=0.2, emit=col, strength=2.5), parts=P, seg=14, name="sample")
            cyl(0.02, 0.018, (x, 0.02, 0.18), m=cap, parts=P, seg=16, name="cap")
        cyl(0.006, 0.004, (x, -0.157, 0.07), rot=(90, 0, 0), m=mat("led_%d" % i, DNA_COLOURS[i] if i < 5 else "#202020", rough=0.3,
                                                                    emit=DNA_COLOURS[i] if i < 5 else None, strength=4.0), parts=P, seg=10, name="led")
    box((0.3, 0.004, 0.02), (0, -0.157, 0.035), m=mat("case_label", "#c8b870", rough=0.5), parts=P, name="label")
    # lid, opened ~105° around the back hinge
    lid_rot = (-105, 0, 0)
    import mathutils
    R = mathutils.Euler([math.radians(v) for v in lid_rot]).to_matrix()
    hinge = mathutils.Vector((0, 0.16, 0.1))
    for size, off, m_ in (((0.48, 0.32, 0.04), (0, -0.16, 0.02), M["case"]), ((0.45, 0.29, 0.01), (0, -0.16, -0.003), M["foam"])):
        p = hinge + R @ mathutils.Vector(off)
        box(size, tuple(p), rot=lid_rot, m=m_, parts=P, name="lid", bevel=0.01 if m_ is M["case"] else 0)
    for s in (1, -1):
        box((0.05, 0.02, 0.03), (s * 0.15, -0.165, 0.09), m=M["alu"], parts=P, name="latch")
        cyl(0.012, 0.04, (s * 0.2, 0.165, 0.1), rot=(0, 90, 0), m=M["alu"], parts=P, seg=12, name="hinge")
    tube([(-0.08, -0.16, 0.06), (-0.07, -0.19, 0.06), (0.07, -0.19, 0.06), (0.08, -0.16, 0.06)], 0.009, m=M["rubber"], parts=P, seg=8, name="handle")
    return a


def sample_container():
    """Single cryo canister, ~15 cm, with a glowing sample window."""
    a = Asset("sample_container", "equipment")
    P, M = a.parts, _m()
    cyl(0.03, 0.12, (0, 0, 0.06), m=M["alu"], parts=P, seg=24, name="body")
    cyl(0.033, 0.03, (0, 0, 0.135), m=M["case"], parts=P, seg=24, name="cap")
    for z in (0.02, 0.1):
        torus(0.031, 0.003, (0, 0, z), m=M["rubber"], parts=P, seg=24, tseg=5)
    box((0.018, 0.012, 0.05), (0, -0.026, 0.06), m=mat("dna_0", DNA_COLOURS[0], rough=0.2, emit=DNA_COLOURS[0], strength=2.5), parts=P, name="window")
    box((0.04, 0.002, 0.025), (0, 0.03, 0.07), rot=(0, 0, 180), m=mat("case_label", "#c8b870", rough=0.5), parts=P, name="label")
    return a


def scanner_tablet():
    """Rugged field tablet with the genome-match screen."""
    a = Asset("scanner_tablet", "equipment")
    P, M = a.parts, _m()
    box((0.28, 0.2, 0.024), (0, 0, 0.012), m=M["rubber"], parts=P, name="bumper", bevel=0.01)
    box((0.25, 0.17, 0.006), (0, 0, 0.024), m=mat("screen", "#0a2a36", rough=0.1, emit="#0a3444", strength=1.0), parts=P, name="screen")
    ui = mat("ui_cyan", "#50d8ff", rough=0.2, emit="#50d8ff", strength=3.0)
    ui_warn = mat("ui_amber", "#ffb040", rough=0.2, emit="#ffb040", strength=3.0)
    # double helix readout
    for i in range(14):
        t = i / 13
        x = -0.1 + t * 0.12
        for ph in (0, math.pi):
            sphere(0.004, (x, 0.02 + 0.03 * math.sin(t * 2 * math.pi * 1.5 + ph), 0.028), m=ui, parts=P, seg=6, rings=4, name="helix")
    for i in range(5):
        box((0.06 * (1 - i * 0.14), 0.008, 0.002), (0.07, 0.05 - i * 0.02, 0.028), m=ui if i else ui_warn, parts=P, name="bar")
    box((0.1, 0.01, 0.002), (-0.05, -0.06, 0.028), m=ui_warn, parts=P, name="match_bar")
    for s in (1, -1):
        box((0.02, 0.21, 0.03), (s * 0.13, 0, 0.015), m=M["rubber"], parts=P, name="grip", bevel=0.008)
    tube([(0.13, -0.08, 0.004), (0.155, -0.04, 0.0), (0.155, 0.04, 0.0), (0.13, 0.08, 0.004)], 0.004, m=M["olive"], parts=P, seg=6, name="strap")
    return a


def sampler():
    """Handheld biopsy sampler: pistol grip, cartridge with a vial, needle tip."""
    a = Asset("sampler", "equipment")
    P, M = a.parts, _m()
    loft([(0.1, 0, 0.13, 0.03, 0.035, 2.4), (0.0, 0, 0.13, 0.034, 0.04, 2.6), (-0.12, 0, 0.13, 0.03, 0.034, 2.6), (-0.17, 0, 0.13, 0.016, 0.018, 2.2)],
         m=mat("sampler_white", "#d8dad6", rough=0.4), parts=P, name="body", seg=18, levels=1)
    box((0.034, 0.045, 0.11), (0, 0.06, 0.055), rot=(-15, 0, 0), m=M["poly"], parts=P, name="grip", bevel=0.01)
    cyl(0.0035, 0.07, (0, -0.2, 0.13), rot=(90, 0, 0), m=M["alu"], parts=P, seg=8, name="needle")
    cyl(0.012, 0.02, (0, -0.165, 0.13), rot=(90, 0, 0), m=M["orange"], parts=P, seg=12, name="tip_guard")
    cyl(0.013, 0.05, (0, -0.02, 0.175), m=mat("vial_glass", "#c8e0e8", rough=0.05, alpha=0.35), parts=P, seg=14, name="vial")
    cyl(0.009, 0.035, (0, -0.02, 0.17), m=mat("dna_1", DNA_COLOURS[1], rough=0.2, emit=DNA_COLOURS[1], strength=2.5), parts=P, seg=12, name="sample")
    box((0.036, 0.04, 0.022), (0, 0.05, 0.172), m=mat("sampler_screen", "#40d0ff", rough=0.2, emit="#40d0ff", strength=2.0), parts=P, name="screen")
    _trigger(P, 0.02, 0.085, M["poly"])
    return a


def drone():
    """Survey quadcopter, ~45 cm span, with camera gimbal."""
    a = Asset("drone", "equipment")
    P, M = a.parts, _m()
    body = mat("drone_grey", "#4a5054", rough=0.45)
    loft([(0.1, 0, 0.12, 0.05, 0.03, 2.4), (0.0, 0, 0.125, 0.07, 0.04, 2.6), (-0.1, 0, 0.12, 0.055, 0.032, 2.4), (-0.13, 0, 0.115, 0.03, 0.02, 2.2)],
         m=body, parts=P, name="body", seg=16, levels=1)
    for sx in (1, -1):
        for sy in (1, -1):
            x, y = sx * 0.17, sy * 0.15
            tube([(sx * 0.04, sy * 0.035, 0.125), (x, y, 0.135)], 0.011, m=body, parts=P, seg=8, name="arm")
            cyl(0.02, 0.035, (x, y, 0.145), m=M["poly"], parts=P, seg=14, name="motor")
            cyl(0.12, 0.003, (x, y, 0.168), m=mat("prop_disc", "#202224", rough=0.4, alpha=0.4), parts=P, seg=28, name="prop_blur")
            box((0.23, 0.02, 0.004), (x, y, 0.166), rot=(0, 0, 30 * sx * sy), m=M["poly"], parts=P, name="prop")
            tube([(sx * 0.05, sy * 0.06, 0.11), (sx * 0.07, sy * 0.08, 0.0)], 0.005, m=M["poly"], parts=P, seg=6, name="leg")
    sphere(0.028, (0, -0.1, 0.075), m=M["poly"], parts=P, seg=16, rings=10, name="gimbal")
    cyl(0.013, 0.01, (0, -0.126, 0.075), rot=(90, 0, 0), m=M["glass"], parts=P, seg=14, name="camera")
    box((0.012, 0.006, 0.006), (0.03, -0.13, 0.12), m=mat("nav_red", "#ff3030", emit="#ff3030", strength=4), parts=P, name="nav_light")
    box((0.012, 0.006, 0.006), (-0.03, -0.13, 0.12), m=mat("nav_green", "#30ff60", emit="#30ff60", strength=4), parts=P, name="nav_light")
    return a


def biopsy_crossbow():
    """Dart crossbow for biopsy samples: stock, recurve limbs, string, scope, dart."""
    a = Asset("biopsy_crossbow", "equipment")
    P, M = a.parts, _m()
    loft([(0.35, 0, 0.1, 0.022, 0.06, 2.8), (0.2, 0, 0.11, 0.02, 0.035, 2.6), (0.0, 0, 0.12, 0.022, 0.028, 2.6), (-0.3, 0, 0.125, 0.02, 0.022, 2.6),
          (-0.36, 0, 0.125, 0.024, 0.026, 2.6)], m=M["olive"], parts=P, name="stock", seg=16, levels=1)
    box((0.03, 0.045, 0.1), (0, 0.1, 0.05), rot=(-15, 0, 0), m=M["poly"], parts=P, name="grip", bevel=0.01)
    box((0.028, 0.015, 0.14), (0, 0.36, 0.1), m=M["rubber"], parts=P, name="butt_pad", bevel=0.004)
    limb = [(0, -0.33, 0.125), (0.1, -0.35, 0.125), (0.2, -0.31, 0.125), (0.27, -0.25, 0.125), (0.29, -0.28, 0.125)]
    for s in (1, -1):
        tube([(s * x, y, z) for x, y, z in limb], [0.012, 0.011, 0.009, 0.007, 0.006], m=M["poly"], parts=P, seg=8, name="limb")
        tube([(s * 0.285, -0.27, 0.125), (s * 0.12, -0.02, 0.135), (0, 0.02, 0.135)], 0.0015, m=mat("string", "#d8d0b8", rough=0.8), parts=P, seg=4, name="string")
    cyl(0.018, 0.14, (0, 0.03, 0.175), rot=(90, 0, 0), m=M["poly"], parts=P, seg=14, name="scope")
    for y in (-0.04, 0.1):
        cyl(0.015, 0.003, (0, y, 0.175), rot=(90, 0, 0), m=M["glass"], parts=P, seg=14, name="lens")
    cyl(0.004, 0.36, (0, -0.16, 0.14), rot=(90, 0, 0), m=M["alu"], parts=P, seg=8, name="dart")
    cyl(0.009, 0.03, (0, -0.35, 0.14), rot=(90, 0, 0), m=M["orange"], parts=P, seg=10, name="dart_head")
    cyl(0.0015, 0.02, (0, -0.375, 0.14), rot=(90, 0, 0), m=M["alu"], parts=P, seg=6, name="dart_needle")
    for k in range(3):
        box((0.002, 0.04, 0.014), (0, 0.0, 0.14), rot=(0, k * 60, 0), m=M["orange"], parts=P, name="fletch")
    _trigger(P, 0.06, 0.085, M["poly"])
    return a


BUILDERS = {
    "rifle": rifle,
    "shotgun": shotgun,
    "pistol": pistol,
    "flare_gun": flare_gun,
    "ammo": ammo,
    "dna_case": dna_case,
    "sample_container": sample_container,
    "scanner_tablet": scanner_tablet,
    "sampler": sampler,
    "drone": drone,
    "biopsy_crossbow": biopsy_crossbow,
}
