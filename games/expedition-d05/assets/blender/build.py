"""Build the UMBRA asset pack.

    python3 games/expedition-d05/assets/blender/build.py                 # everything
    python3 games/expedition-d05/assets/blender/build.py dinosaurs       # one category
    python3 games/expedition-d05/assets/blender/build.py dinosaurs trex  # one asset

Works with Blender as a Python module (`pip install bpy`, Python 3.11) or
inside Blender: `blender -b -P build.py -- dinosaurs`.
Writes models/<category>/<asset>.glb, blend/<category>.blend and
previews/<category>/<asset>.png next to this folder.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

import lib  # noqa: E402

OUT = os.path.dirname(HERE)

# group shots: a diagonal three-quarter row wastes most of the frame on small, tall assets
GROUP_VIEW = {"characters": "front", "equipment": "front"}
GROUP_GAP = {"characters": 0.5, "equipment": 0.3}


def categories():
    import dinos
    cats = {"dinosaurs": dinos.BUILDERS}
    for modname, cat in (("fauna", "fauna"), ("people", "characters"), ("gear", "equipment"), ("vehicles", "vehicles"),
                         ("base", "base"), ("environment", "environment"), ("props", "props"), ("vegetation", "vegetation"),
                         ("interactive", "interactive")):
        try:
            mod = __import__(modname)
            cats[cat] = mod.BUILDERS
        except ImportError:
            pass
    return cats


def build_category(cat, builders, only=None, previews=True):
    lib.reset_scene()
    built = []
    for name, fn in builders.items():
        if only and name not in only:
            continue
        asset = fn()
        ob = asset.join()
        lib.ground_align(ob)
        built.append(ob)
        os.makedirs(os.path.join(OUT, "models", cat), exist_ok=True)
        lib.export_glb(ob, os.path.join(OUT, "models", cat, name + ".glb"))
        print(f"[{cat}] {name}: {len(ob.data.polygons)} faces")
    if not built:
        return
    studio = lib.setup_studio()
    if previews:
        os.makedirs(os.path.join(OUT, "previews", cat), exist_ok=True)
        for ob in built:
            others = [o for o in built if o is not ob]
            for o in others:
                o.hide_render = True
            lib.render_preview([ob], os.path.join(OUT, "previews", cat, ob.name + ".png"), res=(960, 600), samples=20)
            for o in others:
                o.hide_render = False
        if len(built) > 1:
            lib.layout_row(built, gap=GROUP_GAP.get(cat, 2.5))
            lib.render_preview(built, os.path.join(OUT, "previews", cat + ".png"), res=(1600, 700), samples=20, margin=1.06,
                               view=GROUP_VIEW.get(cat, "three_quarter"))
    for o in studio:
        bpy.data.objects.remove(o, do_unlink=True)
    cam = bpy.data.objects.get("_cam")
    if cam:
        bpy.data.objects.remove(cam, do_unlink=True)
    if not only:
        os.makedirs(os.path.join(OUT, "blend"), exist_ok=True)
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "blend", cat + ".blend"), compress=True)


def main(argv):
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = argv[1:]
    cats = categories()
    want = argv[0] if argv else None
    only = set(argv[1:]) or None
    for cat, builders in cats.items():
        if want and cat != want:
            continue
        build_category(cat, builders, only)


if __name__ == "__main__":
    main(sys.argv)
