# Current project memory

This file contains durable non-obvious decisions and the exact continuation pointer. Root documentation owns the full architecture and code contracts.

## Current implementation task

**GitHub #200 — Electron desktop host**

Status: **#204, #205, #226, and save epic #217 are complete. Tasks #206 and #207 now have the local unsigned macOS arm64 package path and GitHub prerelease workflow implemented; native artifact/release smoke remains for the shared #208 integration pass.**

Read:

1. GitHub epic #200;
2. GitHub tasks #206 and #207 for the implemented packaging/release contracts;
3. GitHub task #208 before the final collaborative Apple Silicon integration pass.

Next action:

> Push the packaging commits, run `npm run package:mac` or manually dispatch the macOS prerelease workflow, inspect/open the unsigned DMG/ZIP on Apple Silicon, then complete #208 together.

## Source topology

- `src/engine` is the only standalone engine root. It owns gameplay, runtime, compiler, validation, packing, and public domain reads/commands and must not import bridge or presentation code.
- `src/bridge/<domain>/<operation>` is the only legal UI connection to public engine contracts. It owns the loaded `Game`, runtime subscriptions, save/event adapters, and concrete snapshot projections without caching a second truth. Bridge domains may not import UI/pages/routes or `src/engine/**/internal`.
- `src/ui` owns reusable React presentation and transient gesture/geometry/animation state. It may depend on bridge domains but never imports `src/engine` directly, pages, or routes.
- `src/page` owns route-level screen and layout composition over UI only.
- `src/@routes` contains only TanStack Router file registrations pointing to standalone page components. `src/_route.ts` is generated and `src/router.tsx` owns router creation.
- Dependency direction is `@routes → page → ui → bridge → engine`; Dependency Cruiser and permanent architecture tests enforce it.
- Bridge paths remain shallow and concrete. `app` is reserved for genuinely Electron/router-wide application concerns; the loaded gameplay root is `Game`.
- `src/_archive` is historical reference only, excluded from TypeScript, tests, bundling, Dependency Cruiser roots, and formatting. Active source, CLI, and tests may never import it.

## Browser shell foundation

- TanStack Router file routing is generated from `src/@routes` into `src/_route.ts`. Route modules remain thin registrations over standalone page components.
- TanStack Router uses standard browser history. Browser development runs on the Vite HTTP origin; packaged Electron serves the same renderer from the privileged standard origin `arkini://app/*`.
- `/` is the local Arkpack selector and `/game/$packageId` is the game branch. Hash routes and `file://` are not supported application modes.
- Electron main/preload live under `electron/`, own only typed platform capabilities, and may not import renderer/engine roots. Preload exposes only the Arkpack, save, and controlled-close contracts implemented by #226/#220.
- `electron-vite` is pinned to `6.0.0-beta.1` because the renderer is already on Vite 8; the stable v5 peer range does not support Vite 8. Re-evaluate only when a stable v6-compatible release exists.
- Electron 43 exposes the official `install-electron` binary but does not install its native executable from its own package lifecycle. The project runs `install-electron` from the root `postinstall`, so `npm install` / `npm ci` prepare Electron once and runtime scripts stay clean. Closing the last Electron window always quits the application so the owning `electron-vite` command and renderer server terminate as well.
- Bundled Arkini and imported packages share one validated selector; uploads never leave the device.
- `/game/$packageId` is a layout branch composed by `GameShellPage → GameShell → Outlet`; future `/dev/**` routes remain outside the game shell.
- `GameOwnerProvider` lives at the stable root shell above the route outlet and owns one `createGameOwner` lifecycle. `GameShell` requests the selected package and releases it on route cleanup; launcher ↔ game navigation and StrictMode replay therefore share the same serialization point.
- Game replacement always awaits the current `Game.dispose()` final save before creating the latest requested package. Obsolete intermediate requests are coalesced, stale bootstraps are disposed exactly once before publication, and disposal/bootstrap failure becomes a truthful shell failure state.
- `GameProvider` is keyed by `game.instanceKey`; replacing the complete `Game` remounts every game-local React provider while router and future `/dev/**` branches survive.
- `/game/$packageId` currently renders the canonical current-space board. Inventory and commands remain future slices. The root owner already exposes single-flight hard reset: discard current session without final save → clear exact save key → normal fresh bootstrap.

## Live bridge and tile foundation

- `bridge/arkpack` validates compressed package bytes and derives SHA-256 identity. Electron persists the original imported binary plus rebuildable descriptor metadata under `userData/arkini/arkpacks/<sha256>` through narrow preload capabilities. Catalog listing reads descriptors only; exact package load reads one binary and fully revalidates it. Browser `File.size` is checked before `arrayBuffer()`, while the reader keeps the compressed-byte guard for non-File callers. Browser diagnostics use memory only.
- `bridge/save` encodes the canonical `StateSchema` as the strict MessagePack envelope `{ namespace: "arkini", format: 1, state }`. Electron stores opaque bytes atomically under `userData/arkini/saves/<packageId>/<contentHash>` through `pending.arksave → current.arksave`; browser diagnostics use memory only. Loads always construct a fresh session.
- `bridge/runtime/useRuntimeSelector` uses `useSyncExternalStore` directly over `Game.getSnapshot` and `Game.subscribe`. It may memoize a selected value for one runtime root but never stores a second runtime or synchronizes through `useEffect`.
- `bridge/board/useBoard` projects board size, current space, live board identities/revisions, quantity, and resource URLs from that exact snapshot.
- `ui/tile` is headless and independent from bridge/engine domains. It owns only mounted DOM nodes and one transient pointer session.
- `BoardTile` receives canonical identity + revision from the live board projection. Revision change or unmount cancels stale pointer state; replacing `Game` remounts the complete tile system.
- `ui/canvas/Canvas` owns one fixed renderer viewport. Document roots never scroll; pages must fit or use intentional scrollbar-hidden internal scrolling. The board fits the largest available rectangle while preserving the canonical board aspect ratio, so window size always drives board size.
- Electron opens centered at 75% of the current display work area. `F11` and `Alt+Enter` toggle native fullscreen, and every resize/fullscreen transition is presentation geometry only.
- `npm run package:mac` is the sole local distribution path. It stages only `out/**` plus a minimal dependency-free manifest, then `electron-builder` emits unsigned arm64 DMG/ZIP artifacts and verifies `SHA256SUMS` plus the unpacked `Arkini.app` seam.
- `.github/workflows/macos-prerelease.yml` runs the same package command on `macos-15`. Manual dispatch uploads an Actions artifact; `v*-dev.*` tags additionally create an immutable GitHub prerelease. Signing/notarization remain explicitly absent.
- Animations added later must continuously target the latest bridge snapshot. They may be interrupted/replanned and never queue authoritative state behind presentation.

## Test execution

- The permanent Vitest suite is split into ten deterministic shards for constrained agent/CI environments.
- Every shard inherits `maxWorkers: 1` from `vitest.config.ts`.
- Prefer running affected shards independently when the chained runner prints a green summary but fails to exit cleanly.
- `npm run test` remains the canonical full-suite command; sharding changes execution shape, not test semantics.

## Absolute code rules

- Named project operations are Effect programs and use `*Fx` without “pure helper” exceptions.
- Every exact identifier uses `IdSchema`; never create domain-specific ID schema aliases.
- One concept per file; no barrels, helper piles, or generic junk-drawer domains.
- Production writes enter through `modifyRuntimeFx` and build immutable validated candidates.
- The engine is standalone; UI is a thin presentation adapter.
- Do not change a configuration or runtime schema without first surfacing and agreeing on the exact need.

## Runtime and session

- One canonical committed transition owns runtime plus transient events.
- Mutation planning is serialized and interruptible.
- STM owns accepted commit and subscription registration.
- Runtime callbacks, event callbacks, save reporting, and Tick reporting are failure-isolated.
- Duplicate saves are acceptable.
- UI animation intentionally lags runtime and may be redirected by later events.
- Item revision is a runtime-only stale-intent token. Saves omit it and hydration creates fresh revisions for the new session.
- Jobs and queued requests are not revisioned because commands never target a previously observed mutable job/request shape.

## Runtime session speed

- `runtime.session.speedMode` is the single canonical live-session truth: `normal` or `accelerated`.
- Runtime session state is engine-visible but intentionally absent from `StateSchema`; hydration and a new session always start in `normal`.
- `toggleSpeedModeFx()` has no item dependency. A speed-cheat item is only a user-facing control and asset projection, never an authorization token or source of truth.
- Normal mode feeds newly observed wall time into Tick at `1×`; accelerated mode uses `30×`. Both use the same 200 ms fixed-step engine.
- Toggling first folds elapsed wall time under the old mode, then changes the root state. Pending normal time is never accelerated retroactively.
- Explicit `runTickRuntimeByFx` input is simulation time and never receives the speed multiplier.


## Multi-space board runtime

- Board memory is rejected. The world uses multiple isolated board spaces plus one universe-wide passive inventory.
- Every board location has mandatory `space`; no default, optional field, or legacy fallback exists. A board cell is `space + x + y`.
- `runtime.currentSpace` is persistent root navigation state and is saved/restored. It is not part of runtime-only `session`.
- `currentSpace` controls presentation and explicit inventory-to-board destination only. Every space continues to Tick, dispatch, complete, spend, and expire.
- Every spatial operation is local to one space. Placement may fall back to inventory according to item scope but never to another board space.
- Direct board-to-board cross-space movement, swap, merge, output, and placement do not exist. Inventory is the only cross-space bridge. An explicit inventory item may interact with an off-screen board target and materialize around that target; `currentSpace` is not a global authorization boundary.
- Query reach is explicit and separate from item storage: `board` means origin-space board with distance, `inventory` means shared inventory, `any` means origin-space board plus inventory, and `universe` means every board space plus inventory without distance.
- Permanent query coverage proves that `input`, `job`, and `reserved` ownership scopes remain invisible to `board`, `any`, and `universe`; universe-wide reach still means grids only, never every runtime-owned identity.
- Attached ownership state has no independent board space. A movable owner carries its complete ownership graph through inventory; local `board`/`any` dependencies are re-evaluated in the destination space, `universe` dependencies remain global, and all surviving outputs/releases materialize around the owner's current board location.
- `setCurrentSpaceFx({ space })` is a root command with no item dependency or unlock policy. Jump/Home items are future UI representations only.

## Tick, jobs, queue, and completion

- Fixed simulation step: 200 ms; production time source: Effect Clock.
- Jobs store only `durationMs` and `remainingMs`; one active job per owner.
- Temporary items store authored `durationMs` plus persisted `remainingDurationMs`. Every identity present at a step boundary loses one fixed step; identities created during that step begin at full duration and first advance on the next step.
- Ready temporary items expire after job completions in stable runtime-ID order. Expiry removes the item first, then resolves optional output from the released board origin through one deterministic output/placement stream. Expected capacity failure leaves the same item at `remainingDurationMs: 0` for retry.
- Filling inputs never starts work; starting is explicit.
- Inventory is passive storage and a hard pause. No new identity-bound state attaches or spends there.
- Started jobs cannot be cancelled; queued requests are FIFO and reserve or pay nothing until dispatch. A blocked head remains until fresh runtime makes it runnable or the player explicitly clears the owner's whole pending queue.
- `clearItemJobQueueFx({ ownerItemId })` removes every current pending request for that owner, does not target request or item revisions, and never touches active work or resources.
- Producer, craft, blueprint, and stash keep separate item schemas but use one `LineSchema`, optional `line.output`, and one generic completion path.
- Item type never decides lifetime. An item without charges persists; an item with charges dies when one instance reaches zero.
- Completion removes consumed roots and the ready job in one candidate, removes a depleted owner before line output, emits optional depletion output second, releases depleted-owner inputs, then relocates the same live reserved instances. Any failure rolls back the entire candidate.
- Active jobs reserve worst-case `line.output` plus deferred depleted-owner output against `maxCount`; dying owners and consumed job materials offset output of their own canonical items. Runtime hydration validates the same live-plus-reserved capacity used by commands.

## Charges, inputs, purity, and isolation

- Item authoring uses `charges: { amount, output? }`; live `remainingCharges` is stored only after a spend changes the full amount.
- Input authoring uses `charges: { cost, from: "self" | "target" }`. Target charging is valid only for deposit inputs, which deterministically resolve one sufficiently charged board-capable payer. `deposit` is an external-payer interaction kind, not a target item category. Validation also rejects the deliberately narrow provably impossible case where exact-item target costs exceed `charges.amount × finite maxCount`.
- Charge costs are reserved across line input resolution, aggregated by runtime payer ID, and spent once inside the start candidate.
- Idle full depletions resolve before surviving stateful payers so capacity freed by the command may satisfy later isolation.
- A fresh charged stack is pure. A partial spend stores state, preserves the original board identity at quantity `1`, and standard-places the pure remainder. Full idle depletion consumes one quantity in place.
- Material selectors describe their complete accepted candidate set. Every matched canonical item must be eligible for material-input storage; temporary items are board-bound and therefore rejected offline and by the authoritative store planner.
- A zero-capacity material input is closed during its active job; positive capacity stays open storage. Game validation permits positive capacity only on producer-owned lines.
- Pure items use configured `maxStackSize`; impure items have effective stack size `1`.
- Temporary lifetime is identity-bound runtime state, so every temporary item is impure even at full authored duration.

## Placement, reservations, and removal

- Output board placement is only `drop` or `random`; inventory fallback follows item scope. `random` chooses one origin from every board cell, including occupied cells, then runs the normal stack-first nearest placement for the complete drop without rerolling. There is no output replacement lifecycle.
- `scope: "reserved"` retains the same live reserved runtime instance, revisioned state, and passive owned subtree for one active job. It remembers no historical stack, slot, or position. Completion relocates that same instance from the current board position of the line owner.
- `placeRuntimeItemFx` is the sole canonical relocation entry point for any existing live item that survives an operation. Pure items may normalize into ordinary stacks and new identities through standard drop placement. Impure items preserve their exact identity, state, and passive owned subtree, require one exclusive grid cell, and use the same scope, origin, nearest-first, and inventory-fallback policy. Never add lifecycle-specific placement paths.
- `scope: "job"` means consumed root only. Consume discards the passive owned subtree at actual start; hydration requires the committed root to own no remaining subtree, work, or queue, and completion discards the root without return or depletion output.
- Generic mutations reject both consumed and reserved job-owned items. The passive-state discard primitive fails rather than silently deleting active jobs or committed job material.
- `setItemQuantityFx` is an absolute replacement command. Its `maxCount` check excludes the target identity's previous quantity while still counting every other live quantity and every active-job output reservation; setting the same quantity remains a successful revisioned write.
- Shared identity removal deletes the owner and queue; full public removal additionally releases buffered roots through `placeRuntimeItemFx` from the board owner origin. A loaded owner in passive inventory must return to the board before removal; inventory coordinates are never used as a board origin.
- Completion and depletion use the same atomic primitives without nesting public write commands.


## Directional gameplay merge

- `mergeItemsFx` is the sole canonical gameplay-merge write. UI passes revised source and target identities only; source-owned authored rules decide behavior.
- Source may be board or inventory; target must be board. The first authored matching rule wins and reverse rules are never inferred.
- Exactly one source quantity participates. `consume` permanently converts it; `use` requires a pure idle source and standard-places it around the target after the target effect.
- `keep` leaves target state untouched. `remove` removes one idle target quantity through standard owner removal. `replace` preserves target identity/location but requires one pure idle quantity and recreates canonical initial runtime state through `createRuntimeItemFx`.
- Source action, target effect, source return, optional output, candidate validation, and `item:merged` event are atomic. Blocked retries preserve deterministic output rolls from stable source/target/rule facts.
- Game validation requires merge target selectors to match at least one board-capable canonical item, replacement results to allow board presence, and exact self-target rules with `maxCount: 1` to be rejected as identity-impossible. Gameplay merge is not identical-item stack placement. Historical merge runtime is superseded; only feedback and animation intent remain for tasks 11 and 14.

## Randomness

- Completion randomness derives from stable job identity plus explicit algorithm versions.
- Immediate depletion randomness derives from stable unchanged start/payer facts.
- Temporary expiry randomness derives from stable temporary runtime identity and covers both output resolution and random placement origin.
- Tick time and wall clock are not seed inputs.
- Blocked retries and restored jobs preserve the same random result while canonical inputs remain unchanged.

## Configuration

- Authoring uses recursive JSON fragments and explicit PNG resources.
- Compiler, validator, tests, and packer share one completed-config compiler.
- Duplicate providers and IDs are diagnostics; later files never overwrite silently.
- Blueprint assets are explicit standard assets. No target, output, or visual is inferred from item type or file name.

## Migration policy

- Historical source is a behavioral oracle, never an architectural donor.
- Follow the numbered queue in `tasks/README.md`.
- Update `tasks/COVERAGE.md` after every completed slice.
- Do not repeatedly inspect areas marked **Superseded**, **Rejected**, **Archive-ready**, or **Removed** unless a current task names a concrete unresolved behavior.

## Destructive utilities

- `consumeItemIntoCheatInventoryFx` is the sole cheat-sink write. It requires distinct revised board source and cheat-inventory target identities in the same space, consumes the complete source through ordinary idle-owner removal, preserves the sink, and emits `cheat-inventory:consumed` for presentation feedback. It is not swap or merge.
- `requestNukeSaveFx()` only emits `nuke-save:requested`; the nuke item is a presentation control, not an engine dependency.
- The root `createGameOwner` is the completed replacement and hard-reset ownership boundary. Hard reset single-flights dispose-without-save → clear exact persisted package/hash state → create the same package through `createGameFx` → publish one fresh `Game`.
- Controlled Electron close and HMR handoff use `shutdownGameOwner`. Final-save failure retains the same frozen Game and retries the exact final snapshot on the next close request; it never degrades into a successful empty-owner shutdown. The failure UI offers explicit safe retry or force exit without saving. Force exit starts best-effort discard cleanup and authorizes main to close immediately only after that deliberate renderer decision.
- Do not add another reset owner, mutate a running engine back to initial state, hide correctness in React-local state, or use a module-global lock/map.
