"""Key art for store pages: the Queen roaring on a rock above the jungle valley at golden hour.

    python3 games/expedition-d05/assets/blender/keyart.py cover games/expedition-d05/assets/previews/keyart/cover.png 256
    python3 games/expedition-d05/assets/blender/keyart.py icon  games/expedition-d05/assets/previews/keyart/icon.png 256

then web/store/make_store_art.py letters and sizes them for the store. The renders are not
versioned (previews/*/ is ignored, like the per-asset previews). A few minutes each on a CPU.

The T-Rex is the author's rigged Meshy model (assets/meshy/trext.glb), posed through its
skeleton and set down on the rock by measuring the posed mesh, so its feet touch the stone.
Everything else is built here: the valley and the volcano are one height field, the forest is
instanced from a handful of stylised plant meshes, and a homogeneous volume over the valley
gives the haze and the light shafts. Store fronts such as Yandex Games refuse a screenshot as an
icon or cover, which is why this is a render and not a frame from the game.
"""

import math
import os
import random
import sys

import bpy  # first: bmesh and mathutils come from the bpy module
import bmesh  # noqa: E402
from mathutils import Euler, Vector, noise  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.dirname(HERE)
TREX = os.path.join(ASSETS, "meshy", "trext.glb")
PTERA = os.path.join(ASSETS, "models", "dinosaurs", "pteranodon.glb")

SUN_DIR = Vector((-0.47, 0.87, 0.2)).normalized()  # low over the ridge, left of centre: in the frame  # toward the sun: low, from the left of the frame
REX_AT = Vector((8.0, 28.0, 0.0))
REX_HEADING = -97.0  # degrees about Z; 0 leaves the model's head pointing at -Y. -97: roaring to the left
REX_SCALE = 2.6  # the Meshy model is 4.9 m nose to tail; a Queen is about 12 m


# ---------- small helpers ----------

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def principled(name, color, rough=0.8, spec=0.3, vary=0.0, sss=0.0):
    """A plain material; vary > 0 shifts the colour a little per object (Object Info random)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = rough
    b.inputs["Specular IOR Level"].default_value = spec
    if vary:
        info = nt.nodes.new("ShaderNodeObjectInfo")
        hsv = nt.nodes.new("ShaderNodeHueSaturation")
        hsv.inputs["Color"].default_value = (*color, 1)
        ramp = nt.nodes.new("ShaderNodeMapRange")
        ramp.inputs["To Min"].default_value = 1 - vary
        ramp.inputs["To Max"].default_value = 1 + vary
        nt.links.new(info.outputs["Random"], ramp.inputs["Value"])
        nt.links.new(ramp.outputs["Result"], hsv.inputs["Value"])
        hue = nt.nodes.new("ShaderNodeMapRange")
        hue.inputs["To Min"].default_value = 0.5 - vary * 0.12
        hue.inputs["To Max"].default_value = 0.5 + vary * 0.12
        nt.links.new(info.outputs["Random"], hue.inputs["Value"])
        nt.links.new(hue.outputs["Result"], hsv.inputs["Hue"])
        nt.links.new(hsv.outputs["Color"], b.inputs["Base Color"])
    else:
        b.inputs["Base Color"].default_value = (*color, 1)
    if sss:
        b.inputs["Subsurface Weight"].default_value = sss
    return m


def mesh_object(name, build, mat=None):
    bm = bmesh.new()
    build(bm)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if mat:
        me.materials.append(mat)
    return link(bpy.data.objects.new(name, me))


def fbm(x, y, octaves=5, seed=0.0):
    v, a, f = 0.0, 1.0, 1.0
    for _ in range(octaves):
        v += a * noise.noise(Vector((x * f + seed, y * f - seed, seed * 0.37)))
        a *= 0.5
        f *= 2.03
    return v


def smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ---------- the land ----------

VOLCANO = Vector((-150.0, 760.0))


def ground_h(x, y):
    """The valley floor 26 m below the rock, low hills, then the ridge and the volcano far off."""
    h = -26.0 + 5.0 * fbm(x / 110, y / 110, 4, 3.1)
    far = smooth(360, 700, y)
    ridge = 1 - abs(fbm(x / 260, y / 260, 4, 7.7))
    h += far * (40 + 150 * ridge * ridge)
    d = (Vector((x, y)) - VOLCANO).length
    cone = 330 * max(0.0, 1 - d / 330) ** 1.35
    crater = 60 * max(0.0, 1 - d / 45) ** 2
    h = max(h, -26 + cone - crater + 8 * fbm(x / 40, y / 40, 3, 1.3) * min(1.0, cone / 60))
    return h


def terrain():
    nx, ny = 220, 170
    x0, x1, y0, y1 = -900.0, 900.0, -260.0, 1150.0

    def build(bm):
        verts = []
        for j in range(ny + 1):
            # rows closer together near the camera, where the detail shows
            y = y0 + (y1 - y0) * (j / ny) ** 1.4
            row = []
            for i in range(nx + 1):
                x = x0 + (x1 - x0) * i / nx
                row.append(bm.verts.new((x, y, ground_h(x, y))))
            verts.append(row)
        for j in range(ny):
            for i in range(nx):
                bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))

    m = bpy.data.materials.new("land")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.95
    b.inputs["Specular IOR Level"].default_value = 0.15
    # grass in the valley, bare rock on the steep ridge, dark ash near the volcano's top
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], sep.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = (0.10, 0.21, 0.05, 1)
    cr.elements[1].position = 1.0
    cr.elements[1].color = (0.09, 0.08, 0.075, 1)
    e = cr.elements.new(0.12); e.color = (0.16, 0.26, 0.07, 1)
    e = cr.elements.new(0.3); e.color = (0.25, 0.22, 0.16, 1)
    e = cr.elements.new(0.62); e.color = (0.22, 0.19, 0.16, 1)
    rng = nt.nodes.new("ShaderNodeMapRange")
    rng.inputs["From Min"].default_value = -30
    rng.inputs["From Max"].default_value = 300
    nt.links.new(sep.outputs["Z"], rng.inputs["Value"])
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 0.02
    add = nt.nodes.new("ShaderNodeMath"); add.operation = "MULTIPLY_ADD"
    add.inputs[1].default_value = 0.08
    nt.links.new(tex.outputs["Fac"], add.inputs[0])
    nt.links.new(rng.outputs["Result"], add.inputs[2])
    nt.links.new(add.outputs[0], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    ob = mesh_object("terrain", build, m)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def rock():
    """The promontory the Queen stands on: a long slab with a flat, mossy top at z = 0."""
    rnd = random.Random(5)

    def build(bm):
        bmesh.ops.create_icosphere(bm, subdivisions=4, radius=1.0)
        for v in bm.verts:
            x, y, z = v.co
            v.co = Vector((x * 21, y * 11.5, z * 30))
            top = v.co.z > -3
            n = fbm(v.co.x / 9, v.co.y / 9, 4, 2.2)
            if top:
                v.co.z = min(v.co.z, 0.0) + 0.5 * n + 0.6 * fbm(v.co.x / 3, v.co.y / 3, 2, 8.8)
            else:
                v.co += Vector((n * 1.6, fbm(v.co.y / 7, v.co.z / 7, 3, 4.4) * 1.6, 0))
            v.co.z = max(v.co.z, -34)
        # a promontory reaching in from the right; the Queen stands near its tip
        bmesh.ops.translate(bm, verts=bm.verts, vec=Vector((18.0, 29.0, 0.0)))

    m = bpy.data.materials.new("rock")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.9
    b.inputs["Specular IOR Level"].default_value = 0.2
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Normal"], sep.inputs[0])
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 0.6
    tex.inputs["Detail"].default_value = 6
    mixn = nt.nodes.new("ShaderNodeMath"); mixn.operation = "MULTIPLY_ADD"
    mixn.inputs[1].default_value = 0.3
    nt.links.new(tex.outputs["Fac"], mixn.inputs[0])
    nt.links.new(sep.outputs["Z"], mixn.inputs[2])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position = 0.45
    cr.elements[0].color = (0.11, 0.095, 0.08, 1)
    cr.elements[1].position = 1.0
    cr.elements[1].color = (0.055, 0.065, 0.025, 1)
    e = cr.elements.new(0.72); e.color = (0.16, 0.14, 0.115, 1)
    e = cr.elements.new(0.88); e.color = (0.085, 0.085, 0.05, 1)
    nt.links.new(mixn.outputs[0], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.4
    nt.links.new(tex.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    ob = mesh_object("rock", build, m)
    # boulders along the rim and at the tip, so the top is not a clean disc
    rnd2 = random.Random(9)
    for k in range(26):
        a = rnd2.uniform(0, 2 * math.pi)
        rr = rnd2.uniform(0.82, 1.0)
        cx, cy = 18 + 21 * rr * math.cos(a), 29 + 11.5 * rr * math.sin(a)
        if (Vector((cx, cy)) - REX_AT.xy).length < 7:
            continue

        def boulder(bm, cx=cx, cy=cy, size=rnd2.uniform(0.8, 2.4), seed=k):
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=size)
            for v in bm.verts:
                v.co *= 1 + 0.3 * noise.noise(v.co * 1.3 + Vector((seed, 0, 0)))
                v.co.z *= 0.7
                v.co += Vector((cx, cy, -size * 0.35))

        mesh_object("boulder", boulder, m)
    return ob


# ---------- plants: a few stylised meshes, instanced thousands of times ----------

def cone_ring(bm, z0, z1, r, sides=7, twist=0.0):
    top = bm.verts.new((0, 0, z1))
    ring = [bm.verts.new((r * math.cos(a), r * math.sin(a), z0)) for a in
            (twist + 2 * math.pi * i / sides for i in range(sides))]
    for i in range(sides):
        bm.faces.new((ring[i], ring[(i + 1) % sides], top))
    bm.faces.new(list(reversed(ring)))


def trunk(bm, h, r, sides=6):
    bot = [bm.verts.new((r * math.cos(a), r * math.sin(a), -0.3)) for a in (2 * math.pi * i / sides for i in range(sides))]
    top = [bm.verts.new((r * 0.6 * math.cos(a), r * 0.6 * math.sin(a), h)) for a in (2 * math.pi * i / sides for i in range(sides))]
    for i in range(sides):
        bm.faces.new((bot[i], bot[(i + 1) % sides], top[(i + 1) % sides], top[i]))


def conifer_mesh(name, bark, needles):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    trunk(bm, 3.0, 0.22)
    tiers = 4
    for k in range(tiers):
        z0 = 1.6 + k * 2.1
        cone_ring(bm, z0, z0 + 3.6 - k * 0.3, 2.3 - k * 0.45, 8, k * 0.4)
    bm.to_mesh(me)
    bm.free()
    for i, p in enumerate(me.polygons):
        p.material_index = 0 if i < 6 else 1
    me.materials.append(bark)
    me.materials.append(needles)
    return me


def frond(bm, base, direction, length, width, droop, segs=5):
    """A leaf: a narrow strip that arches outward and down from base along direction."""
    side = direction.cross(Vector((0, 0, 1))).normalized()
    pts = []
    for s in range(segs + 1):
        t = s / segs
        p = base + direction * (length * t) + Vector((0, 0, length * (0.35 * t - droop * t * t)))
        w = width * math.sin(math.pi * min(1.0, t * 1.1 + 0.05))
        pts.append((bm.verts.new(p - side * w), bm.verts.new(p + side * w)))
    for s in range(segs):
        a, b = pts[s], pts[s + 1]
        bm.faces.new((a[0], b[0], b[1], a[1]))


def palm_mesh(name, bark, leaf):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    # a gently leaning trunk in segments
    h, r, lean = 9.0, 0.28, 0.9
    rings = []
    for k in range(7):
        t = k / 6
        c = Vector((lean * t * t, 0, h * t))
        rr = r * (1 - 0.35 * t)
        rings.append([bm.verts.new(c + Vector((rr * math.cos(a), rr * math.sin(a), 0))) for a in (2 * math.pi * i / 6 for i in range(6))])
    for k in range(6):
        for i in range(6):
            bm.faces.new((rings[k][i], rings[k][(i + 1) % 6], rings[k + 1][(i + 1) % 6], rings[k + 1][i]))
    n_bark = len(bm.faces)
    top = Vector((lean, 0, h))
    for i in range(9):
        a = 2 * math.pi * i / 9 + 0.3
        d = Vector((math.cos(a), math.sin(a), 0))
        frond(bm, top, d, 4.6, 0.55, 1.25)
    bm.to_mesh(me)
    bm.free()
    for i, p in enumerate(me.polygons):
        p.material_index = 0 if i < n_bark else 1
    me.materials.append(bark)
    me.materials.append(leaf)
    return me


def fern_mesh(name, leaf, n=11, length=1.6):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rnd = random.Random(len(name))
    for i in range(n):
        a = 2 * math.pi * i / n + rnd.uniform(-0.2, 0.2)
        d = Vector((math.cos(a), math.sin(a), 0))
        frond(bm, Vector((0, 0, 0.05)), d, length * rnd.uniform(0.75, 1.1), length * 0.13, 0.9, 6)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(leaf)
    return me


def broadleaf_mesh(name, bark, leaf):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    trunk(bm, 5.0, 0.3)
    n_bark = len(bm.faces)
    rnd = random.Random(7)
    for c, r in (((0, 0, 6.2), 2.8), ((1.4, 0.5, 5.4), 2.0), ((-1.2, -0.6, 5.6), 2.1), ((0.2, 1.1, 7.2), 1.8)):
        res = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)
        for v in res["verts"]:
            v.co = v.co * Vector((1, 1, 0.8)) + Vector(c) + Vector([rnd.uniform(-0.25, 0.25) for _ in range(3)])
    bm.to_mesh(me)
    bm.free()
    for i, p in enumerate(me.polygons):
        p.material_index = 0 if i < n_bark else 1
    me.materials.append(bark)
    me.materials.append(leaf)
    return me


def instance(me, loc, rot_z, scale, name="plant"):
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    ob.rotation_euler = (random.uniform(-0.05, 0.05), random.uniform(-0.05, 0.05), rot_z)
    ob.scale = (scale, scale, scale)
    return link(ob)


def forest():
    bark = principled("bark", (0.16, 0.10, 0.06), 0.9)
    needles = principled("needles", (0.035, 0.11, 0.045), 0.8, vary=0.25)
    leaf = principled("leaf", (0.05, 0.12, 0.022), 0.6, spec=0.2, vary=0.3)
    canopy = principled("canopy", (0.11, 0.21, 0.04), 0.75, vary=0.3)
    kinds = [
        (conifer_mesh("conifer", bark, needles), 0.46, (0.8, 1.5)),
        (palm_mesh("palm", bark, leaf), 0.22, (0.8, 1.2)),
        (broadleaf_mesh("broadleaf", bark, canopy), 0.32, (0.9, 1.6)),
    ]
    ferns = [fern_mesh("fern_a", leaf), fern_mesh("fern_b", leaf, 9, 2.1)]
    rnd = random.Random(1983)
    random.seed(1983)

    def pick():
        r = rnd.random()
        for me, w, sc in kinds:
            if r < w:
                return me, sc
            r -= w
        return kinds[0][0], kinds[0][2]

    placed = 0
    # the valley: dense forest, thinning where the land climbs into the ridge
    for _ in range(12000):
        y = -120 + (rnd.random() ** 1.3) * 720
        x = rnd.uniform(-1.0, 1.0) * (abs(y) * 0.9 + 120)
        z = ground_h(x, y)
        if z > 30 or rnd.random() < smooth(0, 30, z):
            continue
        # clearings: the forest breaks into groves
        if fbm(x / 60, y / 60, 2, 9.9) < -0.25:
            continue
        if -12 < x < 48 and 10 < y < 50:
            continue  # nothing growing out of the cliff under the Queen
        me, (s0, s1) = pick()
        instance(me, (x, y, z), rnd.uniform(0, 6.28), rnd.uniform(s0, s1))
        placed += 1
    # the rock's own crown: ferns, kept off the Queen's feet
    for _ in range(220):
        x = rnd.uniform(-2, 38)
        y = rnd.uniform(18, 41)
        if (Vector((x, y)) - REX_AT.xy).length < 6.5:
            continue  # keep the Queen's feet clear
        hit = ray_down(x, y)
        if hit is None:
            continue
        if hit.z < -1.5:
            continue  # the ferns grow on the top, not down the cliff
        instance(ferns[rnd.randrange(2)], hit, rnd.uniform(0, 6.28), rnd.uniform(0.8, 1.6), "fern")
    return placed


RAY_TARGETS = []


def ray_down(x, y):
    dg = bpy.context.evaluated_depsgraph_get()
    hit, loc, _n, _i, ob, _m = bpy.context.scene.ray_cast(dg, Vector((x, y, 60.0)), Vector((0, 0, -1)))
    return loc if hit and ob.name in RAY_TARGETS else None


# ---------- the Queen ----------

def queen():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=TREX)
    new = [o for o in bpy.data.objects if o not in before]
    for o in list(new):
        if o.type == "MESH" and o.parent is None:
            bpy.data.objects.remove(o)  # a stray helper sphere in the Meshy export
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE" and o in new)
    body = next(o for o in bpy.data.objects if o.type == "MESH" and o.parent == arm)
    arm.rotation_mode = "XYZ"
    arm.rotation_euler = (0, 0, math.radians(REX_HEADING))
    arm.scale = (REX_SCALE,) * 3
    pose(arm)
    arm.location = REX_AT
    bpy.context.view_layer.update()
    ground(arm, body)
    return arm, body


def bend(arm, bone, x=0.0, y=0.0, z=0.0):
    pb = arm.pose.bones[bone]
    pb.rotation_mode = "XYZ"
    pb.rotation_euler = Euler((math.radians(x), math.radians(y), math.radians(z)))


def pose(arm):
    """A roar toward the valley: head up, jaw wide, the tail swinging the other way, one foot ahead."""
    for b, ang in (("Bone_043", -6), ("Bone_042", -5), ("Bone_041", -4), ("Bone_040", -4), ("Bone_039", -3)):
        bend(arm, b, x=ang)
    bend(arm, "Bone_038", x=-6)
    bend(arm, "Bone_071", x=JAW)
    for i, b in enumerate(("Bone_027", "Bone_026", "Bone_025", "Bone_024", "Bone_023", "Bone_022", "Bone_021", "Bone_020")):
        bend(arm, b, x=1.5 + i * 0.6, z=-3.0 - i * 0.8)
    # a stride: right leg ahead, left behind, knees and ankles following
    bend(arm, "Bone_013", x=-12)
    bend(arm, "Bone_012", x=6)
    bend(arm, "Bone_018", x=10)
    bend(arm, "Bone_017", x=-4)
    bend(arm, "Bone_016", x=-8)


JAW = 14.0


def ground(arm, body):
    """Lower the Queen until her lowest foot rests on the rock under it."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    me = ev.to_mesh()
    mw = ev.matrix_world
    pts = [mw @ v.co for v in me.vertices]
    ev.to_mesh_clear()
    low = sorted(pts, key=lambda p: p.z)[:40]
    gaps = []
    for p in low:
        hit = ray_down(p.x, p.y)
        if hit is not None:
            gaps.append(p.z - hit.z)
    if not gaps:
        raise SystemExit("no rock under the Queen's feet: move REX_AT onto the rock")
    arm.location.z -= min(gaps) + 0.04  # a touch into the moss, never above it
    bpy.context.view_layer.update()


# ---------- sky, light, air ----------

def sky(scene):
    """An art-directed dusk: warm horizon, violet band, deep teal zenith, the sun's glow on the left,
    and thin streaks of cloud lit orange on the sun's side. The sky is seen at full strength but
    lights the scene only dimly, so the sun stays the key light."""
    w = bpy.data.worlds.new("golden hour")
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    N = nt.nodes.new
    L = nt.links.new
    tc = N("ShaderNodeTexCoord")
    d = N("ShaderNodeVectorMath"); d.operation = "NORMALIZE"
    L(tc.outputs["Generated"], d.inputs[0])
    sep = N("ShaderNodeSeparateXYZ"); L(d.outputs[0], sep.inputs[0])
    grad = N("ShaderNodeValToRGB")
    cr = grad.color_ramp
    cr.elements[0].position = 0.0; cr.elements[0].color = (1.0, 0.5, 0.24, 1)
    cr.elements[1].position = 0.5; cr.elements[1].color = (0.03, 0.08, 0.14, 1)
    for pos, col in ((0.05, (0.95, 0.42, 0.3)), (0.13, (0.52, 0.3, 0.42)), (0.26, (0.14, 0.17, 0.3))):
        e = cr.elements.new(pos); e.color = (*col, 1)
    L(sep.outputs["Z"], grad.inputs["Fac"])
    # the sun's glow: a wide warm bloom and a tight hot core
    dot = N("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = SUN_DIR
    L(d.outputs[0], dot.inputs[0])
    clamp = N("ShaderNodeClamp"); L(dot.outputs["Value"], clamp.inputs["Value"])
    wide = N("ShaderNodeMath"); wide.operation = "POWER"; wide.inputs[1].default_value = 14.0
    core = N("ShaderNodeMath"); core.operation = "POWER"; core.inputs[1].default_value = 320.0
    L(clamp.outputs[0], wide.inputs[0]); L(clamp.outputs[0], core.inputs[0])
    glow = N("ShaderNodeMath"); glow.operation = "MULTIPLY_ADD"; glow.inputs[1].default_value = 8.0
    L(core.outputs[0], glow.inputs[0]); L(wide.outputs[0], glow.inputs[2])
    glow_amt = N("ShaderNodeMath"); glow_amt.operation = "MULTIPLY"; glow_amt.inputs[1].default_value = 1.1
    L(glow.outputs[0], glow_amt.inputs[0])
    add_glow = N("ShaderNodeMix"); add_glow.data_type = "RGBA"; add_glow.blend_type = "ADD"
    add_glow.inputs["B"].default_value = (1.0, 0.68, 0.38, 1)
    L(glow_amt.outputs[0], add_glow.inputs["Factor"]); L(grad.outputs["Color"], add_glow.inputs["A"])
    # cloud streaks: noise on the sky dome flattened toward the horizon, only low in the sky
    zoff = N("ShaderNodeMath"); zoff.operation = "ADD"; zoff.inputs[1].default_value = 0.12
    L(sep.outputs["Z"], zoff.inputs[0])
    px = N("ShaderNodeMath"); px.operation = "DIVIDE"; L(sep.outputs["X"], px.inputs[0]); L(zoff.outputs[0], px.inputs[1])
    py = N("ShaderNodeMath"); py.operation = "DIVIDE"; L(sep.outputs["Y"], py.inputs[0]); L(zoff.outputs[0], py.inputs[1])
    comb = N("ShaderNodeCombineXYZ"); L(px.outputs[0], comb.inputs["X"]); L(py.outputs[0], comb.inputs["Y"])
    stretch = N("ShaderNodeVectorMath"); stretch.operation = "MULTIPLY"; stretch.inputs[1].default_value = (0.35, 1.6, 1.0)
    L(comb.outputs[0], stretch.inputs[0])
    nz = N("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 1.6; nz.inputs["Detail"].default_value = 6
    nz.inputs["Roughness"].default_value = 0.62
    L(stretch.outputs[0], nz.inputs["Vector"])
    thr = N("ShaderNodeMapRange"); thr.inputs["From Min"].default_value = 0.53; thr.inputs["From Max"].default_value = 0.68
    L(nz.outputs["Fac"], thr.inputs["Value"])
    band = N("ShaderNodeMapRange"); band.inputs["From Min"].default_value = 0.03; band.inputs["From Max"].default_value = 0.1
    L(sep.outputs["Z"], band.inputs["Value"])
    fade = N("ShaderNodeMapRange"); fade.inputs["From Min"].default_value = 0.34; fade.inputs["From Max"].default_value = 0.16
    L(sep.outputs["Z"], fade.inputs["Value"])
    m1 = N("ShaderNodeMath"); m1.operation = "MULTIPLY"; L(thr.outputs["Result"], m1.inputs[0]); L(band.outputs["Result"], m1.inputs[1])
    m2a = N("ShaderNodeMath"); m2a.operation = "MULTIPLY"; L(m1.outputs[0], m2a.inputs[0]); L(fade.outputs["Result"], m2a.inputs[1])
    m2 = N("ShaderNodeMath"); m2.operation = "MULTIPLY"; L(m2a.outputs[0], m2.inputs[0])
    ccol = N("ShaderNodeMix"); ccol.data_type = "RGBA"
    ccol.inputs["A"].default_value = (0.3, 0.2, 0.3, 1)
    ccol.inputs["B"].default_value = (1.0, 0.56, 0.36, 1)
    lit = N("ShaderNodeMapRange"); lit.inputs["From Min"].default_value = -0.2; lit.inputs["From Max"].default_value = 0.9
    L(dot.outputs["Value"], lit.inputs["Value"]); L(lit.outputs["Result"], ccol.inputs["Factor"])
    L(lit.outputs["Result"], m2.inputs[1])  # unlit cloud would only be a grey smudge: keep the lit ones
    over = N("ShaderNodeMix"); over.data_type = "RGBA"
    L(m2.outputs[0], over.inputs["Factor"]); L(add_glow.outputs["Result"], over.inputs["A"]); L(ccol.outputs["Result"], over.inputs["B"])
    bg = N("ShaderNodeBackground")
    lp = N("ShaderNodeLightPath")
    st = N("ShaderNodeMapRange"); st.inputs["To Min"].default_value = 0.35; st.inputs["To Max"].default_value = 0.85
    L(lp.outputs["Is Camera Ray"], st.inputs["Value"]); L(st.outputs["Result"], bg.inputs["Strength"])
    L(over.outputs["Result"], bg.inputs["Color"])
    out = N("ShaderNodeOutputWorld"); L(bg.outputs[0], out.inputs["Surface"])
    scene.world = w


def lights():
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 2.6
    sun.color = (1.0, 0.64, 0.38)
    sun.angle = math.radians(1.0)
    so = link(bpy.data.objects.new("sun", sun))
    so.rotation_euler = (-SUN_DIR).to_track_quat("-Z", "Y").to_euler()
    # the sun is behind-left of the Queen and draws her rim; a soft fill from the camera side keeps
    # her colours readable instead of a black cut-out
    rim = bpy.data.lights.new("fill", "AREA")
    rim.energy = 2600
    rim.size = 16
    rim.color = (1.0, 0.8, 0.66)
    ro = link(bpy.data.objects.new("fill", rim))
    ro.location = REX_AT + Vector((-8, -22, 10))
    ro.rotation_euler = (REX_AT + Vector((0, 0, 3)) - ro.location).to_track_quat("-Z", "Y").to_euler()


def haze():
    """Homogeneous haze over the valley and the far land; the rock and the Queen stay out of it."""
    m = bpy.data.materials.new("haze")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    v = nt.nodes.new("ShaderNodeVolumePrincipled")
    v.inputs["Color"].default_value = (1.0, 0.8, 0.62, 1)
    v.inputs["Density"].default_value = 0.0007
    v.inputs["Anisotropy"].default_value = 0.6
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(v.outputs[0], out.inputs["Volume"])

    def build(bm):
        bmesh.ops.create_cube(bm, size=1.0)
        for vv in bm.verts:
            # from just past the rock to beyond the volcano
            vv.co = Vector((vv.co.x * 1800, 622 + vv.co.y * 1156, vv.co.z * 330 + 95))

    ob = mesh_object("haze", build, m)
    ob.visible_shadow = False
    # ground mist lying in the valley between the trees: it catches the sun and separates the layers
    mist = bpy.data.materials.new("mist")
    mist.use_nodes = True
    nt = mist.node_tree
    nt.nodes.clear()
    v = nt.nodes.new("ShaderNodeVolumePrincipled")
    v.inputs["Color"].default_value = (1.0, 0.84, 0.7, 1)
    v.inputs["Density"].default_value = 0.012
    v.inputs["Anisotropy"].default_value = 0.5
    # thickest at the valley floor, gone 20 m up
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], sep.inputs[0])
    fall = nt.nodes.new("ShaderNodeMapRange")
    fall.inputs["From Min"].default_value = -30
    fall.inputs["From Max"].default_value = -10
    fall.inputs["To Min"].default_value = 0.012
    fall.inputs["To Max"].default_value = 0.0
    nt.links.new(sep.outputs["Z"], fall.inputs["Value"])
    nt.links.new(fall.outputs["Result"], v.inputs["Density"])
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(v.outputs[0], out.inputs["Volume"])

    def low(bm):
        bmesh.ops.create_cube(bm, size=1.0)
        for vv in bm.verts:
            vv.co = Vector((vv.co.x * 1400, 330 + vv.co.y * 560, vv.co.z * 30 - 22))

    mo = mesh_object("mist", low, mist)
    mo.visible_shadow = False
    return ob


def pteranodons():
    for loc, rz, s in (((10, 190, 52), 160, 1.2), ((22, 214, 60), 175, 1.0), ((2, 232, 64), 150, 0.9)):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=PTERA)
        for o in bpy.data.objects:
            if o not in before and o.parent is None:
                o.rotation_mode = "QUATERNION"
                o.rotation_quaternion = Euler((0, 0, math.radians(rz))).to_quaternion() @ o.rotation_quaternion
                o.location = loc
                o.scale = (s, s, s)


# ---------- shots ----------

def scene_common():
    scene = reset()
    sky(scene)
    lights()
    t = terrain()
    r = rock()
    RAY_TARGETS[:] = [t.name, r.name]
    bpy.context.view_layer.update()
    forest()
    haze()
    pteranodons()
    arm, _body = queen()
    return scene, arm


def camera(scene, loc, look, lens, res, focus=None, fstop=0.0):
    cam = bpy.data.cameras.new("cam")
    cam.lens = lens
    cam.clip_end = 6000
    if fstop:
        cam.dof.use_dof = True
        cam.dof.focus_distance = focus
        cam.dof.aperture_fstop = fstop
    co = link(bpy.data.objects.new("cam", cam))
    co.location = loc
    co.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.camera = co
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = int(os.environ.get("PCT", 100))


def render(scene, path, samples):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.volume_bounces = 1
    # Standard keeps the sunset saturated; AgX would bleach it to pastel. Light levels are set for it.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def cover(path, samples):
    scene, _arm = scene_common()
    # off the tip of the rock, over the drop: the valley opens below on the left
    # in front of the rock, over the drop: the Queen in profile, the valley opening on the left
    loc = Vector((7.0, 9.0, 1.9))
    camera(scene, loc, (4.2, 30.0, 5.4), 28, (1600, 940), (REX_AT - loc).length, 5.6)
    render(scene, path, samples)


def icon(path, samples):
    scene, arm = scene_common()
    # frame the head wherever the pose left it: the skull bone, in world space
    head = arm.matrix_world @ arm.pose.bones["Bone_038"].head
    # from below the jaw, so the head stands against the evening sky rather than the dark forest
    loc = head + Vector((-4.6, -5.9, -2.3))
    camera(scene, loc, head + Vector((1.1, 0.8, -0.35)), 50, (1024, 1024), (head - loc).length, 4.0)
    render(scene, path, samples)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    shot, out = argv[0], os.path.abspath(argv[1])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    samples = int(argv[2]) if len(argv) > 2 else 128
    {"cover": cover, "icon": icon}[shot](out, samples)
