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

- the source, Electron, and test TypeScript configurations;
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

Run these searches before changing dependencies. They are the source of truth; do not
check in generated path inventories that become stale as the repository moves:

```sh
rg -l 'effect/unstable/reactivity' src electron test | sort
rg -l 'effect/unstable/cli' src electron test | sort
rg -l '@effect/atom-react' src electron test | sort
rg -l '@effect/platform-node' src electron test | sort
rg -n 'TODO\(#397\)' src electron test
rg -n 'Effect\.yieldNow|Atom\.(writable|keepAlive|setIdleTTL)|concurrent: true|mode: "promise"|cause\.reasons' src electron test
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
| CLI | Product command declarations import `effect/unstable/cli`; `src/engine/cli/arkini.ts` owns the only CLI runtime edge. Repository automation is plain Bash in `Argcfile.sh`. | Move the product root to the supported stable CLI entrypoint. Preserve command names, options, help text, exit codes, and typed failures. |
| Atom/React types | Feature atoms depend directly on unstable `Atom`, `AtomRegistry`, `AsyncResult`, and `AtomRuntime` types plus `@effect/atom-react` hooks. | Adopt final stable names and generics directly. Do not paper over type drift with casts or a repository-local compatibility facade. |

HMR state preservation is explicitly out of scope. Arkini may restart renderer state during
development; the migration must not add HMR handoff, global caches, or module-dispose state
transfer.

## Semantic review markers

`TODO(#397)` marks code where beta behavior influenced architecture or ordering. These
comments are migration review points, not instructions to mechanically delete code.

The searches above cover the mechanical API surface. A file does not need a duplicate TODO
merely because it imports an unstable module.

## Migration order

1. Keep the three Effect packages on one proven prerelease line; `rc.111` is the current checkpoint.
2. On stable release, read Effect, Atom, React Atom, Platform Node, and CLI migration notes and refresh the searches above.
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

```bash
./Argcfile.sh check
git diff --check
```

## Done criteria

- `package.json` ultimately pins mutually compatible stable Effect packages; until then every retained RC checkpoint resolves one coherent exact set.
- `rg 'effect/unstable|4\.0\.0-(beta|rc)' package.json src electron test` has no unreviewed matches before #397 is closed.
- Every `TODO(#397)` is removed or converted into a stable, intentionally documented
  invariant.
- No local facade hides external Effect imports.
- All behavioral compatibility gates and repository checks pass.
- This document records the final stable API choices before #397 is closed.
