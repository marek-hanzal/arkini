# Effect 4 RC / Stable Migration Ledger

Tracking issue: [#397 — Migrate Arkini from Effect 4 prerelease to stable APIs](https://github.com/marek-hanzal/arkini/issues/397)

This is the canonical ledger for Arkini's Effect 4 migration. It records the current
prerelease package checkpoint, directly affected source areas, intentional workarounds,
and the behavior that the eventual stable-API cleanup must preserve.

## Current checkpoint

Arkini is pinned as one exact dependency set at `4.0.0-rc.111`:

- `effect`
- `@effect/atom-react`
- `@effect/platform-node`

The RC jump from `4.0.0-beta.101` was proven on 2026-08-20 on a clean Ubuntu GitHub
runner with Node `22.19.0` and npm `10.9.3`. It required no Arkini source changes.
The probe passed:

- `npm run typecheck:src`;
- `npm run typecheck:electron`;
- `npm run typecheck:test`;
- the then-current game validation command;
- 37 focused Atom/command lifecycle tests across renderer registry/lifecycle, Item Detail,
  appearance, cheats, and Cheat Spotlight.

The historical synchronous `Atom.fn(..., { concurrent: true })` settlement problem is
**not** considered fixed. Current RC Atom internals can still return a synchronous result
without first publishing `AsyncResult.Waiting`, so Arkini deliberately retains the
`Effect.yieldNow` command workaround where pending-state visibility is part of the
contract.

`effect/unstable/reactivity/*` and `effect/unstable/cli` also remain unstable surfaces.
Therefore #397 stays open: the RC dependency jump is complete, while the stable-API
migration and justified workaround removal are not.

## Next trigger

Treat future prerelease upgrades as one exact package set and keep them only when the
high-risk regression matrix stays green. Re-open the workaround review when either:

- Effect publishes a stable `4.0.0` package set; or
- upstream Atom settlement gains a documented pending-order guarantee that makes the
  synchronous-command workaround unnecessary.

Do not float one Effect package independently across an incompatible prerelease line.

## How to refresh the inventory

Run these searches before changing dependencies. The checked-in lists below are a
snapshot, while these commands are the source of truth if the repository has moved:

```sh
rg -l 'effect/unstable/reactivity' src electron cli test | sort
rg -l 'effect/unstable/cli' src electron cli test | sort
rg -l '@effect/atom-react' src electron cli test | sort
rg -l '@effect/platform-node' src electron cli test | sort
rg -n 'TODO\(#397\)' src electron cli test
rg -n 'Effect\.yieldNow|Atom\.(writable|keepAlive|setIdleTTL)|mode: "promise"|cause\.reasons' src electron cli test
```

Direct imports from Effect packages are intentional. Do not introduce a local `Atom.ts`
or another facade just to hide unstable import paths; stable migration should update the
external imports directly.

`@effect/platform-node` is imported through the exact `NodeServices` / `NodeRuntime`
subpaths rather than the package root. The root barrel re-exports `NodeRedis`, which makes
its Redis peer load eagerly even though Arkini does not use Redis.

## Prerelease-specific boundaries

| Boundary | Current `rc.111` state | Stable target |
| --- | --- | --- |
| Package set | The three Effect packages are exactly pinned together at `4.0.0-rc.111`; the networked migration probe resolved and validated that set. | Move the same set to mutually compatible stable versions, record the resolved versions, and inspect release/migration notes for every crossed RC. |
| Renderer Atom root | `RendererAtomRegistry` owns one process-lifetime registry, `scheduleTask`, a `400ms` default idle TTL, a registry Layer, and a zero-service Atom runtime. | Use the supported stable registry/runtime construction APIs while preserving one renderer authority. Re-evaluate the TTL from measured lifecycle behavior instead of blindly carrying `400`. |
| Concurrent command settlement | Concurrent write atoms still yield once before running work because `rc.111` can settle a synchronous command before subscribers observe the pending state. | Remove `Effect.yieldNow` only if Atom settlement has a documented ordering guarantee and all pending/error/remount regressions pass without it. |
| Command authorities | Cross-component commands use registry-owned `Atom.writable` authorities so pending and settlement survive React remounts and reject overlapping commands deterministically. | Prefer the final stable command abstraction if one exists; otherwise retain writable authorities and their single-command admission contract. Never move the truth back into component-local React state. |
| React promise mode | Arkpack import/remove use `useAtomSet(..., { mode: "promise" })` behind one exclusive owner. Lifecycle-sensitive application commands deliberately consume registry state instead of awaiting `promiseExit`. | Re-check stable promise/error/interruption semantics. Keep promise mode only where the caller truly owns the full async lifetime; do not let unmount turn a process command into an orphaned local promise. |
| Atom lifetime | Process authorities use `Atom.keepAlive`; short-lived command atoms use `Atom.setIdleTTL(0)`; registry defaults to `400ms`. | Verify stable retention, disposal, subscription, and remount semantics. Preserve process-owned authorities and prompt disposal of ephemeral command atoms without leaking fibers. |
| Cause projection | `readExactCauseFailure` and `readSettledAsyncResultError` inspect `cause.reasons` and accept exactly one `Fail` reason. Defects, interruption, and composite causes remain lifecycle failures. | Replace internal-looking Cause traversal with the final supported stable projection API if available. Preserve exact typed-failure-only behavior; never flatten defects or interruption into UI/domain errors. |
| Game session runtime | A `ManagedRuntime`, owner `Scope`, forked session/command scopes, `FiberSet` command runtime, AbortSignal propagation, and exactly-once disposal jointly own Tick, save, subscriptions, and commands. | Translate to stable lifecycle APIs without weakening ownership. Bootstrap failure/interruption, overlapping disposal, frozen retry behavior, command admission, save ordering, and exactly-once cleanup are compatibility gates. |
| Renderer and Electron roots | Renderer and Electron each own one process-lifetime `ManagedRuntime`; Electron supplies `NodeServices.layer`. | Use stable runtime/platform APIs and retain explicit process roots. Do not create per-callback runtimes or duplicate service authorities. |
| CLI | All command declarations import `effect/unstable/cli`; `src/engine/cli/arkini.ts` owns the product runtime edge and `cli/arkini-repository.ts` owns the private desktop-delivery edge. | Move both roots to the supported stable CLI entrypoint in one pass. Preserve command names, options, help text, exit codes, typed failures, and packaging scripts. |
| Atom/React types | Feature atoms depend directly on unstable `Atom`, `AtomRegistry`, `AsyncResult`, and `AtomRuntime` types plus `@effect/atom-react` hooks. | Adopt final stable names and generics directly. Do not paper over type drift with casts or a repository-local compatibility facade. |

HMR state preservation is explicitly out of scope. Arkini may restart renderer state during
development; the migration must not add HMR handoff, global caches, or module-dispose state
transfer.

## Semantic review markers

`TODO(#397)` marks code where beta behavior influenced architecture or ordering. These
comments are migration review points, not instructions to mechanically delete code.

The import inventories below cover the remaining mechanical API surface. A file does not
need a duplicate TODO merely because it imports an unstable module.

### Scheduling and command settlement

The following sources currently call `Effect.yieldNow` before or within a concurrent Atom
command:

- `src/bridge/appearance/setAppearanceThemeAtom.ts`
- `src/bridge/arkpack/importArkpackFileAtom.ts`
- `src/bridge/arkpack/removeArkpackAtom.ts`
- `src/bridge/cheat/spawnCheatItemAtom.ts`
- `src/bridge/inventory/runInventoryReleaseAtom.ts`
- `src/bridge/item-detail/createItemDetailCommandAtom.ts`
- `src/bridge/tile/runTileDropAtom.ts`
- `src/bridge/tile/runTileSplitAtom.ts`
- `src/bridge/window/setWindowModeAtom.ts`
- `src/ui/audio/useGameAudioAtoms.ts`
- `src/ui/cheat-spotlight/CheatItemSpawnCommandAtom.ts`
- `src/ui/cheats/updateGameCheatsAtom.ts`
- `src/ui/settings/SettingsCommandAtom.ts`

Other commands whose contract depends on `concurrent: true` without a synthetic yield:

- `src/bridge/cheat/setCheatAvailabilityAtom.ts`
- `src/ui/launcher/retryLauncherStartupAtom.ts`

Registry-owned command authorities using `Atom.writable`:

- `src/bridge/item-detail/createItemDetailCommandAtom.ts`
- `src/bridge/tile/TileDefaultLineCommandAtom.ts`
- `src/ui/cheat-spotlight/CheatItemSpawnCommandAtom.ts`
- `src/ui/cheats/updateGameCheatsAtom.ts`
- `src/ui/launcher/MainMenuExitCommandAtom.ts`
- `src/ui/settings/SettingsCommandAtom.ts`

### Atom lifetime

Process-owned or long-lived atoms using `Atom.keepAlive`:

- `src/bridge/appearance/AppearanceAtom.ts`
- `src/bridge/arkpack/ArkpackCatalogAtom.ts`
- `src/bridge/arkpack/ArkpackCatalogOwnerAtom.ts`
- `src/bridge/cheat/CheatAvailabilityAtom.ts`
- `src/ui/launcher/LauncherAppearanceReadyAtom.ts`
- `src/ui/launcher/LauncherCheatAvailabilityReadyAtom.ts`
- `src/ui/launcher/LauncherHeroAtom.ts`
- `src/ui/launcher/LauncherSplashCompletedAtom.ts`
- `src/ui/launcher/LauncherStartupAtom.ts`
- `src/ui/launcher/LauncherStartupConfigAtom.ts`
- `src/ui/launcher/MainMenuExitCommandAtom.ts`
- `src/ui/settings/SettingsCommandAtom.ts`

Ephemeral commands using `Atom.setIdleTTL(0)`:

- `src/bridge/appearance/setAppearanceThemeAtom.ts`
- `src/bridge/cheat/setCheatAvailabilityAtom.ts`
- `src/bridge/cheat/setCheatEnabledAtom.ts`
- `src/bridge/cheat/setInstantGameplayAtom.ts`
- `src/bridge/cheat/spawnCheatItemAtom.ts`
- `src/bridge/inventory/runInventoryReleaseAtom.ts`
- `src/bridge/item-detail/createItemDetailCommandAtom.ts`
- `src/bridge/lifecycle/requestApplicationCloseAtom.ts`
- `src/bridge/tile/TileDefaultLineCommandAtom.ts`
- `src/bridge/tile/runTileDropAtom.ts`
- `src/ui/audio/useGameAudioAtoms.ts`
- `src/ui/cheat-spotlight/CheatItemSpawnCommandAtom.ts`
- `src/ui/cheats/updateGameCheatsAtom.ts`
- `src/ui/game-menu/gameMenuCommandAtom.ts`
- `src/ui/item-detail/createItemDetailController.ts`

## Complete unstable reactivity inventory

Snapshot at `4.0.0-rc.111`: 133 files total — 88 production sources and 45 tests/support files.

### Production

```text
src/@routes/index.tsx
src/bridge/appearance/AppearanceAtom.ts
src/bridge/appearance/setAppearanceThemeAtom.ts
src/bridge/arkpack/ArkpackCatalogAtom.ts
src/bridge/arkpack/ArkpackCatalogOwnerAtom.ts
src/bridge/arkpack/configureArkpackCatalogFx.ts
src/bridge/arkpack/editor/buildEditorProjectCommandAtom.ts
src/bridge/arkpack/editor/importEditorArkpackFileAtom.ts
src/bridge/arkpack/editor/installBuiltEditorArkpackCommandAtom.ts
src/bridge/arkpack/editor/saveBuiltEditorArkpackCommandAtom.ts
src/bridge/arkpack/importArkpackFileAtom.ts
src/bridge/arkpack/removeArkpackAtom.ts
src/bridge/arkpack/useAboutPortraitAssets.ts
src/bridge/cheat/CheatAvailabilityAtom.ts
src/bridge/cheat/applyCheatAvailabilityFx.ts
src/bridge/cheat/readCheatAvailabilitySnapshotFx.ts
src/bridge/cheat/setCheatAvailabilityAtom.ts
src/bridge/cheat/setCheatEnabledAtom.ts
src/bridge/cheat/setInstantGameplayAtom.ts
src/bridge/cheat/spawnCheatItemAtom.ts
src/bridge/editor/EditorProjectAtom.ts
src/bridge/editor/EditorServiceStatusAtom.ts
src/bridge/editor/EditorUnsavedChanges.ts
src/bridge/editor/createFreshEditorProjectAtom.ts
src/bridge/editor/refreshEditorServiceStatusFx.ts
src/bridge/editor/waitForEditorProjectWritesCommandAtom.ts
src/bridge/game/GameSession.ts
src/bridge/game/createGameSessionFx.ts
src/bridge/game/makeExactGameAtomFamilyFx.ts
src/bridge/inventory/runInventoryReleaseAtom.ts
src/bridge/item-detail/createItemDetailCommandAtom.ts
src/bridge/item/editor/saveEditorItemCommandAtom.ts
src/bridge/item/editor/saveEditorItemFx.ts
src/bridge/lifecycle/RendererLifecycleOwnerAtom.ts
src/bridge/lifecycle/configureRendererLifecycleFx.ts
src/bridge/lifecycle/readRendererLifecycleFx.ts
src/bridge/lifecycle/requestApplicationCloseAtom.ts
src/bridge/project/editor/saveEditorProjectConfigCommandAtom.ts
src/bridge/project/editor/saveEditorProjectConfigFx.ts
src/bridge/reactivity/RendererAtomRegistry.ts
src/bridge/resource/editor/editEditorAssetCommandAtom.ts
src/bridge/resource/editor/editEditorAssetFx.ts
src/bridge/resource/editor/saveEditorAssetsCommandAtom.ts
src/bridge/resource/editor/saveEditorAssetsFx.ts
src/bridge/runtime/GameRuntimeAtom.ts
src/bridge/runtime/RendererRuntime.ts
src/bridge/runtime/useRuntimeSelector.ts
src/bridge/tile/TileDefaultLineCommandAtom.ts
src/bridge/tile/runTileDropAtom.ts
src/bridge/tile/runTileSplitAtom.ts
src/bridge/window/WindowModeAtom.ts
src/bridge/window/WindowModeReadyAtom.ts
src/bridge/window/applyWindowModeFx.ts
src/bridge/window/setWindowModeAtom.ts
src/installRendererControlledCloseFx.ts
src/ui/arkpack/editor/EditorBuild.tsx
src/ui/audio/useGameAudioAtoms.ts
src/ui/cheat-spotlight/CheatItemSpawnCommandAtom.ts
src/ui/cheats/updateGameCheatsAtom.ts
src/ui/editor/EditorWelcomeCommandAtom.ts
src/ui/game-menu/gameMenuCommandAtom.ts
src/ui/game-menu/useGameMenuActions.ts
src/ui/item-detail/ItemDetailControl.ts
src/ui/item-detail/createItemDetailController.ts
src/ui/item/editor/EditorItemEstimateCacheAtom.ts
src/ui/item/editor/useEditorItemOriginFlow.ts
src/ui/launcher/LauncherAppearanceReadyAtom.ts
src/ui/launcher/LauncherCheatAvailabilityReadyAtom.ts
src/ui/launcher/LauncherHeroAtom.ts
src/ui/launcher/LauncherHeroReadyAtom.ts
src/ui/launcher/LauncherHeroUrlAtom.ts
src/ui/launcher/LauncherSplashCompletedAtom.ts
src/ui/launcher/LauncherStartupAtom.ts
src/ui/launcher/LauncherStartupConfigAtom.ts
src/ui/launcher/LauncherVisualReadyAtom.ts
src/ui/launcher/MainMenu.tsx
src/ui/launcher/MainMenuExitCommandAtom.ts
src/ui/launcher/applyLauncherAppearanceHydrationFx.ts
src/ui/launcher/applyLauncherCheatAvailabilityHydrationFx.ts
src/ui/launcher/applyLauncherWindowModeHydrationFx.ts
src/ui/launcher/completeLauncherSplashAtom.ts
src/ui/launcher/configureLauncherStartupFx.ts
src/ui/launcher/retryLauncherStartupAtom.ts
src/ui/reactivity/readSettledAsyncResultError.ts
src/ui/resource/editor/EditorAssetManager.tsx
src/ui/settings/SettingsCommandAtom.ts
src/ui/settings/SettingsMcpCommandAtom.ts
src/ui/settings/createSettingsDirectoryCommandAtomFx.ts
```

### Tests and support

```text
test/bridge/arkpack/AboutPortraitAssetsAtom.test.ts
test/bridge/arkpack/ArkpackCatalogAtom.test.ts
test/bridge/cheat/CheatCommandAtoms.test.ts
test/bridge/editor/EditorProjectAtom.test.ts
test/bridge/editor/refreshEditorServiceStatusFx.test.ts
test/bridge/game/createGameSession.test.ts
test/bridge/inventory/runInventoryReleaseAtom.test.ts
test/bridge/item/editor/saveEditorItemFx.test.ts
test/bridge/project/editor/saveEditorProjectConfigFx.test.ts
test/bridge/reactivity/CheatAvailabilityAtom.test.ts
test/bridge/reactivity/RendererAtomLifecycle.test.ts
test/bridge/reactivity/RendererAtomRegistry.test.ts
test/bridge/resource/editor/editEditorAssetFx.test.ts
test/bridge/resource/editor/saveEditorAssetsFx.test.ts
test/bridge/runtime/useRuntimeSelector.test.ts
test/bridge/tile/TileDefaultLineCommandAtom.test.ts
test/bridge/tile/runTileDropAtom.test.ts
test/support/createTestRendererRuntime.ts
test/support/game/makeTestGameTransitionFieldsFx.ts
test/ui/appearance/AppearanceAtom.test.ts
test/ui/appearance/AppearanceThemeMutation.test.ts
test/ui/arkpack/ArkpackSelector.test.ts
test/ui/audio/GameAudio.test.ts
test/ui/cheat-spotlight/CheatItemSpawnProvider.test.ts
test/ui/cheat-spotlight/CheatItemSpotlight.test.ts
test/ui/cheats/Cheats.test.ts
test/ui/editor/EditorAssetManager.test.tsx
test/ui/editor/EditorBuild.test.ts
test/ui/editor/EditorItemEstimateCacheAtom.test.ts
test/ui/editor/EditorProjectProvider.test.ts
test/ui/editor/EditorShell.test.ts
test/ui/editor/EditorWelcomeCommandAtom.test.ts
test/ui/editor/useEditorItemOriginFlow.test.tsx
test/ui/game-menu/GameMenuMutations.test.ts
test/ui/item-detail/ItemDetailCommandAtoms.test.ts
test/ui/launcher/LauncherCatalogIntegration.test.ts
test/ui/launcher/LauncherHeroAtom.test.ts
test/ui/launcher/LauncherStartupAtom.test.ts
test/ui/launcher/LauncherStartupHydrator.test.ts
test/ui/launcher/MainMenu.test.ts
test/ui/launcher/Settings.test.ts
test/ui/launcher/SettingsCommands.test.ts
test/ui/launcher/StartupSplash.test.ts
test/ui/launcher/support/renderStartupSplashFx.ts
test/ui/reactivity/readSettledAsyncResultError.test.ts
```

## Complete unstable CLI inventory

Snapshot at `4.0.0-rc.111`: 18 production files.

```text
cli/ArkiniRepositoryCommand.ts
cli/arkini-repository.ts
cli/desktop/DesktopBuildCommand.ts
cli/desktop/DesktopCommand.ts
cli/desktop/DesktopPackageCommand.ts
cli/desktop/DesktopPreviewMacosCommand.ts
cli/desktop/DesktopVerifyCommand.ts
src/engine/cli/ArkiniCommand.ts
src/engine/cli/GameCommand.ts
src/engine/cli/arkini.ts
src/engine/pack/cli/ArkpackCommand.ts
src/engine/pack/cli/ArkpackKeygenCommand.ts
src/engine/pack/cli/ArkpackOfficialPackCommand.ts
src/engine/pack/cli/ArkpackSignCommand.ts
src/engine/pack/cli/ArkpackVerifyCommand.ts
src/engine/pack/cli/PackCommand.ts
src/engine/schema/cli/SchemaCommand.ts
src/engine/validation/cli/ValidateCommand.ts
```

## Complete atom-react inventory

Snapshot at `4.0.0-rc.111`: 80 files total — 35 production sources and 45 tests/support files.

### Production

```text
src/bridge/arkpack/useAboutPortraitAssets.ts
src/bridge/arkpack/useArkpacks.ts
src/bridge/editor/EditorProjectProvider.tsx
src/bridge/reactivity/RendererAtomRegistry.ts
src/bridge/runtime/useRuntimeSelector.ts
src/main.tsx
src/ui/appearance/AppearanceDataset.tsx
src/ui/arkpack/editor/EditorBuild.tsx
src/ui/arkpack/useArkpackSelectorActions.ts
src/ui/audio/GameAudio.tsx
src/ui/cheat-availability/useCheatAvailability.ts
src/ui/cheat-spotlight/CheatItemSpawnProvider.tsx
src/ui/cheats/useCheatsModel.ts
src/ui/editor/EditorShell.tsx
src/ui/editor/useEditorUnsavedChangesRegistration.ts
src/ui/editor/useEditorWelcomeActions.ts
src/ui/game-menu/useGameMenuActions.ts
src/ui/item-detail/ItemDetailProvider.tsx
src/ui/item-detail/useCloseItemDetail.ts
src/ui/item/editor/useEditorItemEstimate.ts
src/ui/item/editor/useEditorItemEstimateIndex.ts
src/ui/item/editor/useEditorItemFormController.ts
src/ui/item/editor/useEditorItemOriginFlow.ts
src/ui/launcher/LauncherHero.tsx
src/ui/launcher/LauncherStartupHydrator.tsx
src/ui/launcher/MainMenu.tsx
src/ui/launcher/useStartupSplashLifecycle.ts
src/ui/pixi/PixiBoardToolbarSurface.tsx
src/ui/pixi/PixiInventorySurface.tsx
src/ui/project/editor/useEditorProjectFormController.ts
src/ui/resource/editor/EditorAssetEdit.tsx
src/ui/resource/editor/EditorAssetManager.tsx
src/ui/settings/useSettingsDirectoriesModel.ts
src/ui/settings/useSettingsMcpModel.ts
src/ui/settings/useSettingsModel.ts
```

### Tests and support

```text
test/bridge/arkpack/AboutPortraitAssetsAtom.test.ts
test/bridge/arkpack/ArkpackCatalogAtom.test.ts
test/bridge/cheat/CheatCommandAtoms.test.ts
test/bridge/editor/EditorProjectAtom.test.ts
test/bridge/inventory/runInventoryReleaseAtom.test.ts
test/bridge/item/editor/saveEditorItemFx.test.ts
test/bridge/project/editor/saveEditorProjectConfigFx.test.ts
test/bridge/reactivity/CheatAvailabilityAtom.test.ts
test/bridge/reactivity/RendererAtomLifecycle.test.ts
test/bridge/reactivity/RendererAtomRegistry.test.ts
test/bridge/resource/editor/editEditorAssetFx.test.ts
test/bridge/resource/editor/saveEditorAssetsFx.test.ts
test/bridge/runtime/useRuntimeSelector.test.ts
test/bridge/tile/TileDefaultLineCommandAtom.test.ts
test/bridge/tile/runTileDropAtom.test.ts
test/support/createTestRendererRuntime.ts
test/ui/appearance/AppearanceAtom.test.ts
test/ui/appearance/AppearanceThemeMutation.test.ts
test/ui/arkpack/ArkpackSelector.test.ts
test/ui/audio/GameAudio.test.ts
test/ui/cheat-spotlight/CheatItemSpawnProvider.test.ts
test/ui/cheat-spotlight/CheatItemSpotlight.test.ts
test/ui/cheats/Cheats.test.ts
test/ui/editor/EditorAssetManager.test.tsx
test/ui/editor/EditorBuild.test.ts
test/ui/editor/EditorItemEstimateCacheAtom.test.ts
test/ui/editor/EditorItemSectionSession.test.tsx
test/ui/editor/EditorProjectProvider.test.ts
test/ui/editor/EditorProjectSectionSession.test.tsx
test/ui/editor/EditorShell.test.ts
test/ui/editor/EditorWelcomeCommandAtom.test.ts
test/ui/editor/useEditorItemEstimateIndex.test.tsx
test/ui/editor/useEditorItemOriginFlow.test.tsx
test/ui/game-menu/GameMenu.test.ts
test/ui/game-menu/GameMenuMutations.test.ts
test/ui/item-detail/ItemDetailCommandAtoms.test.ts
test/ui/launcher/LauncherCatalogIntegration.test.ts
test/ui/launcher/LauncherHeroAtom.test.ts
test/ui/launcher/LauncherStartupAtom.test.ts
test/ui/launcher/LauncherStartupHydrator.test.ts
test/ui/launcher/MainMenu.test.ts
test/ui/launcher/Settings.test.ts
test/ui/launcher/SettingsCommands.test.ts
test/ui/launcher/support/renderStartupSplashFx.ts
test/ui/pixi/PixiBoardToolbarSurface.test.ts
```

## Complete platform-node inventory

Snapshot at `4.0.0-rc.111`: 22 files — 3 production sources and 19 tests/support files.

```text
cli/arkini-repository.ts
electron/main/ElectronMainRuntime.ts
src/engine/cli/arkini.ts
test/desktop/DesktopPackaging.test.ts
test/desktop/buildDesktopFx.test.ts
test/desktop/createUnpackedMacAppFx.test.ts
test/desktop/packageDesktopMacFx.test.ts
test/desktop/previewDesktopMacFx.test.ts
test/electron/createFilesystemAppearancePreferencesFx.test.ts
test/electron/createFilesystemArkpackCatalogFx.test/fixture.ts
test/electron/createFilesystemCheatPreferencesFx.test.ts
test/electron/createFilesystemEditorMcpPreferencesFx.test.ts
test/electron/createFilesystemGameSaveFilesFx.test.ts
test/electron/createFilesystemLauncherPreferencesFx.test.ts
test/electron/createFilesystemWindowPreferencesFx.test.ts
test/electron/listArkpackFilesFx.test.ts
test/electron/registerArkiniElectronIpc.test/fixture.ts
test/pack/fx/arkpackSigningWorkflow.test.ts
test/pack/fx/packDirectoryFx.test.ts
test/schema/fx/writeGameJsonSchemaFx.test.ts
test/schema/support/readArkiniGameConfigSource.ts
test/source/readGameSourceFilesFx.test.ts
```

## Migration order

1. Keep the three Effect packages on one proven prerelease line; `rc.111` is the current checkpoint.
2. On stable release, read Effect, Atom, React Atom, Platform Node, and CLI migration notes and refresh this inventory.
3. Upgrade the three Effect packages as one exact stable set and verify the resolved install tree.
4. Migrate runtime and Scope ownership first: Electron root, renderer root, and game session where stable APIs actually differ.
5. Migrate Atom registry/runtime construction and validate retention/disposal.
6. Migrate command atoms, React hooks, AsyncResult handling, and Cause projection only where stable APIs supersede the current contracts.
7. Remove a prerelease workaround only after its dedicated regression passes without it.
8. Migrate the complete CLI tree when a supported stable CLI surface exists.
9. Run the full validation matrix and manually smoke-test launcher, gameplay, settings, cheats, Arkpack import/remove, save/exit, and Electron shutdown.
10. Remove resolved `TODO(#397)` markers, update this ledger with stable decisions, and close #397 only when no unjustified unstable Effect imports or prerelease pins remain.

## Behavioral compatibility gates

The RC checkpoint compiling cleanly is encouraging, but the stable migration is not complete merely because TypeScript compiles.

- A command exposes pending state immediately enough for cursor/button feedback.
- A second command is rejected or serialized according to the owning authority.
- Opening and closing detail UI cannot reset a running producer's progress cursor.
- Pending/result/error state survives the React remounts it is designed to survive.
- Atom disposal interrupts only work owned by that atom and does not leak fibers.
- Game bootstrap failure or interruption closes every partially acquired scope exactly once.
- Concurrent game commands stop before save flush/discard and session release.
- Defects and interruption reach lifecycle/error boundaries instead of becoming typed UI errors.
- Electron and renderer runtimes remain single process-owned roots.
- CLI commands preserve names, options, help, exit codes, and package/build workflows.

High-value regression suites:

```sh
npx vitest run --no-color \
  test/bridge/reactivity \
  test/bridge/game/createGameSession.test.ts \
  test/bridge/game/createGameSessionBootstrapLifecycle.test.ts \
  test/ui/appearance/AppearanceThemeMutation.test.ts \
  test/ui/arkpack/ArkpackSelector.test.ts \
  test/ui/cheat-spotlight \
  test/ui/cheats \
  test/ui/game-menu \
  test/ui/item-detail/ItemDetailCommandAtoms.test.ts \
  test/ui/launcher/MainMenu.test.ts \
  test/ui/launcher/Settings.test.ts \
  test/bridge/inventory/runInventoryReleaseAtom.test.ts \
  test/bridge/tile/TileDefaultLineCommandAtom.test.ts \
  test/bridge/tile/runTileDropAtom.test.ts \
  test/ui/reactivity/readSettledAsyncResultError.test.ts
```

Final repository checks:

```sh
npm run format:check
npm run typecheck
npm run build
npm run dc
npm test
git diff --check
```

## Done criteria

- `package.json` ultimately pins mutually compatible stable Effect packages; until then every retained RC checkpoint resolves one coherent exact set.
- `rg 'effect/unstable|4\.0\.0-(beta|rc)' package.json src electron cli test` has no unreviewed matches before #397 is closed.
- Every `TODO(#397)` is removed or converted into a stable, intentionally documented
  invariant.
- No local facade hides external Effect imports.
- All behavioral compatibility gates and repository checks pass.
- This document records the final stable API choices before #397 is closed.
