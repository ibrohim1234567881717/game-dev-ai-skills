"""Key art for store pages: the Queen on a ridge against the low sun, the island in layers of haze.

    python3 games/expedition-d05/assets/blender/keyart.py cover games/expedition-d05/assets/previews/keyart/cover.png 128
    python3 games/expedition-d05/assets/blender/keyart.py icon  games/expedition-d05/assets/previews/keyart/icon.png 128

then web/store/make_store_art.py letters and sizes them for the store. The renders are not
versioned (previews/*/ is ignored, like the per-asset previews); about half a minute each on a CPU.

Built from the asset pack's own models (models/*.glb), not from game screenshots: store fronts
such as Yandex Games refuse a screenshot as an icon or cover. The far island is flat silhouette
layers whose colour moves toward the horizon haze with distance, the look of the game's own fog.
Cycles on the CPU.
"""

import math
import os
import random
import sys

import bpy
from mathutils import Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(os.path.dirname(HERE), "models")

HORIZON = (1.0, 0.62, 0.30)
ZENITH = (0.035, 0.085, 0.115)
SILHOUETTE = (0.012, 0.02, 0.024)
HAZE = (0.62, 0.40, 0.34)  # what the farthest ridge fades into: warmer than the sky, a touch of rose
SUN_DIR = Vector((-0.12, 1.0, 0.075)).normalized()  # where the sun sits, seen from the camera side


def rgb_mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def emission(name, color, strength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1)
    e.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], out.inputs[0])
    return m


def rock(name, color=(0.03, 0.035, 0.035), rough=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Specular IOR Level"].default_value = 0.0  # no sheen on rock facing the sun
    return m


def world(scene):
    """Sky: haze at the horizon to a dark teal zenith, a hot glow around the sun."""
    w = bpy.data.worlds.new("dusk")
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (*HORIZON, 1)
    ramp.color_ramp.elements[1].position = 0.32
    ramp.color_ramp.elements[1].color = (*ZENITH, 1)
    mid = ramp.color_ramp.elements.new(0.07)
    mid.color = (0.55, 0.28, 0.22, 1)
    high = ramp.color_ramp.elements.new(0.17)
    high.color = (0.16, 0.16, 0.19, 1)
    nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = SUN_DIR
    nt.links.new(tc.outputs["Generated"], dot.inputs[0])
    powr = nt.nodes.new("ShaderNodeMath")
    powr.operation = "POWER"
    powr.inputs[1].default_value = 4000.0
    nt.links.new(dot.outputs["Value"], powr.inputs[0])
    glow_wide = nt.nodes.new("ShaderNodeMath")
    glow_wide.operation = "POWER"
    glow_wide.inputs[1].default_value = 140.0
    nt.links.new(dot.outputs["Value"], glow_wide.inputs[0])
    sun_amt = nt.nodes.new("ShaderNodeMath")
    sun_amt.operation = "MULTIPLY_ADD"
    sun_amt.inputs[1].default_value = 14.0
    nt.links.new(powr.outputs[0], sun_amt.inputs[0])
    nt.links.new(glow_wide.outputs[0], sun_amt.inputs[2])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "ADD"
    mix.inputs["B"].default_value = (1.0, 0.72, 0.42, 1)
    nt.links.new(sun_amt.outputs[0], mix.inputs["Factor"])
    nt.links.new(ramp.outputs["Color"], mix.inputs["A"])
    # seen at full brightness, but it lights the scene only dimly: silhouettes stay dark, the sun draws the rim
    bg = nt.nodes.new("ShaderNodeBackground")
    lp = nt.nodes.new("ShaderNodeLightPath")
    strength = nt.nodes.new("ShaderNodeMapRange")
    strength.inputs["To Min"].default_value = 0.18
    strength.inputs["To Max"].default_value = 1.0
    nt.links.new(lp.outputs["Is Camera Ray"], strength.inputs["Value"])
    nt.links.new(strength.outputs["Result"], bg.inputs["Strength"])
    nt.links.new(mix.outputs["Result"], bg.inputs["Color"])
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs[0], out.inputs["Surface"])
    scene.world = w


def mesh(name, verts, faces, mat):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob


def profile(y, x0, x1, base, height, rough, seed, trees=0, tree_h=(4, 9), extra=None):
    """A vertical silhouette at depth y: a noisy ridge line, pines on top, optional extra peaks."""
    rnd = random.Random(seed)
    n = 160
    phase = [rnd.uniform(0, 6.28) for _ in range(4)]
    pts = []
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        h = height * (0.55 + 0.25 * math.sin(x * 0.011 + phase[0]) + 0.14 * math.sin(x * 0.037 + phase[1])
                      + 0.06 * math.sin(x * 0.11 + phase[2])) + rough * rnd.uniform(-1, 1)
        for px, ph, pw in extra or ():
            h = max(h, ph * max(0.0, 1 - abs(x - px) / pw) ** 1.15)
        pts.append((x, base + h))
    verts, faces = [], []
    for x, z in pts:
        verts += [(x, y, base - 40), (x, y, z)]
    for i in range(n):
        a = i * 2
        faces.append((a, a + 2, a + 3, a + 1))
    # pines: stacked triangles standing on the ridge line
    for _ in range(trees):
        i = rnd.randrange(n)
        x, z = pts[i]
        th = rnd.uniform(*tree_h)
        tw = th * rnd.uniform(0.28, 0.4)
        for k in range(3):
            z0 = z + th * (0.15 + 0.28 * k)
            w = tw * (1 - 0.28 * k)
            s = len(verts)
            verts += [(x - w, y - 0.01, z0), (x + w, y - 0.01, z0), (x, y - 0.01, z0 + th * 0.45)]
            faces.append((s, s + 1, s + 2))
        s = len(verts)
        verts += [(x - tw * 0.08, y - 0.01, z - 1), (x + tw * 0.08, y - 0.01, z - 1), (x + tw * 0.08, y - 0.01, z + th * 0.3), (x - tw * 0.08, y - 0.01, z + th * 0.3)]
        faces.append((s, s + 1, s + 2, s + 3))
    return verts, faces


def ledge(name, y0, y1, x0, x1, base, height, rough, seed, mat, trees=0, tree_h=(4, 9), extra=None):
    """A solid ridge between depths y0 and y1: its front face and its top, so things can stand on it."""
    v, f = profile(y0, x0, x1, base, height, rough, seed, trees=trees, tree_h=tree_h, extra=extra)
    n = 161  # profile points: every point's front pair is (base, top) at indices 2i, 2i+1
    top = len(v)
    for i in range(n):
        x, _, z = v[2 * i + 1]
        v.append((x, y1, z))
    for i in range(n - 1):
        f.append((2 * i + 1, 2 * i + 3, top + i + 1, top + i))
    return mesh(name, v, f, mat)


def haze_layer(name, depth_t, *args, **kw):
    """depth_t: 0 = near and dark, 1 = at the horizon and almost sky-coloured."""
    col = rgb_mix(SILHOUETTE, HAZE, depth_t ** 2.2)
    v, f = profile(*args, **kw)
    return mesh(name, v, f, emission(name + "_m", col))


def lighthouse(y, x, z, depth_t):
    col = rgb_mix(SILHOUETTE, HAZE, depth_t ** 2.2)
    m = emission("lh_m", col)
    w0, w1, h = 2.6, 1.7, 24
    v = [(x - w0, y, z), (x + w0, y, z), (x + w1, y, z + h), (x - w1, y, z + h),
         (x - 2.3, y, z + h), (x + 2.3, y, z + h), (x + 2.3, y, z + h + 1.2), (x - 2.3, y, z + h + 1.2),
         (x - 1.5, y, z + h + 1.2), (x + 1.5, y, z + h + 1.2), (x + 1.5, y, z + h + 4.5), (x - 1.5, y, z + h + 4.5),
         (x - 2.0, y, z + h + 4.5), (x + 2.0, y, z + h + 4.5), (x, y, z + h + 7.0)]
    mesh("lighthouse", v, [(0, 1, 2, 3), (4, 5, 6, 7), (8, 9, 10, 11), (12, 13, 14)], m)
    # the lamp and a faint beam sweeping out over the sea
    lamp = emission("lamp", (1.0, 0.86, 0.6), 30.0)
    mesh("lamp", [(x - 1.2, y - 0.05, z + h + 1.6), (x + 1.2, y - 0.05, z + h + 1.6), (x + 1.2, y - 0.05, z + h + 4.1), (x - 1.2, y - 0.05, z + h + 4.1)], [(0, 1, 2, 3)], lamp)
    beam = bpy.data.materials.new("beam")
    beam.use_nodes = True
    nt = beam.node_tree
    nt.nodes.clear()
    e = nt.nodes.new("ShaderNodeEmission"); e.inputs["Color"].default_value = (1.0, 0.8, 0.55, 1); e.inputs["Strength"].default_value = 0.55
    t = nt.nodes.new("ShaderNodeBsdfTransparent")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["UV"], sep.inputs[0])
    fade = nt.nodes.new("ShaderNodeMath"); fade.operation = "SUBTRACT"; fade.inputs[0].default_value = 1.0
    nt.links.new(sep.outputs["X"], fade.inputs[1])
    mixs = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fade.outputs[0], mixs.inputs["Fac"])
    nt.links.new(t.outputs[0], mixs.inputs[1])
    nt.links.new(e.outputs[0], mixs.inputs[2])
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(mixs.outputs[0], out.inputs[0])
    cz = z + h + 2.85
    bm = mesh("beam", [(x, y - 0.1, cz - 0.5), (x - 110, y - 0.1, cz + 7), (x - 110, y - 0.1, cz - 3), (x, y - 0.1, cz + 0.5)], [(0, 1, 2, 3)], beam)
    uv = bm.data.uv_layers.new()
    for li, loop in enumerate(bm.data.loops):
        uv.data[li].uv = (0.0 if loop.vertex_index in (0, 3) else 1.0, 0.5)


def import_glb(rel, loc, rot_z, scale=1.0):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, rel))
    obs = [o for o in bpy.data.objects if o not in before]
    for o in obs:
        if o.parent is None:
            # the glTF importer keeps its axis fix-up in a quaternion: turn on top of it
            o.rotation_mode = "QUATERNION"
            o.rotation_quaternion = Quaternion((0, 0, 1), math.radians(rot_z)) @ o.rotation_quaternion
            o.location = loc
            o.scale = (scale, scale, scale)
    return obs


def silhouette_of(obs, color=SILHOUETTE):
    m = emission("sil", color)
    for o in obs:
        if o.type == "MESH":
            o.data.materials.clear()
            o.data.materials.append(m)


def lights():
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 12.0
    sun.color = (1.0, 0.72, 0.45)
    sun.angle = math.radians(1.2)
    so = bpy.data.objects.new("sun", sun)
    bpy.context.scene.collection.objects.link(so)
    # a sun lamp shines along its -Z: point it from the sun's direction back toward the camera
    so.rotation_euler = (-SUN_DIR).to_track_quat("-Z", "Y").to_euler()
    fill = bpy.data.lights.new("fill", "SUN")
    fill.energy = 0.35
    fill.color = (0.45, 0.62, 0.72)
    fo = bpy.data.objects.new("fill", fill)
    bpy.context.scene.collection.objects.link(fo)
    fo.rotation_euler = (math.radians(55), 0, math.radians(-30))


RIDGE_BUMPS = []  # (x, height above the ridge base, half-width): a rise under whatever stands on it
PTERA = []  # (location, heading, scale) of the pteranodons in the sky


def island(scene):
    """The ridge the Queen stands on, and the island behind it in five layers of haze."""
    world(scene)
    lights()
    # the near ridge is real geometry, lit from behind so its edge catches the sun
    ledge("ridge", 8, 30, -140, 140, -6, 5, 0.25, 11, rock("ridge", (0.018, 0.02, 0.02)), extra=RIDGE_BUMPS)
    # heights rise with distance so each layer shows above the one in front of it from a low camera
    haze_layer("l1", 0.2, 60, -260, 260, -8, 9, 0.8, 21, trees=70, tree_h=(2, 4.5))
    haze_layer("l2", 0.38, 140, -420, 420, -10, 20, 1.4, 22, trees=120, tree_h=(3, 6))
    # the volcano of chapter V behind the Queen: a broad cone with a notch for its crater
    haze_layer("l3", 0.56, 300, -800, 800, -10, 44, 2.0, 23, extra=[(105, 92, 150), (132, 89, 140)])
    # the far coast, and the lighthouse of the finale on a headland left of the sun
    haze_layer("l4", 0.74, 520, -1400, 1400, -16, 48, 2.5, 24, extra=[(-128, 64, 70)])
    lighthouse(519, -128, 47, 0.74)
    haze_layer("l5", 0.88, 900, -2600, 2600, -24, 58, 3.0, 25)
    # pteranodons riding the evening air
    for i, (loc, rz, s) in enumerate(PTERA):
        silhouette_of(import_glb("dinosaurs/pteranodon.glb", loc, rz, s), rgb_mix(SILHOUETTE, HAZE, 0.05 + 0.03 * i))


def camera(scene, loc, look, lens, res):
    cam = bpy.data.cameras.new("cam")
    cam.lens = lens
    cam.clip_end = 5000
    co = bpy.data.objects.new("cam", cam)
    scene.collection.objects.link(co)
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
    scene.cycles.max_bounces = 4
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def cover(path, samples):
    scene = reset()
    RIDGE_BUMPS[:] = [(14, 8, 30)]
    # the birds keep to the right: the title goes in the open sky on the left
    PTERA[:] = [((20, 92, 38), 200, 1.0), ((31, 106, 45), 215, 0.85), ((12, 118, 49), 190, 0.7)]
    island(scene)
    # the Queen on the ridge, in profile facing left, toward the sun; the model's head is at -Y
    import_glb("dinosaurs/tyrannosaurus_rex.glb", (14, 12, 2.0), -90, 1.0)
    # a low camera: the ridge crest becomes a silhouette line and the Queen towers over the frame
    camera(scene, (1, -30, 0.6), (6, 12, 8.4), 42, (1600, 940))
    render(scene, path, samples)


def icon(path, samples):
    scene = reset()
    RIDGE_BUMPS[:] = [(0, 8, 34)]
    PTERA[:] = [((6, 70, 26), 200, 1.0)]
    island(scene)
    # head toward the camera's left (model head at -Y turned by -53 deg), the sun behind it for a rim
    import_glb("dinosaurs/tyrannosaurus_rex.glb", (0, 12, 2.0), -53, 1.0)
    camera(scene, (-7.4, -2.2, 5.9), (-4.1, 8.8, 7.0), 64, (1024, 1024))
    render(scene, path, samples)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    shot, out = argv[0], os.path.abspath(argv[1])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    samples = int(argv[2]) if len(argv) > 2 else 96
    {"cover": cover, "icon": icon}[shot](out, samples)
