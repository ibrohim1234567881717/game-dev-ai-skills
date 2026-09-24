"""Shared helpers for building the UMBRA asset pack in Blender.

Conventions (match the design doc, file 8):
- 1 Blender unit = 1 metre, Z up, the asset stands on Z = 0 with its origin
  at the base.
- The front of every asset faces -Y in Blender. The glTF exporter turns that
  into +Z, which is the glTF "front" convention.
"""

from __future__ import annotations

import math
import random

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

RNG = random.Random(1983)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


# ---------------------------------------------------------------- materials
MATS: dict[str, bpy.types.Material] = {}


def mat(name: str, color: str = "#888888", rough: float = 0.8, metal: float = 0.0,
        emit: str | None = None, strength: float = 1.0, alpha: float | None = None,
        vcol: bool = False) -> bpy.types.Material:
    """Principled material. vcol=True drives base colour from the 'Col' attribute."""
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*hex_rgb(color), 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*hex_rgb(emit), 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    if alpha is not None:
        bsdf.inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except AttributeError:
            m.blend_method = "BLEND"
    if vcol:
        node = nt.nodes.new("ShaderNodeVertexColor")
        node.layer_name = "Col"
        nt.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
    m.diffuse_color = (*hex_rgb(color), 1.0)
    MATS[name] = m
    return m


def hex_rgb(h: str) -> tuple[float, float, float]:
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


# ---------------------------------------------------------------- objects
def _link(ob: bpy.types.Object) -> bpy.types.Object:
    bpy.context.scene.collection.objects.link(ob)
    return ob


def _finish(ob, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), material=None, smooth=False, parent=None):
    ob.location = loc
    ob.rotation_euler = Euler([math.radians(a) for a in rot])
    ob.scale = scale if isinstance(scale, (tuple, list)) else (scale, scale, scale)
    if material is not None:
        ob.data.materials.append(material)
    if smooth:
        for p in ob.data.polygons:
            p.use_smooth = True
    if parent is not None:
        parent.append(ob)
    return ob


def _bm_object(name: str, build) -> bpy.types.Object:
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    build(bm)
    bm.to_mesh(me)
    bm.free()
    return _link(bpy.data.objects.new(name, me))


def box(size=(1, 1, 1), loc=(0, 0, 0), rot=(0, 0, 0), m=None, parts=None, name="box", bevel=0.0):
    def b(bm):
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
        if bevel > 0:
            bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=bevel, segments=1, affect="EDGES")
    return _finish(_bm_object(name, b), loc, rot, 1, m, False, parts)


def cyl(r=0.5, h=1.0, loc=(0, 0, 0), rot=(0, 0, 0), m=None, parts=None, seg=12, r2=None, name="cyl", smooth=True):
    def b(bm):
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    ob = _finish(_bm_object(name, b), loc, rot, 1, m, smooth, parts)
    if smooth:  # keep the caps flat-looking by auto-smooth-like split: flat caps
        for p in ob.data.polygons:
            if abs(p.normal.z) > 0.99:
                p.use_smooth = False
    return ob


def cone(r=0.5, h=1.0, loc=(0, 0, 0), rot=(0, 0, 0), m=None, parts=None, seg=10, name="cone"):
    return cyl(r, h, loc, rot, m, parts, seg, r2=0.0, name=name)


def sphere(r=0.5, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), m=None, parts=None, seg=16, rings=10, name="sphere", smooth=True):
    def b(bm):
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    return _finish(_bm_object(name, b), loc, rot, scale, m, smooth, parts)


def ico(r=0.5, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), m=None, parts=None, sub=1, jitter=0.0, name="ico", smooth=False, seed=None):
    rnd = random.Random(seed if seed is not None else RNG.random())

    def b(bm):
        bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
        if jitter:
            for v in bm.verts:
                v.co *= 1 + rnd.uniform(-jitter, jitter)
    return _finish(_bm_object(name, b), loc, rot, scale, m, smooth, parts)


def torus(r=1.0, t=0.2, loc=(0, 0, 0), rot=(0, 0, 0), m=None, parts=None, seg=24, tseg=8, name="torus", arc=1.0):
    def b(bm):
        verts = []
        n = seg if arc >= 1 else seg + 1
        for i in range(n):
            a = 2 * math.pi * arc * i / seg
            ring = []
            for j in range(tseg):
                c = 2 * math.pi * j / tseg
                x = (r + t * math.cos(c)) * math.cos(a)
                y = (r + t * math.cos(c)) * math.sin(a)
                z = t * math.sin(c)
                ring.append(bm.verts.new((x, y, z)))
            verts.append(ring)
        for i in range(seg if arc >= 1 else seg):
            a, b2 = verts[i], verts[(i + 1) % len(verts)]
            for j in range(tseg):
                bm.faces.new((a[j], a[(j + 1) % tseg], b2[(j + 1) % tseg], b2[j]))
    return _finish(_bm_object(name, b), loc, rot, 1, m, True, parts)


def poly(points, loc=(0, 0, 0), rot=(0, 0, 0), m=None, parts=None, thickness=0.0, name="poly", smooth=False):
    """Flat polygon in the XZ plane from 2D points (x, z); optional thickness along Y."""
    def b(bm):
        vs = [bm.verts.new((x, 0, z)) for x, z in points]
        f = bm.faces.new(vs)
        if thickness:
            ext = bmesh.ops.extrude_face_region(bm, geom=[f])
            nv = [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]
            bmesh.ops.translate(bm, vec=(0, thickness, 0), verts=nv)
            bmesh.ops.translate(bm, vec=(0, -thickness / 2, 0), verts=bm.verts)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_bm_object(name, b), loc, rot, 1, m, smooth, parts)


def mesh_from(verts, faces, loc=(0, 0, 0), rot=(0, 0, 0), m=None, parts=None, name="mesh", smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    ob = _link(bpy.data.objects.new(name, me))
    return _finish(ob, loc, rot, 1, m, smooth, parts)


def tube(path, radii, loc=(0, 0, 0), m=None, parts=None, seg=8, name="tube", cap=True):
    """Tube along a list of 3D points with per-point radius."""
    def b(bm):
        rings = []
        for i, p in enumerate(path):
            p = Vector(p)
            nxt = Vector(path[min(i + 1, len(path) - 1)])
            prv = Vector(path[max(i - 1, 0)])
            d = (nxt - prv).normalized()
            up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
            s1 = d.cross(up).normalized()
            s2 = d.cross(s1).normalized()
            r = radii[i] if isinstance(radii, (list, tuple)) else radii
            rings.append([bm.verts.new(p + (s1 * math.cos(2 * math.pi * k / seg) + s2 * math.sin(2 * math.pi * k / seg)) * r) for k in range(seg)])
        for i in range(len(rings) - 1):
            a, c = rings[i], rings[i + 1]
            for k in range(seg):
                bm.faces.new((a[k], a[(k + 1) % seg], c[(k + 1) % seg], c[k]))
        if cap:
            bm.faces.new(list(reversed(rings[0])))
            bm.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_bm_object(name, b), loc, (0, 0, 0), 1, m, True, parts)


def skin(nodes, edges, m=None, parts=None, name="skin", levels=1, root=0, rscale=1.35):
    """Organic mesh from a node graph via the Skin + Subdivision modifiers.

    nodes: list of (x, y, z, radius) or (x, y, z, rx, ry).
    """
    me = bpy.data.meshes.new(name)
    me.from_pydata([n[:3] for n in nodes], edges, [])
    ob = _link(bpy.data.objects.new(name, me))
    sk = ob.modifiers.new("Skin", "SKIN")
    sk.use_smooth_shade = True
    sk.branch_smoothing = 0.6
    data = ob.data.skin_vertices[0].data
    for i, n in enumerate(nodes):
        data[i].radius = (n[3] * rscale, (n[4] if len(n) > 4 else n[3]) * rscale)
        data[i].use_root = i == root
    sub = ob.modifiers.new("Sub", "SUBSURF")
    sub.levels = levels
    sub.render_levels = levels
    apply_modifiers(ob)
    if m is not None:
        ob.data.materials.append(m)
    for p in ob.data.polygons:
        p.use_smooth = True
    if parts is not None:
        parts.append(ob)
    return ob


def loft(sections, m=None, parts=None, name="loft", seg=16, levels=1, cap=True, axis="Y"):
    """Superellipse loft. sections: (t, cx, cz, w, h, n[, rot_deg]) along Y (or X/Z via axis).

    n = 2 is an ellipse, n = 3–4 gets boxy. w/h are half-width and half-height.
    """
    def b(bm):
        rings = []
        for s in sections:
            t0, cx, cz, w, h = s[:5]
            n = s[5] if len(s) > 5 else 2.0
            rings.append([])
            for k in range(seg):
                a = 2 * math.pi * k / seg
                ca, sa = math.cos(a), math.sin(a)
                x = w * math.copysign(abs(ca) ** (2 / n), ca)
                z = h * math.copysign(abs(sa) ** (2 / n), sa)
                if axis == "Y":
                    co = (cx + x, t0, cz + z)
                elif axis == "X":
                    co = (t0, cx + x, cz + z)
                else:
                    co = (cx + x, cz + z, t0)
                rings[-1].append(bm.verts.new(co))
        for i in range(len(rings) - 1):
            a_, c_ = rings[i], rings[i + 1]
            for k in range(seg):
                bm.faces.new((a_[k], a_[(k + 1) % seg], c_[(k + 1) % seg], c_[k]))
        if cap:
            bm.faces.new(list(reversed(rings[0])))
            bm.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _bm_object(name, b)
    if levels:
        sub = ob.modifiers.new("Sub", "SUBSURF")
        sub.levels = levels
        apply_modifiers(ob)
    for p in ob.data.polygons:
        p.use_smooth = True
    if m is not None:
        ob.data.materials.append(m)
    if parts is not None:
        parts.append(ob)
    return ob


def apply_modifiers(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    new = bpy.data.meshes.new_from_object(ev)
    old = ob.data
    ob.modifiers.clear()
    ob.data = new
    bpy.data.meshes.remove(old)


def chain(points, start=0):
    """Edges connecting consecutive node indices start..start+len-1."""
    return [(start + i, start + i + 1) for i in range(len(points) - 1)]


def paint(ob, fn, name="Col"):
    """Vertex colours per corner: fn(co, normal) -> hex or (r, g, b) linear."""
    me = ob.data
    ca = me.color_attributes.get(name) or me.color_attributes.new(name, "BYTE_COLOR", "CORNER")
    me.color_attributes.active_color = ca
    cache = {}
    for poly_ in me.polygons:
        for li in poly_.loop_indices:
            vi = me.loops[li].vertex_index
            if vi not in cache:
                v = me.vertices[vi]
                c = fn(v.co, v.normal)
                cache[vi] = hex_rgb(c) if isinstance(c, str) else c
            ca.data[li].color = (*cache[vi], 1.0)
    return ob


def mix(a, b, t):
    ca, cb = (hex_rgb(a) if isinstance(a, str) else a), (hex_rgb(b) if isinstance(b, str) else b)
    t = max(0.0, min(1.0, t))
    return tuple(x + (y - x) * t for x, y in zip(ca, cb))


def noise3(x, y, z, s=1.0):
    from mathutils import noise
    return noise.noise(Vector((x * s, y * s, z * s)))


def mirror_x(nodes):
    return [(-n[0], *n[1:]) for n in nodes]


# ---------------------------------------------------------------- assets
class Asset:
    """Collects parts, joins them into one object at the origin."""

    def __init__(self, name: str, category: str, scale: float = 1.0):
        self.name = name
        self.category = category
        self.scale = scale  # uniform scale applied after joining (e.g. a character's height)
        self.parts: list[bpy.types.Object] = []

    def join(self) -> bpy.types.Object:
        objs = [o for o in self.parts if o.type == "MESH"]
        for o in bpy.context.scene.objects:
            o.select_set(False)
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active
        if self.scale != 1.0:
            ob.scale = [c * self.scale for c in ob.scale]
            ob.location = [c * self.scale for c in ob.location]
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        ob.name = self.name
        ob.data.name = self.name
        ob["category"] = self.category
        return ob


def ground_align(ob):
    """Move the object so its lowest point sits on Z = 0 (origin stays at 0,0,0)."""
    zs = [(ob.matrix_world @ v.co).z for v in ob.data.vertices]
    dz = -min(zs)
    for v in ob.data.vertices:
        v.co.z += dz
    return ob


# ---------------------------------------------------------------- textures
def uv_unwrap(ob, angle=66.0, margin=0.01):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=margin)
    bpy.ops.object.mode_set(mode="OBJECT")


def _skin_shader(nt, spec):
    """Procedural skin: countershading, dorsal stripes, blotches, scales.

    Returns (colour_socket, height_socket) for baking.
    """
    N, L = nt.nodes, nt.links
    tc = N.new("ShaderNodeTexCoord")
    geo = N.new("ShaderNodeNewGeometry")
    sep = N.new("ShaderNodeSeparateXYZ")
    L.new(geo.outputs["Normal"], sep.inputs[0])

    def rng(sock, a, b):
        r = N.new("ShaderNodeMapRange")
        r.inputs[1].default_value = a
        r.inputs[2].default_value = b
        L.new(sock, r.inputs[0])
        return r.outputs[0]

    def noise(scale, detail=3.0, stretch=None, rough=0.55):
        src = tc.outputs["Object"]
        if stretch:
            mp = N.new("ShaderNodeMapping")
            mp.inputs["Scale"].default_value = stretch
            L.new(src, mp.inputs[0])
            src = mp.outputs[0]
        nz = N.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = scale
        nz.inputs["Detail"].default_value = detail
        nz.inputs["Roughness"].default_value = rough
        L.new(src, nz.inputs[0])
        return nz.outputs["Fac"]

    def math_(op, a, b):
        m = N.new("ShaderNodeMath")
        m.operation = op
        for i, v in enumerate((a, b)):
            if isinstance(v, (int, float)):
                m.inputs[i].default_value = v
            else:
                L.new(v, m.inputs[i])
        return m.outputs[0]

    def rgb(h):
        c = N.new("ShaderNodeRGB")
        c.outputs[0].default_value = (*hex_rgb(h), 1)
        return c.outputs[0]

    def mixc(fac, a, b, blend="MIX"):
        m = N.new("ShaderNodeMix")
        m.data_type = "RGBA"
        m.blend_type = blend
        L.new(fac, m.inputs["Factor"]) if not isinstance(fac, (int, float)) else None
        if isinstance(fac, (int, float)):
            m.inputs["Factor"].default_value = fac
        L.new(a, m.inputs["A"])
        L.new(b, m.inputs["B"])
        return m.outputs["Result"]

    belly = rng(sep.outputs["Z"], -0.05, -0.7)
    back = rng(sep.outputs["Z"], 0.2, 0.85)
    blot = rng(noise(spec.get("blotch", 1.2), 4.0), 0.48, 0.66)
    st = spec.get("stripes", 2.2)
    stripes = rng(noise(1.0, 2.0, stretch=(0.35, st, 0.35)), 0.52, 0.6)
    stripe_back = math_("MULTIPLY", stripes, math_("MAXIMUM", back, 0.35))
    darkf = math_("MINIMUM", math_("MAXIMUM", math_("MULTIPLY", blot, 0.75), math_("MULTIPLY", stripe_back, spec.get("stripe_str", 0.8))), 1.0)
    col = mixc(darkf, rgb(spec["base"]), rgb(spec["dark"]))
    col = mixc(math_("MULTIPLY", back, spec.get("back_dark", 0.35)), col, rgb(spec["dark"]))
    col = mixc(belly, col, rgb(spec["belly"]))
    # fine tonal variation
    col = mixc(math_("MULTIPLY", noise(6.0, 2.0), 0.18), col, rgb(spec.get("tint", "#3a3024")), "MULTIPLY")
    vor = N.new("ShaderNodeTexVoronoi")
    vor.feature = "DISTANCE_TO_EDGE"
    vor.inputs["Scale"].default_value = spec.get("scales", 14.0)
    L.new(tc.outputs["Object"], vor.inputs[0])
    edge = rng(vor.outputs["Distance"], 0.0, 0.1)
    col = mixc(math_("MULTIPLY", math_("SUBTRACT", 1.0, edge), 0.28), col, rgb("#2a2620"), "MULTIPLY")
    height = math_("ADD", edge, math_("MULTIPLY", noise(spec.get("wrinkle", 5.0), 5.0), 0.4))
    return col, height


def bake_skin(ob, spec, size=1024, name=None, rough=0.75):
    """Bake a procedural skin (colour + normal from bump) into textures, then use them in a glTF-friendly material."""
    name = name or ob.name
    uv_unwrap(ob)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    scene.cycles.bake_type = "DIFFUSE"
    # temporary material
    tmp = bpy.data.materials.new(name + "_proc")
    tmp.use_nodes = True
    nt = tmp.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    col, height = _skin_shader(nt, spec)
    nt.links.new(col, bsdf.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = spec.get("bump", 0.55)
    bump.inputs["Distance"].default_value = 0.02
    nt.links.new(height, bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    keep = list(ob.data.materials)
    ob.data.materials.clear()
    ob.data.materials.append(tmp)
    img_c = bpy.data.images.new(name + "_color", size, size)
    img_n = bpy.data.images.new(name + "_normal", size, size, float_buffer=False)
    img_n.colorspace_settings.name = "Non-Color"
    node = nt.nodes.new("ShaderNodeTexImage")
    nt.nodes.active = node
    for o in scene.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    node.image = img_c
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, margin=4)
    node.image = img_n
    bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT", margin=4)
    img_c.pack()
    img_n.pack()
    # final material
    fm = bpy.data.materials.new(name + "_skin")
    fm.use_nodes = True
    fnt = fm.node_tree
    fb = fnt.nodes.get("Principled BSDF")
    fb.inputs["Roughness"].default_value = rough
    tcol = fnt.nodes.new("ShaderNodeTexImage"); tcol.image = img_c
    fnt.links.new(tcol.outputs["Color"], fb.inputs["Base Color"])
    tnor = fnt.nodes.new("ShaderNodeTexImage"); tnor.image = img_n
    nmap = fnt.nodes.new("ShaderNodeNormalMap")
    fnt.links.new(tnor.outputs["Color"], nmap.inputs["Color"])
    fnt.links.new(nmap.outputs["Normal"], fb.inputs["Normal"])
    ob.data.materials.clear()
    ob.data.materials.append(fm)
    for m in keep:
        if m is not None and m.name not in (tmp.name,):
            pass
    bpy.data.materials.remove(tmp)
    return fm


# ---------------------------------------------------------------- preview & export
def _look_at(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def setup_studio(sky="#c9d3d8", ground="#8a8f86", sun_energy=3.2):
    scene = bpy.context.scene
    world = bpy.data.worlds.new("studio")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (*hex_rgb(sky), 1)
    bg.inputs[1].default_value = 0.9
    scene.world = world
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = sun_energy
    sun.data.angle = math.radians(6)
    sun.rotation_euler = Euler((math.radians(50), math.radians(10), math.radians(-35)))
    scene.collection.objects.link(sun)
    fill = bpy.data.objects.new("fill", bpy.data.lights.new("fill", "SUN"))
    fill.data.energy = 0.8
    fill.rotation_euler = Euler((math.radians(70), 0, math.radians(150)))
    scene.collection.objects.link(fill)
    gm = mat("_ground", ground, rough=0.95)
    g = box((400, 400, 0.02), loc=(0, 0, -0.011), m=gm, name="_ground")
    return [sun, fill, g]


def render_preview(objects, path, res=(1280, 720), samples=24, view="three_quarter", margin=1.12):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in scene.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    bpy.context.view_layer.update()
    pts = []
    for ob in objects:
        mw = ob.matrix_world
        vs = ob.data.vertices
        step = max(1, len(vs) // 4000)
        pts.extend(mw @ vs[i].co for i in range(0, len(vs), step))
    mins = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    maxs = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    center = (mins + maxs) / 2
    size = maxs - mins
    cam = bpy.data.objects.get("_cam") or bpy.data.objects.new("_cam", bpy.data.cameras.new("_cam"))
    if cam.name not in scene.collection.objects:
        scene.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    dirs = {"three_quarter": Vector((1.0, -1.25, 0.7)), "front": Vector((0, -1, 0.15)), "side": Vector((1, 0, 0.12))}
    d = dirs[view].normalized()
    cam.location = center + d * (max(size) * 3 + 10)
    _look_at(cam, center)
    bpy.context.view_layer.update()
    # fit ortho scale to the projected bounding box
    inv = cam.matrix_world.inverted()
    xs, ys = [], []
    for q in pts:
        p = inv @ q
        xs.append(p.x); ys.append(p.y)
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    aspect = res[0] / res[1]
    cam.data.ortho_scale = max(w, h * aspect) * margin
    cam.data.clip_end = 5000
    scene.camera = cam
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def export_glb(ob, path):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    kw = dict(filepath=path, use_selection=True, export_format="GLB", export_yup=True, export_apply=True, export_image_format="JPEG")
    try:
        bpy.ops.export_scene.gltf(**kw, export_image_quality=88)
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)


def layout_row(objs, gap=2.0):
    """Place objects left to right along X, centred on 0."""
    widths = []
    for ob in objs:
        xs = [(ob.matrix_world @ Vector(c)).x for c in ob.bound_box]
        widths.append((min(xs) - ob.location.x, max(xs) - ob.location.x))
    total = sum(b - a for a, b in widths) + gap * (len(objs) - 1)
    x = -total / 2
    for ob, (a, b) in zip(objs, widths):
        ob.location.x = x - a
        x += (b - a) + gap


def label(text, loc, size=0.6, m=None):
    cu = bpy.data.curves.new("lbl", "FONT")
    cu.body = text
    cu.size = size
    cu.align_x = "CENTER"
    ob = bpy.data.objects.new("_lbl_" + text, cu)
    ob.location = loc
    ob.rotation_euler = Euler((math.radians(90), 0, 0))
    if m:
        cu.materials.append(m)
    bpy.context.scene.collection.objects.link(ob)
    return ob
