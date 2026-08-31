"""Build synthetic project fixtures used by the detection and selection tests.

Each fixture reproduces the marker files a real project of that kind carries,
which is all the detector reads. Regenerate with:

    python tests/make_fixtures.py
"""

from __future__ import annotations

import shutil
from pathlib import Path

FIXTURES = Path(__file__).resolve().parent / "fixtures"

TREES = {
    # ---------------------------------------------------------------- unreal
    "unreal-sample": {
        "MyGame.uproject": """{
  "FileVersion": 3,
  "EngineAssociation": "5.7",
  "Category": "",
  "Modules": [ { "Name": "MyGame", "Type": "Runtime", "LoadingPhase": "Default" } ],
  "Plugins": [ { "Name": "GameplayAbilities", "Enabled": true } ]
}
""",
        "Config/DefaultEngine.ini": "[/Script/Engine.RendererSettings]\nr.Lumen.HardwareRayTracing=1\n",
        "Source/MyGame/MyGame.Build.cs": (
            "using UnrealBuildTool;\n"
            "public class MyGame : ModuleRules {\n"
            "  public MyGame(ReadOnlyTargetRules Target) : base(Target) {\n"
            '    PublicDependencyModuleNames.AddRange(new string[] { "Core", "GameplayAbilities" });\n'
            "  }\n}\n"
        ),
        "Source/MyGame.Target.cs": "using UnrealBuildTool;\npublic class MyGameTarget : TargetRules { }\n",
        "Content/Maps/Main.uasset": "binary-placeholder",
    },
    # ----------------------------------------------------------------- unity
    "unity-sample": {
        "ProjectSettings/ProjectVersion.txt": (
            "m_EditorVersion: 6000.3.5f1\nm_EditorVersionWithRevision: 6000.3.5f1 (abcdef123456)\n"
        ),
        "Packages/manifest.json": """{
  "dependencies": {
    "com.unity.render-pipelines.universal": "17.3.0",
    "com.unity.inputsystem": "1.11.2",
    "com.unity.addressables": "2.3.16",
    "com.unity.netcode.gameobjects": "2.2.0"
  }
}
""",
        "Assets/Scenes/Main.unity": "%YAML 1.1\n--- !u!29 &1\nOcclusionCullingSettings:\n",
        "Assets/Scripts/Game.asmdef": '{ "name": "Game", "rootNamespace": "Game" }\n',
        "Assets/Scripts/PlayerController.cs": (
            "using UnityEngine;\npublic class PlayerController : MonoBehaviour { void Update() { } }\n"
        ),
        "Assets/Prefabs/Player.prefab": "%YAML 1.1\n--- !u!1 &1\nGameObject:\n",
        # A Unity package embeds its own package.json - the detector must not
        # read this as a web project.
        "Packages/com.studio.tools/package.json": '{ "name": "com.studio.tools", "version": "1.0.0" }\n',
    },
    # ----------------------------------------------------------------- godot
    "godot-sample": {
        "project.godot": """config_version=5

[application]
config/name="My Godot Game"
config/features=PackedStringArray("4.6", "Forward Plus")

[rendering]
renderer/rendering_method="forward_plus"
""",
        "scenes/main.tscn": '[gd_scene load_steps=2 format=3]\n[node name="Main" type="Node2D"]\n',
        "scripts/player.gd": (
            "extends CharacterBody2D\n\n"
            "const SPEED := 300.0\n\n"
            "func _physics_process(delta: float) -> void:\n"
            "\tmove_and_slide()\n"
        ),
        "export_presets.cfg": '[preset.0]\nname="Windows Desktop"\n',
        "resources/config.tres": '[gd_resource type="Resource" format=3]\n',
    },
    # ---------------------------------------------------------------- roblox
    "roblox-sample": {
        "default.project.json": """{
  "name": "MyRobloxGame",
  "tree": {
    "$className": "DataModel",
    "ServerScriptService": { "$path": "src/server" },
    "ReplicatedStorage": { "$path": "src/shared" },
    "StarterPlayer": { "StarterPlayerScripts": { "$path": "src/client" } }
  }
}
""",
        "rokit.toml": '[tools]\nrojo = "rojo-rbx/rojo@7.5.1"\nselene = "Kampfkarren/selene@0.28.0"\n',
        "wally.toml": '[package]\nname = "studio/mygame"\nversion = "0.1.0"\nrealm = "shared"\n',
        ".luaurc": '{ "languageMode": "strict" }\n',
        "selene.toml": 'std = "roblox"\n',
        "src/server/Shop.server.luau": (
            "--!strict\nlocal ReplicatedStorage = game:GetService(\"ReplicatedStorage\")\n"
        ),
        "src/shared/Types.luau": "--!strict\nexport type Item = { id: string, price: number }\n",
    },
    # ------------------------------------------------------ minecraft fabric
    "minecraft-fabric-sample": {
        "gradle.properties": (
            "org.gradle.jvmargs=-Xmx2G\n"
            "minecraft_version=1.21.4\n"
            "yarn_mappings=1.21.4+build.8\n"
            "loader_version=0.16.9\n"
            "fabric_version=0.114.0+1.21.4\n"
            "mod_version=1.0.0\n"
            "maven_group=com.example\n"
            "archives_base_name=examplemod\n"
            "mod_id=examplemod\n"
            "java_version=21\n"
        ),
        "build.gradle": "plugins {\n  id 'fabric-loom' version '1.9-SNAPSHOT'\n}\n",
        "src/main/resources/fabric.mod.json": """{
  "schemaVersion": 1,
  "id": "examplemod",
  "version": "1.0.0",
  "entrypoints": { "main": [ "com.example.ExampleMod" ] },
  "depends": { "minecraft": "~1.21.4", "fabricloader": ">=0.16.9", "java": ">=21" }
}
""",
        "src/main/java/com/example/ExampleMod.java": (
            "package com.example;\n"
            "import net.fabricmc.api.ModInitializer;\n"
            "public class ExampleMod implements ModInitializer {\n"
            "  @Override public void onInitialize() { }\n}\n"
        ),
    },
    # ---------------------------------------------------- minecraft neoforge
    "minecraft-neoforge-sample": {
        "gradle.properties": (
            "minecraft_version=1.21.1\n"
            "neoforge_version=21.1.72\n"
            "parchment_minecraft_version=1.21.1\n"
            "parchment_mappings_version=2024.11.17\n"
            "mod_id=examplemod\n"
            "mod_version=1.0.0\n"
            "java_version=21\n"
        ),
        "build.gradle": "plugins {\n  id 'net.neoforged.moddev' version '2.0.28'\n}\n",
        "src/main/resources/META-INF/neoforge.mods.toml": (
            'modLoader="javafml"\nloaderVersion="[1,)"\nlicense="MIT"\n\n'
            '[[mods]]\nmodId="examplemod"\nversion="1.0.0"\n'
        ),
        "src/main/java/com/example/ExampleMod.java": (
            "package com.example;\n"
            "import net.neoforged.fml.common.Mod;\n"
            '@Mod("examplemod")\npublic class ExampleMod { }\n'
        ),
    },
    # -------------------------------------------------------------- web/next
    "web-next-sample": {
        "package.json": """{
  "name": "my-app",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "scripts": { "dev": "next dev", "build": "next build", "test": "vitest" },
  "dependencies": { "next": "15.1.3", "react": "19.0.0", "react-dom": "19.0.0" },
  "devDependencies": { "typescript": "5.7.2", "vitest": "2.1.8" },
  "engines": { "node": ">=20.11.0" }
}
""",
        "next.config.ts": "import type { NextConfig } from 'next';\nexport default {} satisfies NextConfig;\n",
        "tsconfig.json": '{ "compilerOptions": { "strict": true, "target": "ES2022" } }\n',
        "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
        "app/page.tsx": "export default function Page() { return <main>hi</main>; }\n",
        "app/api/login/route.ts": "export async function POST() { return new Response('ok'); }\n",
    },
    # ------------------------------------------- ambiguity: unity + web tools
    "unity-with-web-tools": {
        "ProjectSettings/ProjectVersion.txt": "m_EditorVersion: 6000.3.5f1\n",
        "Assets/Scripts/Game.cs": "using UnityEngine;\npublic class Game : MonoBehaviour { }\n",
        "Assets/Scenes/Main.unity": "%YAML 1.1\n",
        # A build dashboard living in the same repository. A real second
        # ecosystem, which detection should report as secondary rather than hide.
        "Tools/dashboard/package.json": """{
  "name": "build-dashboard",
  "scripts": { "dev": "vite", "build": "vite build" },
  "dependencies": { "react": "18.3.1" },
  "devDependencies": { "vite": "6.0.5" }
}
""",
        "Tools/dashboard/vite.config.ts": "export default { root: '.' };\n",
        "Tools/dashboard/index.html": "<!doctype html><html></html>\n",
    },
    # ----------------------------------------------------- nothing to detect
    "empty-sample": {
        "notes.txt": "just some notes\n",
    },
}


def build(clean: bool = True) -> Path:
    if clean and FIXTURES.exists():
        shutil.rmtree(FIXTURES)
    for project, files in TREES.items():
        for rel, content in files.items():
            path = FIXTURES / project / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
    return FIXTURES


if __name__ == "__main__":
    target = build()
    print("fixtures written to %s" % target)
    for project in sorted(TREES):
        print("  - %s" % project)
