"""01–05 and 21: dinosaurs and extra fauna. Front faces -Y, feet on Z = 0."""

import math

from lib import Asset, bake_skin, chain, cone, loft, mat, mirror_x, skin, sphere, tube, mesh_from, hex_rgb


def _eye(parts, x, y, z, r=0.09, color="#d9a520"):
    sphere(r, (x, y, z), m=mat("eye_" + color, color, rough=0.15, emit=color, strength=0.08), parts=parts, seg=12, rings=8)
    sphere(r * 0.45, (x * 1.03, y - r * 0.55, z), m=mat("pupil", "#0c0906", rough=0.1), parts=parts, seg=8, rings=6)


def _teeth(parts, pts, size=0.12, up=False):
    m = mat("tooth", "#e8dfc6", rough=0.35)
    for (x, y, z) in pts:
        cone(size * 0.35, size, (x, y, z), rot=(0 if up else 180, 0, 0), m=m, parts=parts, seg=6)


def _claws(parts, pts, size=0.25, pitch=100):
    m = mat("claw", "#2a241e", rough=0.3)
    for (x, y, z) in pts:
        cone(size * 0.3, size, (x, y, z), rot=(pitch, 0, 0), m=m, parts=parts, seg=6)


def _horn(parts, base, direction, r, length, m, seg=12):
    """Cone whose base sits at `base` and whose tip points along `direction` (cone() is centred)."""
    import mathutils
    d = mathutils.Vector(direction).normalized()
    c = cone(r, length, tuple(mathutils.Vector(base) + d * (length / 2)), m=m, parts=parts, seg=seg)
    c.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    return c


def _leg(nodes, edges, attach, pts):
    """Append a limb chain whose first point connects to node index `attach`."""
    start = len(nodes)
    nodes.extend(pts)
    edges.append((attach, start))
    edges.extend(chain(pts, start))
    return start


def trex():
    a = Asset("tyrannosaurus_rex", "dinosaurs")
    P = a.parts
    spine = [
        (0, 7.6, 2.55, 0.08), (0, 6.2, 2.95, 0.3, 0.32), (0, 4.7, 3.4, 0.52, 0.58), (0, 3.2, 3.85, 0.78, 0.85), (0, 1.7, 4.15, 1.0, 1.05),
        (0, 0.4, 4.1, 1.12, 1.2), (0, -0.9, 3.95, 1.05, 1.15), (0, -2.0, 4.0, 0.88, 0.95), (0, -2.75, 4.35, 0.66, 0.74),
        (0, -3.3, 4.8, 0.55, 0.62), (0, -3.75, 5.05, 0.5, 0.55),
    ]
    nodes = list(spine)
    edges = chain(spine)
    for s in (1, -1):
        _leg(nodes, edges, 4, [(s * 0.88, 1.2, 3.8, 0.64), (s * 1.0, 0.75, 2.95, 0.6), (s * 1.04, 0.2, 2.2, 0.4), (s * 1.02, 0.85, 0.95, 0.26), (s * 1.0, 0.3, 0.22, 0.25), (s * 1.0, -0.5, 0.14, 0.17)])
        _leg(nodes, edges, 7, [(s * 0.62, -2.2, 3.4, 0.16), (s * 0.72, -2.55, 2.95, 0.1), (s * 0.66, -2.9, 2.85, 0.06)])
    body = skin(nodes, edges, name="rex_body", levels=2)
    spec = {"base": "#5c5140", "dark": "#2b261d", "belly": "#a3927a", "stripes": 2.4, "blotch": 0.9, "scales": 11}
    bake_skin(body, spec, size=1024, name="rex")
    P.append(body)
    # skull: boxy, deep, flat-topped
    head = loft([
        (-3.55, 0, 5.1, 0.5, 0.55, 2.4), (-3.95, 0, 5.22, 0.62, 0.74, 3.0), (-4.45, 0, 5.22, 0.62, 0.76, 3.2),
        (-5.05, 0, 5.12, 0.52, 0.68, 3.2), (-5.7, 0, 4.98, 0.44, 0.55, 3.0), (-6.25, 0, 4.9, 0.36, 0.42, 2.8), (-6.62, 0, 4.86, 0.26, 0.3, 2.4),
    ], name="rex_head", seg=18, levels=1)
    bake_skin(head, {**spec, "base": "#5f5442", "scales": 16, "stripes": 3.0}, size=1024, name="rex_head")
    P.append(head)
    # lower jaw modelled already slightly open (hinge at y = -3.85): rotating the object
    # would pivot it around the world origin and push the tip up through the snout
    def jaw_z(y):
        return 4.4 - 0.17 * (-3.85 - y)

    jaw = loft([(y, 0, jaw_z(y), w, h, n) for y, w, h, n in ((-3.85, 0.5, 0.26, 2.6), (-4.6, 0.5, 0.24, 3.0), (-5.4, 0.42, 0.2, 3.0), (-6.2, 0.32, 0.15, 2.6), (-6.5, 0.24, 0.1, 2.2))],
               name="rex_jaw", seg=14, levels=1)
    bake_skin(jaw, {**spec, "base": "#6a5a46", "scales": 18}, size=512, name="rex_jaw")
    P.append(jaw)
    sphere(0.4, (0, -5.1, 4.34), scale=(0.95, 3.0, 0.5), m=mat("mouth", "#5a1e1a", rough=0.5), parts=P)
    _teeth(P, [(s * (0.46 - i * 0.022), -4.2 - i * 0.3, 4.5) for s in (1, -1) for i in range(8)], size=0.2)
    _teeth(P, [(s * (0.4 - i * 0.02), -4.35 - i * 0.3, jaw_z(-4.35 - i * 0.3) + 0.16) for s in (1, -1) for i in range(7)], size=0.14, up=True)
    for s in (1, -1):
        _eye(P, s * 0.6, -4.3, 5.55, 0.075, "#c08a2a")
        sphere(0.14, (s * 0.44, -4.25, 5.8), scale=(0.6, 1.8, 0.35), m=mat("brow", "#4a3f31", rough=0.8), parts=P)
        sphere(0.05, (s * 0.16, -6.52, 5.02), scale=(1, 1.5, 0.5), m=mat("nostril", "#221a14", rough=0.6), parts=P)
    _claws(P, [(s * 1.0 + dx, -0.62, 0.12) for s in (1, -1) for dx in (-0.16, 0, 0.16)], 0.3, pitch=105)
    return a


def triceratops():
    a = Asset("triceratops", "dinosaurs")
    P = a.parts
    spine = [(0, 4.3, 1.75, 0.07), (0, 3.3, 2.0, 0.34, 0.36), (0, 2.1, 2.35, 0.78, 0.82), (0, 0.8, 2.55, 1.02, 1.08), (0, -0.5, 2.5, 1.02, 1.08), (0, -1.6, 2.3, 0.88, 0.92), (0, -2.4, 2.15, 0.68, 0.72), (0, -2.9, 2.12, 0.55)]
    nodes = list(spine)
    edges = chain(spine)
    for s in (1, -1):
        _leg(nodes, edges, 3, [(s * 0.82, 1.0, 2.0, 0.55), (s * 0.95, 0.75, 1.1, 0.42), (s * 0.95, 0.95, 0.36, 0.3), (s * 0.95, 0.8, 0.1, 0.3)])
        _leg(nodes, edges, 5, [(s * 0.82, -1.7, 1.9, 0.46), (s * 1.0, -1.8, 1.1, 0.33), (s * 0.97, -1.9, 0.32, 0.27), (s * 0.97, -2.0, 0.1, 0.28)])
    body = skin(nodes, edges, name="tri_body", levels=2)
    spec = {"base": "#6b6a4c", "dark": "#3a3a26", "belly": "#a39f78", "stripes": 1.8, "scales": 12, "blotch": 0.9}
    bake_skin(body, spec, size=1024, name="tri")
    P.append(body)
    head = loft([(-2.7, 0, 2.2, 0.58, 0.66, 2.4), (-3.07, 0, 2.3, 0.8, 0.92, 2.8), (-3.52, 0, 2.22, 0.72, 0.9, 3.0), (-3.97, 0, 2.0, 0.52, 0.8, 3.0),
                 (-4.38, 0, 1.72, 0.36, 0.64, 2.6), (-4.67, 0, 1.46, 0.24, 0.5, 2.2), (-4.83, 0, 1.26, 0.12, 0.28, 2.0)], name="tri_head", seg=18, levels=1)
    bake_skin(head, {**spec, "scales": 16}, size=1024, name="tri_head")
    P.append(head)
    # frill: curved shield rising behind the skull
    import mathutils
    R, ring_n, rad_n = 1.0, 28, 6
    verts, faces = [(0.0, 0.0, 0.0)], []
    for j in range(1, rad_n + 1):
        for i in range(ring_n):
            ang = 2 * math.pi * i / ring_n
            rr = R * j / rad_n
            scallop = 1 + (0.06 if (i % 2 and j == rad_n) else 0)
            x, z = math.cos(ang) * rr * 1.75 * scallop, math.sin(ang) * rr * 1.5 * scallop
            verts.append((x, 0.45 * (rr / R) ** 2, z))
    for i in range(ring_n):
        faces.append((0, 1 + i, 1 + (i + 1) % ring_n))
    for j in range(rad_n - 1):
        b0, b1 = 1 + j * ring_n, 1 + (j + 1) * ring_n
        for i in range(ring_n):
            faces.append((b0 + i, b1 + i, b1 + (i + 1) % ring_n, b0 + (i + 1) % ring_n))
    frill = mesh_from(verts, faces, loc=(0, -2.55, 3.0), rot=(-38, 0, 0), name="frill", smooth=True)
    sol = frill.modifiers.new("s", "SOLIDIFY"); sol.thickness = 0.12
    from lib import apply_modifiers
    apply_modifiers(frill)
    bake_skin(frill, {"base": "#8a4b2c", "dark": "#3e2418", "belly": "#b07a4c", "stripes": 4.0, "blotch": 2.0, "scales": 18, "back_dark": 0.1}, size=512, name="tri_frill")
    P.append(frill)
    horn = mat("horn", "#e0d6b8", rough=0.45)
    rot = mathutils.Euler((math.radians(-38), 0, 0)).to_matrix()
    for i in range(0, ring_n, 2):
        ang = 2 * math.pi * i / ring_n
        if math.sin(ang) < -0.35:
            continue
        v = rot @ mathutils.Vector((math.cos(ang) * 1.85, 0.45, math.sin(ang) * 1.58))
        tip = cone(0.08, 0.3, (v.x, -2.55 + v.y, 3.0 + v.z), m=horn, parts=P, seg=6)
        dirv = (rot @ mathutils.Vector((math.cos(ang), 0, math.sin(ang)))).normalized()
        tip.rotation_euler = dirv.to_track_quat("Z", "Y").to_euler()
    for s in (1, -1):
        _horn(P, (s * 0.36, -3.4, 2.95), (s * 0.12, -0.85, 0.5), 0.17, 1.3, horn)
        _eye(P, s * 0.64, -3.42, 2.52, 0.07, "#1a140c")
        sphere(0.2, (s * 0.72, -3.1, 1.72), scale=(0.8, 1.0, 0.7), m=horn, parts=P)  # cheek horn
    _horn(P, (0, -4.3, 2.2), (0, -0.35, 1.0), 0.12, 0.42, horn, seg=10)
    loft([(-4.55, 0, 1.38, 0.2, 0.4, 2.2), (-4.78, 0, 1.18, 0.14, 0.3, 2.0), (-4.98, 0, 0.98, 0.04, 0.12, 2.0)],
         m=mat("beak", "#2e2a22", rough=0.4), parts=P, name="tri_beak", seg=12)
    _claws(P, [(s * 0.95 + dx, y, 0.07) for s in (1, -1) for y in (0.46, -2.3) for dx in (-0.15, 0, 0.15)], 0.13, pitch=110)
    return a


def velociraptor():
    import mathutils
    a = Asset("velociraptor", "dinosaurs")
    P = a.parts
    spine = [(0, 2.45, 0.95, 0.03), (0, 1.75, 1.0, 0.07), (0, 1.05, 1.05, 0.13), (0, 0.4, 1.08, 0.2, 0.22), (0, -0.15, 1.08, 0.23, 0.26), (0, -0.6, 1.14, 0.2, 0.24), (0, -0.85, 1.34, 0.11), (0, -0.95, 1.58, 0.09), (0, -1.08, 1.8, 0.09)]
    nodes = list(spine)
    edges = chain(spine)
    for s in (1, -1):
        _leg(nodes, edges, 3, [(s * 0.19, 0.35, 1.0, 0.15), (s * 0.21, 0.0, 0.62, 0.1), (s * 0.2, 0.3, 0.22, 0.055), (s * 0.2, 0.06, 0.05, 0.05), (s * 0.2, -0.14, 0.04, 0.035)])
        _leg(nodes, edges, 5, [(s * 0.15, -0.68, 1.05, 0.05), (s * 0.22, -0.8, 0.86, 0.038), (s * 0.2, -0.98, 0.8, 0.028)])
    body = skin(nodes, edges, name="rap_body", levels=2)
    spec = {"base": "#5a5a48", "dark": "#2a2b22", "belly": "#a09a7c", "stripes": 5.5, "scales": 34, "blotch": 2.2, "stripe_str": 1.0}
    bake_skin(body, spec, size=1024, name="rap")
    P.append(body)
    head = loft([(-1.03, 0, 1.86, 0.1, 0.11, 2.2), (-1.18, 0, 1.9, 0.12, 0.14, 2.6), (-1.36, 0, 1.88, 0.1, 0.12, 2.8), (-1.55, 0, 1.84, 0.075, 0.09, 2.6), (-1.72, 0, 1.8, 0.05, 0.06, 2.2), (-1.8, 0, 1.79, 0.03, 0.035, 2.0)], name="rap_head", seg=14, levels=1)
    bake_skin(head, {**spec, "scales": 60}, size=512, name="rap_head")
    P.append(head)
    jaw = loft([(-1.1, 0, 1.78, 0.09, 0.05, 2.4), (-1.4, 0, 1.75, 0.08, 0.045, 2.6), (-1.7, 0, 1.73, 0.045, 0.03, 2.2)], m=mat("rap_jaw", "#8a8468", rough=0.7), name="rap_jaw", seg=12, levels=1)
    P.append(jaw)
    feather = mat("feather", "#2a2822", rough=0.9)
    fe2 = mat("feather_tip", "#5a3a26", rough=0.9)
    for s in (1, -1):
        # forearm feather fan: overlapping flattened quills hanging back from the arm
        for j in range(5):
            t = j / 4
            x, y, z = s * (0.22 - 0.02 * t), -0.8 - 0.18 * t, 0.86 - 0.06 * t
            q = sphere(0.05, (x + s * 0.012, y + 0.05, z - 0.07), scale=(0.18, 0.75, 1.5 - 0.3 * t), m=feather if j % 2 else fe2, parts=P, seg=10, rings=6)
            q.rotation_euler = (math.radians(35), 0, 0)
        _eye(P, s * 0.1, -1.24, 1.97, 0.03, "#d9a520")
        c = cone(0.018, 0.12, (s * 0.2, -0.16, 0.12), m=mat("claw", "#2a241e", rough=0.3), parts=P, seg=6)
        c.rotation_euler = mathutils.Vector((0, -0.6, 0.8)).to_track_quat("Z", "Y").to_euler()
    for i in range(10):
        c = cone(0.022, 0.13 - i * 0.005, (0, -0.95 + i * 0.12 if i < 4 else 0.2 + (i - 4) * 0.35, 1.7 - i * 0.07 if i < 4 else 1.18 - (i - 4) * 0.035), m=feather if i % 2 else fe2, parts=P, seg=5)
        c.rotation_euler = mathutils.Vector((0, 0.8, 0.6)).to_track_quat("Z", "Y").to_euler()
    _teeth(P, [(s * 0.075, -1.3 - i * 0.07, 1.77) for s in (1, -1) for i in range(6)], size=0.04)
    return a


def spinosaurus():
    import mathutils
    a = Asset("spinosaurus", "dinosaurs")
    P = a.parts
    # tail nodes are narrow and tall: the paddle tail of the 2020 reconstructions
    spine = [(0, 7.8, 2.1, 0.05, 0.42), (0, 6.3, 2.45, 0.24, 0.72), (0, 4.7, 2.85, 0.55, 0.9), (0, 3.1, 3.25, 1.0, 1.1), (0, 1.5, 3.45, 1.25, 1.3), (0, 0.0, 3.4, 1.32, 1.35), (0, -1.5, 3.35, 1.15, 1.2), (0, -2.6, 3.5, 0.85, 0.9), (0, -3.3, 3.85, 0.62, 0.66), (0, -3.85, 4.05, 0.5, 0.55)]
    nodes = list(spine)
    edges = chain(spine)
    for s in (1, -1):
        _leg(nodes, edges, 4, [(s * 0.95, 1.3, 3.1, 0.62), (s * 1.08, 0.6, 2.05, 0.5), (s * 1.02, 1.15, 0.85, 0.24), (s * 1.0, 0.45, 0.18, 0.22), (s * 1.0, -0.3, 0.12, 0.14)])
        _leg(nodes, edges, 6, [(s * 0.85, -1.7, 2.8, 0.36), (s * 1.0, -2.2, 2.0, 0.26), (s * 1.0, -2.55, 1.25, 0.17)])
    body = skin(nodes, edges, name="spi_body", levels=2)
    spec = {"base": "#55605a", "dark": "#26302c", "belly": "#9aa090", "stripes": 2.2, "scales": 12, "blotch": 1.0}
    bake_skin(body, spec, size=1024, name="spi")
    P.append(body)
    head = loft([(-3.8, 0, 4.12, 0.44, 0.52, 2.4), (-4.35, 0, 4.16, 0.4, 0.48, 2.8), (-5.0, 0, 4.06, 0.28, 0.32, 3.0), (-5.8, 0, 3.96, 0.2, 0.22, 2.8), (-6.6, 0, 3.88, 0.16, 0.18, 2.6), (-7.15, 0, 3.86, 0.21, 0.19, 2.4), (-7.45, 0, 3.86, 0.14, 0.13, 2.0)], name="spi_head", seg=16, levels=1)
    bake_skin(head, {**spec, "scales": 16}, size=1024, name="spi_head")
    P.append(head)
    jaw = loft([(-4.0, 0, 3.66, 0.36, 0.14, 2.6), (-5.0, 0, 3.66, 0.24, 0.1, 2.8), (-6.4, 0, 3.66, 0.15, 0.08, 2.6), (-7.2, 0, 3.66, 0.16, 0.08, 2.2)], m=mat("spi_jaw", "#7c8474", rough=0.7), name="spi_jaw", seg=12, levels=1)
    P.append(jaw)
    def sail_top(tt):
        return 4.3 + math.sin(tt * math.pi) ** 0.7 * 2.7 + 0.08 * math.sin(tt * 29)

    n, rows = 26, 5
    verts, faces = [], []
    for j in range(rows + 1):
        for i in range(n + 1):
            tt = i / n
            lo = 3.6 + 0.55 * math.sin(tt * math.pi)
            verts.append((0, 3.9 - tt * 6.9, lo + (sail_top(tt) - lo) * j / rows))
    for j in range(rows):
        for i in range(n):
            a0 = j * (n + 1) + i
            faces.append((a0, a0 + 1, a0 + n + 2, a0 + n + 1))
    sail = mesh_from(verts, faces, name="sail", smooth=True)
    from lib import apply_modifiers
    sol = sail.modifiers.new("s", "SOLIDIFY"); sol.thickness = 0.08
    apply_modifiers(sail)
    bake_skin(sail, {"base": "#9a4a30", "dark": "#4a1c14", "belly": "#c87a48", "stripes": 5.0, "stripe_str": 1.0, "blotch": 1.4, "scales": 20, "back_dark": 0.0}, size=512, name="spi_sail", rough=0.6)
    P.append(sail)
    for i in range(14):
        tt = (i + 0.5) / 14
        y = 3.9 - tt * 6.9
        tube([(0, y, 3.7), (0, y, sail_top(tt) + 0.04)], [0.06, 0.03], m=mat("spine_rod", "#5a2418", rough=0.6), parts=P, seg=6)
    _teeth(P, [(s * 0.17, -5.0 - i * 0.28, 3.74) for s in (1, -1) for i in range(8)], size=0.14)
    for s in (1, -1):
        _eye(P, s * 0.36, -4.35, 4.4, 0.075, "#e8c24a")
    _claws(P, [(s * 1.0 + dx, -0.4, 0.1) for s in (1, -1) for dx in (-0.12, 0.12)], 0.24, pitch=105)
    return a


def pteranodon():
    a = Asset("pteranodon", "dinosaurs")
    P = a.parts
    spine = [(0, 0.55, 1.25, 0.05), (0, 0.2, 1.3, 0.15), (0, -0.2, 1.35, 0.19), (0, -0.55, 1.45, 0.12), (0, -0.75, 1.6, 0.09), (0, -0.98, 1.66, 0.12), (0, -1.9, 1.6, 0.045), (0, -2.4, 1.56, 0.018)]
    nodes = list(spine)
    edges = chain(spine)
    for s in (1, -1):
        _leg(nodes, edges, 1, [(s * 0.13, 0.35, 1.2, 0.05), (s * 0.17, 0.65, 1.12, 0.035), (s * 0.19, 0.9, 1.08, 0.025)])
        _leg(nodes, edges, 2, [(s * 0.2, -0.2, 1.4, 0.07), (s * 1.3, 0.05, 1.55, 0.05), (s * 2.4, -0.2, 1.62, 0.04), (s * 3.55, 0.1, 1.5, 0.02)])
    body = skin(nodes, edges, name="pte_body", levels=2)
    bake_skin(body, {"base": "#8a6a4a", "dark": "#4a3626", "belly": "#c9b494", "stripes": 3.0, "scales": 40, "blotch": 2.0}, size=512, name="pte")
    P.append(body)
    from lib import apply_modifiers
    # crest: a blade swept back from the skull, deepest near the eye
    cv = [(0, -1.08, 1.7), (0, -0.62, 1.72), (0, -0.1, 1.86), (0, 0.42, 2.04), (0, 0.3, 2.1), (0, -0.25, 2.0), (0, -0.8, 1.84)]
    crest = mesh_from(cv, [(0, 1, 6), (1, 5, 6), (1, 2, 5), (2, 4, 5), (2, 3, 4)], name="crest", smooth=True)
    sol = crest.modifiers.new("s", "SOLIDIFY"); sol.thickness = 0.035
    apply_modifiers(crest)
    bake_skin(crest, {"base": "#b8542e", "dark": "#5a2016", "belly": "#d08a50", "stripes": 2.0, "blotch": 3.0, "scales": 60, "back_dark": 0.0}, size=256, name="pte_crest", rough=0.55)
    P.append(crest)
    for s in (1, -1):
        v = [(s * 0.15, -0.28, 1.43), (s * 1.3, 0.02, 1.55), (s * 2.4, -0.23, 1.62), (s * 3.58, 0.12, 1.5), (s * 2.1, 0.62, 1.44), (s * 0.9, 0.72, 1.34), (s * 0.15, 0.48, 1.28)]
        f = [(0, 1, 6), (1, 5, 6), (1, 2, 5), (2, 4, 5), (2, 3, 4)]
        w = mesh_from(v, f, name="wing")
        sol = w.modifiers.new("s", "SOLIDIFY"); sol.thickness = 0.02
        apply_modifiers(w)
        bake_skin(w, {"base": "#7a5236", "dark": "#3e2818", "belly": "#9a7050", "stripes": 1.0, "blotch": 1.6, "scales": 50, "back_dark": 0.2}, size=512, name="pte_wing_" + ("r" if s > 0 else "l"))
        P.append(w)
        _eye(P, s * 0.1, -0.86, 1.72, 0.028, "#1a120a")
    return a


def brachiosaurus():
    a = Asset("brachiosaurus", "fauna")
    P = a.parts
    spine = [(0, 10.0, 2.5, 0.07), (0, 8.0, 3.4, 0.3), (0, 5.8, 4.4, 0.62), (0, 4.0, 5.2, 0.95), (0, 2.2, 5.9, 1.6, 1.7), (0, 0.4, 6.4, 1.9, 2.0), (0, -1.4, 6.9, 1.7, 1.8), (0, -2.8, 7.6, 1.2), (0, -3.6, 9.0, 0.85), (0, -4.2, 11.0, 0.66), (0, -4.6, 13.0, 0.52), (0, -4.9, 14.6, 0.44), (0, -5.1, 15.4, 0.4)]
    nodes = list(spine)
    edges = chain(spine)
    for s in (1, -1):
        # spine indices shifted by one after the longer tail: 4 = hips, 6 = shoulders
        _leg(nodes, edges, 4, [(s * 1.2, 2.2, 5.2, 0.9), (s * 1.35, 2.45, 3.0, 0.62), (s * 1.35, 2.15, 1.1, 0.46), (s * 1.38, 2.05, 0.28, 0.56)])
        _leg(nodes, edges, 6, [(s * 1.2, -1.5, 6.2, 0.85), (s * 1.4, -1.45, 3.7, 0.56), (s * 1.4, -1.7, 1.3, 0.42), (s * 1.42, -1.75, 0.28, 0.5)])
    body = skin(nodes, edges, name="bra_body", levels=2)
    spec = {"base": "#6c7866", "dark": "#3e4a3c", "belly": "#a8ae98", "stripes": 1.2, "scales": 8, "blotch": 0.6}
    bake_skin(body, spec, size=1024, name="bra")
    P.append(body)
    head = loft([(-4.9, 0, 15.6, 0.42, 0.48, 2.4), (-5.4, 0, 15.75, 0.46, 0.5, 2.8), (-5.95, 0, 15.55, 0.38, 0.38, 2.8), (-6.35, 0, 15.35, 0.3, 0.28, 2.4)], name="bra_head", seg=14, levels=1)
    bake_skin(head, {**spec, "scales": 14}, size=512, name="bra_head")
    P.append(head)
    sphere(0.28, (0, -5.35, 16.2), scale=(0.9, 1.2, 0.8), m=mat("bra_crest", "#6a7662", rough=0.8), parts=P)
    for s in (1, -1):
        _eye(P, s * 0.42, -5.5, 15.85, 0.07, "#1a140c")
    return a


def parasaurolophus():
    import mathutils
    a = Asset("parasaurolophus", "fauna")
    P = a.parts
    spine = [(0, 4.2, 1.9, 0.07), (0, 3.0, 2.2, 0.36), (0, 1.8, 2.45, 0.72, 0.78), (0, 0.6, 2.6, 0.88, 0.95), (0, -0.6, 2.55, 0.8, 0.9), (0, -1.5, 2.6, 0.56),
             (0, -2.1, 2.92, 0.36), (0, -2.45, 3.3, 0.27), (0, -2.62, 3.62, 0.24)]
    nodes = list(spine)
    edges = chain(spine)
    for s in (1, -1):
        _leg(nodes, edges, 3, [(s * 0.62, 0.8, 2.2, 0.5), (s * 0.7, 0.3, 1.35, 0.36), (s * 0.68, 0.75, 0.45, 0.18), (s * 0.68, 0.35, 0.1, 0.18), (s * 0.68, -0.05, 0.08, 0.12)])
        # arms branch from the chest node: branching from the widest node folds the skin hull
        _leg(nodes, edges, 5, [(s * 0.5, -1.45, 2.2, 0.2), (s * 0.58, -1.35, 1.25, 0.14), (s * 0.58, -1.4, 0.4, 0.11), (s * 0.58, -1.5, 0.08, 0.1)])
    body = skin(nodes, edges, name="par_body", levels=2)
    spec = {"base": "#7a6a48", "dark": "#4a3e28", "belly": "#b4a47e", "stripes": 3.0, "scales": 14, "blotch": 1.1}
    bake_skin(body, spec, size=1024, name="par")
    P.append(body)
    # duck-bill: narrows behind the beak, then flares wide and flat
    head = loft([(-2.5, 0, 3.78, 0.25, 0.28, 2.4), (-2.85, 0, 3.8, 0.25, 0.27, 2.6), (-3.2, 0, 3.64, 0.18, 0.2, 2.6), (-3.5, 0, 3.5, 0.19, 0.13, 3.0),
                 (-3.72, 0, 3.42, 0.2, 0.09, 3.2), (-3.82, 0, 3.4, 0.14, 0.06, 2.4)], name="par_head", seg=16, levels=1)
    bake_skin(head, {**spec, "scales": 22}, size=512, name="par_head")
    P.append(head)
    crest = tube([(0, -3.0, 3.95), (0, -2.6, 4.2), (0, -2.1, 4.42), (0, -1.55, 4.55), (0, -1.1, 4.56)], [0.12, 0.13, 0.12, 0.1, 0.06], seg=12, name="par_crest")
    bake_skin(crest, {"base": "#b0582e", "dark": "#5a2a16", "belly": "#c8784a", "stripes": 3.0, "blotch": 2.0, "scales": 30, "back_dark": 0.2}, size=256, name="par_crest", rough=0.6)
    P.append(crest)
    for s in (1, -1):
        _eye(P, s * 0.23, -2.9, 3.9, 0.045, "#1a140c")
    return a


def compsognathus():
    a = Asset("compsognathus", "fauna")
    P = a.parts
    spine = [(0, 0.75, 0.3, 0.012), (0, 0.45, 0.33, 0.025), (0, 0.15, 0.36, 0.05), (0, -0.05, 0.37, 0.065), (0, -0.2, 0.4, 0.05), (0, -0.28, 0.5, 0.028), (0, -0.33, 0.58, 0.03)]
    nodes = list(spine)
    edges = chain(spine)
    for s in (1, -1):
        _leg(nodes, edges, 2, [(s * 0.05, 0.12, 0.33, 0.04), (s * 0.06, 0.02, 0.2, 0.025), (s * 0.06, 0.1, 0.07, 0.014), (s * 0.06, 0.02, 0.015, 0.013), (s * 0.06, -0.04, 0.012, 0.009)])
        _leg(nodes, edges, 4, [(s * 0.04, -0.2, 0.35, 0.012), (s * 0.05, -0.24, 0.28, 0.009)])
    body = skin(nodes, edges, name="comp_body", levels=2)
    bake_skin(body, {"base": "#6a7a3d", "dark": "#343e1c", "belly": "#b4b880", "stripes": 8, "scales": 120, "blotch": 5}, size=512, name="comp")
    P.append(body)
    head = loft([(-0.32, 0, 0.6, 0.035, 0.04, 2.4), (-0.38, 0, 0.61, 0.036, 0.04, 2.6), (-0.45, 0, 0.59, 0.024, 0.026, 2.4), (-0.5, 0, 0.58, 0.012, 0.014, 2)], m=mat("comp_head", "#6a7a3d", rough=0.7), name="comp_head", seg=12, levels=1)
    P.append(head)
    for s in (1, -1):
        _eye(P, s * 0.03, -0.39, 0.625, 0.01, "#c8a020")
    return a


def deinosuchus():
    a = Asset("deinosuchus", "fauna")
    P = a.parts
    spine = [(0, 4.8, 0.35, 0.06), (0, 3.6, 0.4, 0.3, 0.25), (0, 2.2, 0.48, 0.5, 0.35), (0, 0.8, 0.52, 0.72, 0.42), (0, -0.6, 0.52, 0.72, 0.42), (0, -1.6, 0.5, 0.52, 0.34), (0, -2.2, 0.5, 0.4, 0.3)]
    nodes = list(spine)
    edges = chain(spine)
    for s in (1, -1):
        _leg(nodes, edges, 3, [(s * 0.7, 0.9, 0.4, 0.2), (s * 1.1, 0.7, 0.2, 0.14), (s * 1.2, 0.5, 0.05, 0.12)])
        _leg(nodes, edges, 5, [(s * 0.55, -1.5, 0.4, 0.16), (s * 0.95, -1.7, 0.2, 0.12), (s * 1.05, -1.9, 0.05, 0.1)])
    body = skin(nodes, edges, name="croc_body", levels=2)
    spec = {"base": "#4a5238", "dark": "#262c1a", "belly": "#9a9a78", "stripes": 2.0, "scales": 7, "blotch": 1.2}
    bake_skin(body, spec, size=1024, name="croc")
    P.append(body)
    head = loft([(-2.1, 0, 0.55, 0.42, 0.26, 3.0), (-2.7, 0, 0.52, 0.36, 0.22, 3.2), (-3.5, 0, 0.46, 0.26, 0.16, 3.2), (-4.2, 0, 0.42, 0.2, 0.12, 3.0), (-4.5, 0, 0.42, 0.16, 0.1, 2.4)], name="croc_head", seg=16, levels=1)
    bake_skin(head, {**spec, "scales": 10}, size=512, name="croc_head")
    P.append(head)
    osteo = mat("scute", "#343a26", rough=0.8)
    for i in range(14):
        for s in (1, -1):
            cone(0.07, 0.14, (s * 0.2, 2.6 - i * 0.33, 0.92 - abs(i - 6) * 0.015), m=osteo, parts=P, seg=5)
    for s in (1, -1):
        _eye(P, s * 0.22, -2.55, 0.78, 0.05, "#c9b04a")
    _teeth(P, [(s * (0.3 - i * 0.02), -2.5 - i * 0.26, 0.34) for s in (1, -1) for i in range(8)], size=0.1, up=True)
    return a


def eva0():
    import mathutils
    a = Asset("eva_0", "fauna")
    P = a.parts
    spine = [(0, 5.2, 1.9, 0.08), (0, 4.0, 2.2, 0.36), (0, 2.6, 2.5, 0.6), (0, 1.2, 2.7, 0.86, 0.9), (0, -0.2, 2.65, 0.92, 1.0), (0, -1.4, 2.6, 0.78), (0, -2.1, 2.45, 0.52), (0, -2.7, 2.25, 0.42)]
    nodes = list(spine)
    edges = chain(spine)
    for s in (1, -1):
        _leg(nodes, edges, 3, [(s * 0.72, 1.2, 2.4, 0.56), (s * 0.82, 0.7, 1.55, 0.44), (s * 0.8, 1.2, 0.65, 0.2), (s * 0.8, 0.6, 0.14, 0.19), (s * 0.8, 0.0, 0.1, 0.12)])
        _leg(nodes, edges, 5, [(s * 0.7, -1.4, 2.3, 0.26), (s * 0.95, -1.8, 1.7, 0.2), (s * 0.95, -2.3, 1.2, 0.14)])
    body = skin(nodes, edges, name="eva_body", levels=2)
    spec = {"base": "#c9c3b6", "dark": "#948d80", "belly": "#e0dace", "stripes": 1.4, "scales": 18, "blotch": 1.4, "stripe_str": 0.4}
    bake_skin(body, spec, size=1024, name="eva")
    P.append(body)
    head = loft([(-2.6, 0, 2.2, 0.36, 0.34, 2.4), (-3.1, 0, 2.15, 0.34, 0.3, 2.8), (-3.6, 0, 2.02, 0.26, 0.24, 2.8), (-4.0, 0, 1.92, 0.16, 0.15, 2.4)], name="eva_head", seg=14, levels=1)
    bake_skin(head, {**spec, "scales": 22}, size=512, name="eva_head")
    P.append(head)
    claw = mat("claw", "#2a241e", rough=0.3)
    for s in (1, -1):
        for k in (-1, 0, 1):
            c = cone(0.05, 0.9, (s * 0.95 + k * 0.08, -2.45, 1.1), m=claw, parts=P, seg=6)
            c.rotation_euler = mathutils.Vector((0, -0.55, -0.85)).to_track_quat("Z", "Y").to_euler()
        sphere(0.06, (s * 0.3, -3.05, 2.32), m=mat("eva_eye", "#8f9aa0", rough=0.05), parts=P, seg=10, rings=8)
    return a


def fish():
    """River fish, about 65 cm: fusiform body, forked tail, dorsal and pectoral fins."""
    from lib import apply_modifiers
    a = Asset("fish", "fauna")
    P = a.parts
    body = loft([(-0.31, 0, 0.12, 0.006, 0.012, 2), (-0.28, 0, 0.12, 0.028, 0.045, 2), (-0.2, 0, 0.125, 0.046, 0.078, 2), (-0.06, 0, 0.13, 0.056, 0.1, 2.1),
                 (0.1, 0, 0.126, 0.046, 0.084, 2.1), (0.22, 0, 0.12, 0.026, 0.048, 2), (0.3, 0, 0.12, 0.012, 0.024, 2), (0.34, 0, 0.12, 0.01, 0.02, 2)], name="fish_body", seg=16, levels=1)
    bake_skin(body, {"base": "#7d8c80", "dark": "#2c3a36", "belly": "#dcdfd2", "stripes": 9.0, "stripe_str": 0.5, "blotch": 6.0, "scales": 140, "back_dark": 0.6, "bump": 0.25}, size=512, name="fish", rough=0.3)
    P.append(body)
    fin = mat("fin", "#5a6a60", rough=0.45)

    def sheet(v, f, name):
        ob = mesh_from(v, f, m=fin, name=name)
        ob.modifiers.new("s", "SOLIDIFY").thickness = 0.004
        apply_modifiers(ob)
        P.append(ob)

    sheet([(0, 0.325, 0.12), (0, 0.46, 0.22), (0, 0.4, 0.12), (0, 0.46, 0.02)], [(0, 1, 2), (0, 2, 3)], "tail")
    sheet([(0, -0.1, 0.215), (0, 0.04, 0.29), (0, 0.1, 0.205)], [(0, 1, 2)], "dorsal")
    sheet([(0, 0.14, 0.05), (0, 0.22, 0.02), (0, 0.22, 0.075)], [(0, 1, 2)], "anal")
    for s in (1, -1):
        sheet([(s * 0.045, -0.17, 0.09), (s * 0.1, -0.08, 0.06), (s * 0.06, -0.1, 0.1)], [(0, 1, 2)], "pectoral")
        _eye(P, s * 0.028, -0.245, 0.14, 0.011, "#c8c2a0")
    return a


def lizard():
    a = Asset("lizard", "fauna")
    P = a.parts
    spine = [(0, 0.5, 0.045, 0.006), (0, 0.3, 0.05, 0.014), (0, 0.1, 0.058, 0.028, 0.022), (0, -0.05, 0.06, 0.033, 0.026), (0, -0.18, 0.064, 0.022), (0, -0.25, 0.066, 0.017)]
    nodes = list(spine)
    edges = chain(spine)
    for s in (1, -1):
        # sprawling legs: thigh out to the side, knee up, foot flat and forward
        _leg(nodes, edges, 2, [(s * 0.045, 0.1, 0.05, 0.011), (s * 0.085, 0.1, 0.04, 0.008), (s * 0.1, 0.08, 0.006, 0.006), (s * 0.105, 0.06, 0.004, 0.005)])
        _leg(nodes, edges, 4, [(s * 0.035, -0.16, 0.055, 0.009), (s * 0.07, -0.16, 0.04, 0.007), (s * 0.085, -0.18, 0.006, 0.005), (s * 0.09, -0.2, 0.004, 0.004)])
    body = skin(nodes, edges, name="liz", levels=2)
    spec = {"base": "#6a8a3a", "dark": "#2a3a1a", "belly": "#c8c890", "stripes": 12, "scales": 200, "blotch": 8}
    bake_skin(body, spec, size=512, name="liz")
    P.append(body)
    head = loft([(-0.24, 0, 0.068, 0.02, 0.017, 2.2), (-0.28, 0, 0.068, 0.021, 0.016, 2.4), (-0.32, 0, 0.062, 0.014, 0.011, 2.2), (-0.345, 0, 0.058, 0.006, 0.005, 2)], name="liz_head", seg=12, levels=1)
    bake_skin(head, {**spec, "scales": 320}, size=256, name="liz_head")
    P.append(head)
    for s in (1, -1):
        _eye(P, s * 0.017, -0.285, 0.078, 0.005, "#c8a020")
    return a


BUILDERS = {
    "tyrannosaurus_rex": trex,
    "triceratops": triceratops,
    "velociraptor": velociraptor,
    "spinosaurus": spinosaurus,
    "pteranodon": pteranodon,
}
FAUNA = {
    "brachiosaurus": brachiosaurus,
    "parasaurolophus": parasaurolophus,
    "compsognathus": compsognathus,
    "deinosuchus": deinosuchus,
    "eva_0": eva0,
    "fish": fish,
    "lizard": lizard,
}
