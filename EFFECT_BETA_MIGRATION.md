# Effect 4 Beta Migration Ledger

Tracking issue: [#397 — Migrate Arkini from Effect 4 beta to stable APIs](https://github.com/marek-hanzal/arkini/issues/397)

This is the canonical starting point for the future instruction “fix Effect after beta”.
It records every directly affected source area, the beta-specific decisions that exist
today, and the behavior that a stable migration must preserve.

## Trigger

Start this work when stable, mutually compatible releases exist for all three packages:

- `effect`
- `@effect/atom-react`
- `@effect/platform-node`

They are currently pinned together at `4.0.0-beta.101`. Upgrade them as one dependency
set; do not independently float one package across an incompatible Effect version.

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

## Beta-specific boundaries

| Boundary | How it works on beta.101 | Stable target |
| --- | --- | --- |
| Package set | The three Effect packages are exactly pinned to the same beta. | Move the set to mutually compatible stable versions, regenerate the lockfile, and inspect release/migration notes for every crossed beta. |
| Renderer Atom root | `RendererAtomRegistry` owns one process-lifetime registry, `scheduleTask`, a `400ms` default idle TTL, a registry Layer, and a zero-service Atom runtime. | Use the supported stable registry/runtime construction APIs while preserving one renderer authority. Re-evaluate the TTL from measured lifecycle behavior instead of blindly carrying `400`. |
| Concurrent command settlement | Concurrent write atoms yield once before running work because beta.101 can otherwise settle a synchronous command before subscribers observe the pending state. | Remove `Effect.yieldNow` only if stable Atom settlement has a documented ordering guarantee and all pending/error/remount regressions pass without it. |
| Command authorities | Cross-component commands use registry-owned `Atom.writable` authorities so pending and settlement survive React remounts and reject overlapping commands deterministically. | Prefer the final stable command abstraction if one exists; otherwise retain writable authorities and their single-command admission contract. Never move the truth back into component-local React state. |
| React promise mode | Arkpack import/remove use `useAtomSet(..., { mode: "promise" })` behind one exclusive owner. Lifecycle-sensitive application commands deliberately consume registry state instead of awaiting `promiseExit`. | Re-check stable promise/error/interruption semantics. Keep promise mode only where the caller truly owns the full async lifetime; do not let unmount turn a process command into an orphaned local promise. |
| Atom lifetime | Process authorities use `Atom.keepAlive`; short-lived command atoms use `Atom.setIdleTTL(0)`; registry defaults to `400ms`. | Verify stable retention, disposal, subscription, and remount semantics. Preserve process-owned authorities and prompt disposal of ephemeral command atoms without leaking fibers. |
| Cause projection | `readExactCauseFailure` and `readSettledAsyncResultError` inspect `cause.reasons` and accept exactly one `Fail` reason. Defects, interruption, and composite causes remain lifecycle failures. | Replace internal-looking Cause traversal with the final supported stable projection API if available. Preserve exact typed-failure-only behavior; never flatten defects or interruption into UI/domain errors. |
| Game session runtime | A `ManagedRuntime`, owner `Scope`, forked session/command scopes, `FiberSet` command runtime, AbortSignal propagation, and exactly-once disposal jointly own Tick, save, subscriptions, and commands. | Translate to stable lifecycle APIs without weakening ownership. Bootstrap failure/interruption, overlapping disposal, frozen retry behavior, command admission, save ordering, and exactly-once cleanup are compatibility gates. |
| Renderer and Electron roots | Renderer and Electron each own one process-lifetime `ManagedRuntime`; Electron supplies `NodeServices.layer`. | Use stable runtime/platform APIs and retain explicit process roots. Do not create per-callback runtimes or duplicate service authorities. |
| CLI | All command declarations import `effect/unstable/cli`; `cli/arkini.ts` supplies `NodeServices.layer` and uses `NodeRuntime.runMain`. | Move the complete command tree to the supported stable CLI entrypoint in one pass. Preserve command names, options, help text, exit codes, typed failures, and packaging scripts. |
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
- `src/bridge/item-detail/useAutofillItemDetailLine.ts`
- `src/bridge/item-detail/useClearItemDetailQueue.ts`
- `src/bridge/item-detail/useSetDefaultItemDetailLine.ts`
- `src/bridge/item-detail/useStartItemDetailLine.ts`
- `src/bridge/item-detail/useUnsetDefaultItemDetailLine.ts`
- `src/bridge/item-detail/useWithdrawItemDetailLine.ts`
- `src/ui/audio/useGameAudioAtoms.ts`
- `src/ui/cheat-spotlight/CheatItemSpawnCommandAtom.ts`
- `src/ui/cheats/updateGameCheatsAtom.ts`
- `src/ui/item-detail/createItemDetailControllerFx.ts`
- `src/ui/settings/SettingsCommandAtom.ts`

Other commands whose contract depends on `concurrent: true` without a synthetic yield:

- `src/bridge/cheat/setCheatAvailabilityAtom.ts`
- `src/ui/launcher/retryLauncherStartupAtom.ts`

Registry-owned command authorities using `Atom.writable`:

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
- `src/bridge/item-detail/useAutofillItemDetailLine.ts`
- `src/bridge/item-detail/useClearItemDetailQueue.ts`
- `src/bridge/item-detail/useSetDefaultItemDetailLine.ts`
- `src/bridge/item-detail/useStartItemDetailLine.ts`
- `src/bridge/item-detail/useUnsetDefaultItemDetailLine.ts`
- `src/bridge/item-detail/useWithdrawItemDetailLine.ts`
- `src/bridge/lifecycle/requestApplicationCloseAtom.ts`
- `src/bridge/tile/dropItemAtom.ts`
- `src/ui/audio/useGameAudioAtoms.ts`
- `src/ui/cheat-spotlight/CheatItemSpawnCommandAtom.ts`
- `src/ui/cheats/updateGameCheatsAtom.ts`
- `src/ui/game-menu/gameMenuCommandAtom.ts`
- `src/ui/item-detail/createItemDetailControllerFx.ts`

## Complete unstable reactivity inventory

Snapshot: 89 files total — 57 production sources and 32 tests/support files.

### Production

```text
src/@routes/index.tsx
src/bridge/appearance/AppearanceAtom.ts
src/bridge/appearance/setAppearanceThemeAtom.ts
src/bridge/arkpack/ArkpackCatalogAtom.ts
src/bridge/arkpack/ArkpackCatalogOwnerAtom.ts
src/bridge/arkpack/configureArkpackCatalogFx.ts
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
src/bridge/game/GameSession.ts
src/bridge/game/createGameSessionFx.ts
src/bridge/game/makeExactGameAtomFamily.ts
src/bridge/item-detail/useAutofillItemDetailLine.ts
src/bridge/item-detail/useClearItemDetailQueue.ts
src/bridge/item-detail/useSetDefaultItemDetailLine.ts
src/bridge/item-detail/useStartItemDetailLine.ts
src/bridge/item-detail/useUnsetDefaultItemDetailLine.ts
src/bridge/item-detail/useWithdrawItemDetailLine.ts
src/bridge/lifecycle/requestApplicationCloseAtom.ts
src/bridge/reactivity/RendererAtomRegistry.ts
src/bridge/runtime/GameRuntimeAtom.ts
src/bridge/runtime/useRuntimeSelector.ts
src/bridge/tile/dropItemAtom.ts
src/ui/audio/useGameAudioAtoms.ts
src/ui/cheat-spotlight/CheatItemSpawnCommandAtom.ts
src/ui/cheats/updateGameCheatsAtom.ts
src/ui/game-menu/gameMenuCommandAtom.ts
src/ui/game-menu/useGameMenuActions.ts
src/ui/item-detail/ItemDetailControl.ts
src/ui/item-detail/createItemDetailControllerFx.ts
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
src/ui/launcher/completeLauncherSplashAtom.ts
src/ui/launcher/configureLauncherStartupFx.ts
src/ui/launcher/retryLauncherStartupAtom.ts
src/ui/reactivity/readSettledAsyncResultError.ts
src/ui/settings/SettingsCommandAtom.ts
src/ui/tile/TileActor.tsx
src/ui/tile/useTileActorDrag.ts
```

### Tests and support

```text
test/bridge/arkpack/AboutPortraitAssetsAtom.test.ts
test/bridge/arkpack/ArkpackCatalogAtom.test.ts
test/bridge/cheat/CheatCommandAtoms.test.ts
test/bridge/game/createGameSession.test.ts
test/bridge/reactivity/CheatAvailabilityAtom.test.ts
test/bridge/reactivity/RendererAtomLifecycle.test.ts
test/bridge/reactivity/RendererAtomRegistry.test.ts
test/bridge/runtime/useRuntimeSelector.test.ts
test/bridge/tile/dropItemAtom.test.ts
test/support/createTestRendererRuntime.ts
test/support/game/makeTestGameTransitionFieldsFx.ts
test/ui/appearance/AppearanceAtom.test.ts
test/ui/appearance/AppearanceThemeMutation.test.ts
test/ui/arkpack/ArkpackSelector.test.ts
test/ui/audio/GameAudio.test.ts
test/ui/cheat-spotlight/CheatItemSpawnProvider.test.ts
test/ui/cheat-spotlight/CheatItemSpotlight.test.ts
test/ui/cheats/Cheats.test.ts
test/ui/game-menu/GameMenuMutations.test.ts
test/ui/item-detail/ItemDetailCommandAtoms.test.ts
test/ui/launcher/LauncherCatalogIntegration.test.ts
test/ui/launcher/LauncherHeroAtom.test.ts
test/ui/launcher/LauncherStartupAtom.test.ts
test/ui/launcher/LauncherStartupHydrator.test.ts
test/ui/launcher/MainMenu.test.ts
test/ui/launcher/Settings.test.ts
test/ui/launcher/StartupSplash.test.ts
test/ui/launcher/support/renderStartupSplashFx.ts
test/ui/reactivity/readSettledAsyncResultError.test.ts
test/ui/tile/TileActorDropLifecycle.test.ts
test/ui/tile/TileActorRenderBoundary.test.ts
test/ui/tile/support/makeDropItemTestAtom.ts
```

## Complete unstable CLI inventory

Snapshot: 19 production files.

```text
cli/ArkiniCommand.ts
cli/arkini.ts
cli/arkpack/ArkpackCommand.ts
cli/arkpack/ArkpackKeygenCommand.ts
cli/arkpack/ArkpackOfficialPackCommand.ts
cli/arkpack/ArkpackSignCommand.ts
cli/arkpack/ArkpackVerifyCommand.ts
cli/desktop/DesktopBuildCommand.ts
cli/desktop/DesktopChecksumsCommand.ts
cli/desktop/DesktopCleanCommand.ts
cli/desktop/DesktopCommand.ts
cli/desktop/DesktopPackageCommand.ts
cli/desktop/DesktopPreviewMacosCommand.ts
cli/desktop/DesktopStageCommand.ts
cli/desktop/DesktopVerifyCommand.ts
src/engine/cli/GameCommand.ts
src/engine/pack/cli/PackCommand.ts
src/engine/schema/cli/SchemaCommand.ts
src/engine/validation/cli/ValidateCommand.ts
```

## Complete atom-react inventory

Snapshot: 53 files total — 26 production sources and 27 tests/support files.

### Production

```text
src/bridge/arkpack/useAboutPortraitAssets.ts
src/bridge/arkpack/useArkpacks.ts
src/bridge/item-detail/useAutofillItemDetailLine.ts
src/bridge/item-detail/useClearItemDetailQueue.ts
src/bridge/item-detail/useSetDefaultItemDetailLine.ts
src/bridge/item-detail/useStartItemDetailLine.ts
src/bridge/item-detail/useUnsetDefaultItemDetailLine.ts
src/bridge/item-detail/useWithdrawItemDetailLine.ts
src/bridge/reactivity/RendererAtomRegistry.ts
src/bridge/runtime/useRuntimeSelector.ts
src/main.tsx
src/ui/appearance/AppearanceDataset.tsx
src/ui/arkpack/useArkpackSelectorActions.ts
src/ui/audio/GameAudio.tsx
src/ui/cheat-availability/useCheatAvailability.ts
src/ui/cheat-spotlight/CheatItemSpawnProvider.tsx
src/ui/cheats/useCheatsModel.ts
src/ui/game-menu/useGameMenuActions.ts
src/ui/item-detail/ItemDetailProvider.tsx
src/ui/item-detail/useCloseItemDetail.ts
src/ui/launcher/LauncherHero.tsx
src/ui/launcher/LauncherStartupHydrator.tsx
src/ui/launcher/MainMenu.tsx
src/ui/launcher/useStartupSplashLifecycle.ts
src/ui/settings/useSettingsModel.ts
src/ui/tile/useTileActorDrag.ts
```

### Tests and support

```text
test/bridge/arkpack/AboutPortraitAssetsAtom.test.ts
test/bridge/arkpack/ArkpackCatalogAtom.test.ts
test/bridge/cheat/CheatCommandAtoms.test.ts
test/bridge/reactivity/CheatAvailabilityAtom.test.ts
test/bridge/reactivity/RendererAtomLifecycle.test.ts
test/bridge/reactivity/RendererAtomRegistry.test.ts
test/bridge/runtime/useRuntimeSelector.test.ts
test/bridge/tile/dropItemAtom.test.ts
test/support/createTestRendererRuntime.ts
test/ui/appearance/AppearanceAtom.test.ts
test/ui/appearance/AppearanceThemeMutation.test.ts
test/ui/arkpack/ArkpackSelector.test.ts
test/ui/audio/GameAudio.test.ts
test/ui/cheat-spotlight/CheatItemSpawnProvider.test.ts
test/ui/cheat-spotlight/CheatItemSpotlight.test.ts
test/ui/cheats/Cheats.test.ts
test/ui/game-menu/GameMenu.test.ts
test/ui/game-menu/GameMenuMutations.test.ts
test/ui/item-detail/ItemDetailCommandAtoms.test.ts
test/ui/launcher/LauncherCatalogIntegration.test.ts
test/ui/launcher/LauncherHeroAtom.test.ts
test/ui/launcher/LauncherStartupAtom.test.ts
test/ui/launcher/LauncherStartupHydrator.test.ts
test/ui/launcher/MainMenu.test.ts
test/ui/launcher/Settings.test.ts
test/ui/launcher/support/renderStartupSplashFx.ts
test/ui/tile/TileActorDropLifecycle.test.ts
```

## Complete platform-node inventory

Snapshot: 18 files — 2 production sources and 16 tests/support files.

```text
cli/arkini.ts
electron/main/ElectronMainRuntime.ts
test/desktop/DesktopPackaging.test.ts
test/desktop/buildDesktopFx.test.ts
test/desktop/createUnpackedMacAppFx.test.ts
test/desktop/packageDesktopMacFx.test.ts
test/desktop/previewDesktopMacFx.test.ts
test/electron/createFilesystemAppearancePreferencesFx.test.ts
test/electron/createFilesystemArkpackCatalogFx.test.ts
test/electron/createFilesystemCheatPreferencesFx.test.ts
test/electron/createFilesystemGameSaveFilesFx.test.ts
test/electron/createFilesystemLauncherPreferencesFx.test.ts
test/electron/registerArkiniElectronIpc.test.ts
test/pack/fx/arkpackSigningWorkflow.test.ts
test/pack/fx/packDirectoryFx.test.ts
test/schema/fx/writeGameJsonSchemaFx.test.ts
test/schema/support/readArkiniGameConfigSource.ts
test/source/readGameSourceFilesFx.test.ts
```

## Migration order

1. Read stable Effect, Atom, React Atom, Platform Node, and CLI migration notes.
2. Refresh all inventories and add newly introduced boundaries to this ledger.
3. Upgrade the three Effect packages and lockfile as one set.
4. Migrate runtime and Scope ownership first: Electron root, renderer root, and game session.
5. Migrate Atom registry/runtime construction and validate retention/disposal.
6. Migrate command atoms, React hooks, AsyncResult handling, and Cause projection.
7. Remove a beta workaround only after its dedicated regression passes without it.
8. Migrate the complete CLI tree in one pass.
9. Run the full validation matrix and manually smoke-test launcher, gameplay, settings,
   cheats, Arkpack import/remove, save/exit, and Electron shutdown.
10. Remove resolved `TODO(#397)` markers, update this ledger with stable decisions, and
    close #397 only when no unstable Effect imports or beta pins remain.

## Behavioral compatibility gates

The stable migration is not complete merely because TypeScript compiles.

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
  test/ui/tile/TileActorDropLifecycle.test.ts \
  test/ui/reactivity/readSettledAsyncResultError.test.ts
```

Final repository checks:

```sh
npm run format:check
npm run typecheck
npm run game:validate
npm run game:schema
npm run build
npm run dc
npm test
git diff --check
```

## Done criteria

- `package.json` and the lockfile use mutually compatible stable Effect packages.
- `rg 'effect/unstable|4\.0\.0-beta' package.json package-lock.json src electron cli test`
  has no unreviewed matches.
- Every `TODO(#397)` is removed or converted into a stable, intentionally documented
  invariant.
- No local facade hides external Effect imports.
- All behavioral compatibility gates and repository checks pass.
- This document records the final stable API choices before #397 is closed.
