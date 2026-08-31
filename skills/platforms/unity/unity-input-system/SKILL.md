---
name: unity-input-system
description: Work with the Unity Input System package - action assets, action maps, bindings and composites, control schemes, device change handling, PlayerInput and local multiplayer, and migration away from the legacy Input Manager. Use when adding or rebinding controls, when input works on keyboard but not gamepad, when Input.GetAxis throws InvalidOperationException, when UI stops receiving clicks after installing the package, when input is missed or doubled in FixedUpdate, or when planning a move from the old Input Manager to the package.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: unity
  uad-domain: gamedev
  uad-version: "1.0.0"
  uad-requires: "gameplay-systems, software-architecture"
  uad-tags: "input system, inputactions, action map, binding, control scheme, playerinput, rebinding, legacy input migration"
  uad-maturity: stable
---

# Unity Input System

## Purpose

Unity ships two input stacks that cannot both be active by default, and the
project chooses which one at the Player Settings level. The legacy
`UnityEngine.Input` API polls axes named in `ProjectSettings/InputManager.asset`;
the Input System package (`com.unity.inputsystem`) is event-driven, device-aware
and asset-authored. Advice for one is broken for the other, and half a migration
is worse than either. This skill establishes which stack is live, then covers
authoring actions, handling devices, and migrating.

## When to use

- Adding a control, an action map, a gamepad binding, or a rebinding screen.
- `InvalidOperationException: You are trying to read Input using the
  UnityEngine.Input class, but you have switched active Input handling to Input
  System package in Player Settings.`
- Buttons or clicks stop working in the UI after the package is installed.
- Input is dropped or applied twice in `FixedUpdate`.
- Local multiplayer with several gamepads, or device hot-plug handling.
- Deciding whether to migrate an existing project off the Input Manager.

## When NOT to use

- The design of the gameplay that consumes input (buffering, combos, ability
  activation) - that is gameplay architecture, not the input stack.
- UI event routing, focus and navigation as a UI problem - `unity-ui-systems`.
- Character motion, ground checks and `Rigidbody` control - `unity-physics`.
- XR interaction toolkits, which layer their own interaction model on top of the
  Input System.

## Required context

| Fact | File / place | What to read |
|---|---|---|
| Which stack is active | `ProjectSettings/ProjectSettings.asset` | `activeInputHandler` - `0` legacy only, `1` Input System only, `2` both |
| Package version | `Packages/manifest.json` | `com.unity.inputsystem` - the API moved a lot across 1.x |
| Editor version | `ProjectSettings/ProjectVersion.txt` | `m_EditorVersion` - gates project-wide actions and Unity 6 template assets |
| Action assets | `**/*.inputactions` | maps, actions, composites, control schemes |
| Generated wrapper | the `.inputactions` inspector | "Generate C# Class" produces a partial class next to the asset |
| UI wiring | the scene's `EventSystem` | `InputSystemUIInputModule` (package) vs `StandaloneInputModule` (legacy) |
| Legacy call sites | grep the codebase | `Input.GetAxis`, `Input.GetKey`, `Input.mousePosition`, `Input.touches` |
| Update mode | Project Settings > Input System Package | Process Events In Dynamic Update / Fixed Update / Manual |

If `activeInputHandler` is `1` and any `UnityEngine.Input` call remains, that
call throws at runtime - it is a latent crash, not a warning.

## Version constraints

- Unity 6 (`6000.x.y`, `6000.3` is the current LTS) ships new project templates
  that already contain an `InputSystem_Actions.inputactions` asset and set
  `activeInputHandler` to the package. A Unity 6 project is far more likely to
  be package-based than a 2021/2022 LTS project.
- **Project-wide actions** (`InputSystem.actions`, assigned in Project Settings >
  Input System Package) arrived in Input System 1.8 with Unity 6. On earlier
  package versions the action asset must be referenced explicitly by a
  `PlayerInput` component or a serialized field. Check the package version in
  `manifest.json` before using `InputSystem.actions`.
- The universal `[Rpc]`-style consolidation does not apply here, but the action
  callback signature has been stable since 1.0 -
  `context.started` / `performed` / `canceled` with
  `InputAction.CallbackContext`.
- `InputAction.WasPressedThisFrame()`, `WasReleasedThisFrame()` and
  `IsPressed()` exist from 1.1 onwards. On older packages, use the callbacks or
  `triggered`.
- Legacy Input Manager still works in Unity 6 and is not removed; "legacy" here
  means unmaintained, not unavailable. Do not tell a team their working
  `Input.GetAxis` code is broken - it is only broken if `activeInputHandler`
  says so.
- If an API detail matters and you cannot confirm it for the installed version,
  read the package source under `Library/PackageCache/com.unity.inputsystem@*/`
  rather than guessing.

## Workflow

1. **Resolve the active handler first.** Read `activeInputHandler`. Everything
   after this branches on it. Value `2` (Both) is a transitional state and means
   both APIs work but two systems are polling devices.
2. **Locate or create the action asset.** One `.inputactions` asset per game is
   usually right, with maps named for context - `Player`, `UI`, `Vehicle`,
   `Menu`. Maps are the unit you enable and disable, so draw map boundaries
   along the lines of "what is the player controlling right now".
3. **Author actions by intent, not by device.** An action is `Move`, `Jump`,
   `Interact` - never `SpaceKey`. Set the action type deliberately: `Value`
   (continuous, has a control that owns it), `Button` (press semantics),
   `Pass Through` (every control reports independently, used for raw device
   forwarding).
4. **Add bindings and composites.** A WASD movement input is a `2D Vector`
   composite with four part bindings; a gamepad stick is a single binding to
   `<Gamepad>/leftStick`. Add processors on the binding (`Invert`,
   `Normalize`, `Scale`, `StickDeadzone`) rather than in gameplay code.
5. **Define control schemes** (`Keyboard&Mouse`, `Gamepad`, `Touch`) with
   required and optional devices. Schemes are what makes automatic device
   switching and per-player device assignment work; without them, every binding
   is live on every device at once.
6. **Choose the consumption style.**
   - Generated C# wrapper class - best for a single-player game with one input
     owner. Enable "Generate C# Class" on the asset, then
     `var input = new PlayerControls(); input.Player.Enable();
     input.Player.Jump.performed += OnJump;`
   - `PlayerInput` component - best for local multiplayer, paired with
     `PlayerInputManager` for join handling. Pick the Behavior explicitly:
     `Invoke C Sharp Events` is the only one that is refactor-safe;
     `Send Messages` and `Broadcast Messages` bind by method name string.
   - Direct `InputActionReference` fields - best for a single system that needs
     two or three actions without owning the whole asset.
7. **Enable and disable maps around game state.** Enable `UI` and disable
   `Player` when a menu opens. Enabling costs nothing per frame; leaving both
   enabled is how a pause menu ends up firing weapons.
8. **Subscribe and unsubscribe symmetrically.** Register callbacks in
   `OnEnable`, remove them in `OnDisable`, and call `Disable()` on the actions
   or dispose the generated wrapper in `OnDestroy`. Actions are assets or
   long-lived objects; a leaked callback outlives the scene.
9. **Handle device changes.** Subscribe to `InputSystem.onDeviceChange` for
   connect/disconnect, and to `PlayerInput.onControlsChanged` (or
   `InputUser.onChange`) to swap on-screen prompt glyphs when the player moves
   between keyboard and gamepad.
10. **Match the update mode to the consumer.** If gameplay reads input in
    `FixedUpdate`, either set Update Mode to `Process Events In Fixed Update`
    or - preferably - capture input in `Update` into a field and consume that
    field in `FixedUpdate`. Reading `WasPressedThisFrame` from `FixedUpdate`
    under Dynamic update mode misses presses on frames with no physics step and
    repeats them when two steps run in one frame.
11. **Migrating from legacy** - do it map by map, not call by call. Set
    `activeInputHandler` to `Both`, build the action asset, port one system at a
    time behind the new API, replace `StandaloneInputModule` with
    `InputSystemUIInputModule`, then flip to Input System only and fix every
    throw the run surfaces. The `Both` phase is where you keep the game
    playable; do not ship in it.

## Best practices

- **Keep the action asset the single source of truth.** Hard-coded
  `Keyboard.current[Key.Space]` checks scattered through gameplay defeat
  rebinding, control schemes and device switching all at once.
- **Read continuous values, poll or handle events for discrete ones.** Movement:
  `moveAction.ReadValue<Vector2>()` each frame. Jump: the `performed` callback
  or `WasPressedThisFrame()`. Mixing the two models per action is what produces
  "the jump sometimes does not register".
- **Use `Press` and `Hold` interactions instead of timing code.** A `Hold`
  interaction with a duration fires `performed` on completion and `canceled` on
  early release, and it is visible to designers in the asset.
- **Give every action a gamepad binding at the same time as the keyboard one.**
  Retro-fitting gamepad support after the fact means re-testing every screen,
  because navigation and focus are also affected.
- **Store rebindings as JSON overrides**, not as a rewritten asset:
  `action.ApplyBindingOverride(...)` plus
  `asset.SaveBindingOverridesAsJson()` / `LoadBindingOverridesFromJson()` into
  `PlayerPrefs` or the save file. Editing the asset at runtime does not persist
  in a build, and editing it in the editor mutates source content.
- **Guard interactive rebinding.** `InputActionRebindingExtensions.PerformInteractiveRebinding`
  must exclude the pointer and the cancel control (`WithControlsExcluding("<Mouse>/position")`,
  `WithCancelingThrough("<Keyboard>/escape")`) or the first mouse movement wins
  the rebind.
- **Prefer one `PlayerInput` per player over a global input singleton** in local
  multiplayer. Device pairing lives on `PlayerInput`/`InputUser`, and rolling
  your own pairing usually recreates it badly.
- **Keep the `UI` map bound to the same actions the `InputSystemUIInputModule`
  expects** (`Navigate`, `Submit`, `Cancel`, `Point`, `Click`,
  `ScrollWheel`, `MiddleClick`, `RightClick`, `TrackedDevicePosition`,
  `TrackedDeviceOrientation`). Missing `Point`/`Click` is the usual cause of a
  dead mouse cursor in menus.

## Common mistakes

- **Installing the package and leaving `activeInputHandler` on legacy.** The
  package appears to do nothing - no callbacks, no devices - because the
  backends are off. Set Active Input Handling in Player Settings; it requires an
  editor restart.
- **Flipping to Input System only with `StandaloneInputModule` still in the
  scene.** All UI input dies silently. Replace it with
  `InputSystemUIInputModule` (the inspector offers a one-click replace).
- **Leaving `Both` enabled permanently.** Two stacks poll the same devices, some
  events are handled twice, and it costs performance for no benefit. It is a
  migration state with an exit date.
- **Enabling the action asset but not the map.** `InputActionAsset.Enable()`,
  `InputActionMap.Enable()` and `InputAction.Enable()` are three different
  scopes. A callback that never fires is usually a map that was never enabled.
- **Subscribing in `Awake` and never unsubscribing.** Actions are shared and
  long-lived, so the delegate keeps the destroyed component alive and fires into
  it. Every Unity API call in that callback then throws
  `MissingReferenceException`.
- **Reading input in `FixedUpdate` under Dynamic update mode.** The symptom is
  intermittent - a jump that fails roughly once in five presses at high frame
  rates. Capture in `Update`, consume in `FixedUpdate`.
- **Using `Mouse.current.delta.ReadValue()` as a drop-in for
  `Input.GetAxis("Mouse X")`.** They have different units and no built-in
  sensitivity scaling, so ported camera code is wildly over- or under-sensitive.
  Re-tune the sensitivity; do not assume parity.
- **Assuming `Gamepad.current` is the player's gamepad.** `current` is the most
  recently used device, globally. In local multiplayer it points at whoever
  moved a stick last. Use the `PlayerInput`'s paired devices.
- **Hard-coding device paths for platform-specific controllers.** `<Gamepad>` is
  the abstraction; `<DualShock4GamepadHID>` binds to one product and breaks on
  every other pad. Bind to the abstract device, override only when the layout
  genuinely differs.
- **Not testing with the device unplugged.** `Gamepad.current` is null with no
  pad connected, and the resulting `NullReferenceException` ships because the
  developer always has a controller attached.

## Validation

1. **Handler state is explicit.** State the `activeInputHandler` value and the
   package version. Passing looks like "`1` (Input System only), package 1.8.2",
   not "the project uses the new input system".
2. **No legacy calls under the new backend.** With `activeInputHandler: 1`,
   grep for `UnityEngine.Input.` / `Input.Get` / `Input.mousePosition` /
   `Input.touch`. Passing is zero hits outside `#if ENABLE_LEGACY_INPUT_MANAGER`
   blocks. Each hit is a guaranteed runtime exception on the code path that
   reaches it.
3. **Live device and action inspection.** Window > Analysis > Input Debugger.
   Passing looks like the expected devices listed, and - with the game running
   and an action asset open - the actions turning green as you press controls.
   If a control lights up in the debugger but nothing happens in game, the
   problem is the callback wiring, not the binding.
4. **Every action has bindings for every supported scheme.** Open the
   `.inputactions` asset, switch the scheme dropdown between each control scheme
   and confirm no action shows an empty binding list. Passing is full coverage
   in every scheme the game claims to support.
5. **Device loss test.** Enter play mode with a gamepad, disconnect it mid-play,
   reconnect it. Passing is no exception in the Console, control returns to the
   keyboard scheme, and reconnecting restores the gamepad without a scene
   reload.
6. **UI reachability test.** With only a gamepad connected, navigate the entire
   menu flow and reach every interactive element. Passing is no dead end that
   requires a mouse.
7. **Fixed-step consistency.** Set `Time.timeScale` low or the fixed timestep
   high and confirm single presses are still applied exactly once. Passing is
   one action per press at every timestep.

## References

- [Input System package documentation](https://docs.unity3d.com/Packages/com.unity.inputsystem@latest)
- [Migrating from the old Input Manager](https://docs.unity3d.com/Packages/com.unity.inputsystem@latest/index.html?subfolder=/manual/Migration.html)
- [Actions, bindings and interactions](https://docs.unity3d.com/Packages/com.unity.inputsystem@latest/index.html?subfolder=/manual/Actions.html)
- [PlayerInput and local multiplayer](https://docs.unity3d.com/Packages/com.unity.inputsystem@latest/index.html?subfolder=/manual/PlayerInput.html)
- [Interactive rebinding](https://docs.unity3d.com/Packages/com.unity.inputsystem@latest/index.html?subfolder=/manual/ActionBindings.html)
- [Unity Manual - Input Manager (legacy)](https://docs.unity3d.com/Manual/class-InputManager.html)
