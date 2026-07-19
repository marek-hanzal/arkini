# Current project memory

This file contains durable non-obvious decisions and the exact continuation pointer. Root documentation owns the full architecture and code contracts.

## Current implementation task

**Native View Transition page-system overhaul**

Status: **Implemented; targeted automated validation and throttled Chromium validation passed, native macOS Electron smoke pending.**

Current contract:

- `/` is the only permitted index page. Every other visible page ends in an explicitly named leaf route; the game screen is `/game/$packageId/board`.
- `/game/$packageId` remains a non-visual resource/layout boundary. It requires the exact cached `GameEngineResource`, exposes the canonical `Game` through inherited TanStack Router context and loader data, and renders only `Outlet`.
- `/action/load-game/$packageId` is the sole explicit creation page. Its loader calls `ensureQueryData(gameEngineQueryOptions(...))`, its pending/error components render the Hero action presentation, and success redirects to `/game/$packageId/board`. Direct Board entry repairs through this same action.
- TanStack Query owns only the identity and lifetime of the route-scoped live resource. It does not own gameplay state or another reactive truth; gameplay UI reads the parent loader through `useGameEngine()` and must not call `useQuery()` for the engine.
- `GameEngineResource` contains the canonical `Game` plus one private Effect semaphore. Leave, reset, exit, HMR shutdown, and competing navigation are serialized through the resource lifecycle lock.
- Leave, reset, exit, recovery, and load are named leaf action routes whose loaders own complete operations. Their pending/error UI presents only Hero, label, progress, and retry/navigation affordances.
- `RootPage` owns only stable application infrastructure and `Canvas + Outlet`. No GameOwner provider, route binding, root loading overlay, hidden destination page, transition-name suppression mode, or nested `document.startViewTransition()` remains.
- Cross-page animation belongs exclusively to typed native TanStack Router View Transitions. WAAPI/CSS animation may exist only for local same-page interaction and may not compete for route-owned opacity/transform.
- Every unequal visible route pair resolves to an explicit family: `startup | launcher | action | board` → `startup | launcher | action | board`. Unknown visible paths fail loudly instead of silently receiving a default transition.
- Native shared surfaces are deliberately granular: `arkini-launcher-backdrop`, `arkini-launcher-hero-shadow`, `arkini-launcher-hero-artwork`, `arkini-startup-content`, `arkini-route-content`, `arkini-game-board`, and `arkini-game-menu-backdrop`. No opaque full-page launcher snapshot is named.
- Shared Hero pairs keep the old raster opaque while the native transition group performs geometry interpolation; the destination Hero raster stays hidden. This prevents Chromium's default `plus-lighter` cross-fade from dimming the logo or exposing rectangular textures around transparent artwork/shadows.
- Typed pseudo-element selectors must attach directly to `:active-view-transition-type(...)` with no descendant whitespace. A regression test guards this exact compositor bug.
- Startup content owns `arkini-startup-content`, separate from launcher/action `arkini-route-content`, so “Press Esc” cannot morph into a destination panel. Splash and Main Menu remain separate DOM pages; native shared-element geometry performs the Hero handoff.
- The root transition does not cross-fade. A short opaque old-root handoff covers slow React update callbacks, then named surfaces own all visible animation.
- Renderer route auto code splitting is intentionally disabled. Under CPU throttling, an unloaded lazy route produced a pure black frame before the View Transition began; Arkini is a desktop renderer with small route modules, so deterministic eager availability is the correct trade.
- Throttled Chromium validation covered splash → Main Menu, launcher page navigation, Main Menu → load action → Board, GameMenu → leave action → Settings, and Settings → load action → Board. No Hero fade, logo rectangle, or lazy-route black frame remained in the captured filmstrips.

Responsive viewport contract:

- `ui/canvas/Canvas` owns the exact renderer viewport and is the one CSS size container for every route, board, pending page, and menu.
- shared `cqw`/`cqh` variables on Canvas own viewport padding, gaps, panel padding, control dimensions, and Hero width; child surfaces must consume those variables instead of introducing unrelated `vw`/`vh` sizing.
- short viewports reduce the fixed Hero allocation and compact Hero width while preserving the same two-slot MainPage structure; panels and GameMenu fit the viewport and use deliberate internal scrolling when their semantic content cannot shrink further.
- document roots never scroll, and measured route surfaces must remain within Canvas at `1200×900`, `900×600`, `700×500`, `600×400`, and `480×320`; a tiny viewport may scroll inside its panel but may not grow or clip the document.

Next action:

> Run native macOS Electron smoke validation for the same transition graph, including title-bar close, reduced motion, light/dark appearance changes, and tiny Canvas sizes. Treat any unnamed visible navigation, default Chromium fade, rectangular Hero raster, or route-chunk wait frame as a blocking regression.

## Source topology

- `src/engine` is the only standalone engine root. It owns gameplay, runtime, compiler, validation, packing, and public domain reads/commands and must not import bridge or presentation code.
- `src/bridge/<domain>/<operation>` is the only legal UI connection to public engine contracts. It owns the loaded `Game`, runtime subscriptions, save/event adapters, and concrete snapshot projections without caching a second truth. Bridge domains may not import UI/pages/routes or `src/engine/**/internal`.
- `src/ui` owns reusable React presentation and transient gesture/geometry/animation state. It may depend on bridge domains but never imports `src/engine` directly, pages, or routes.
- `src/page` owns route-level screen and layout composition over UI only.
- `src/@routes` owns TanStack Router registration and route lifecycle orchestration (`beforeLoad`, loaders, redirects, context composition). It may render standalone page/UI surfaces and invoke public bridge operations, but never imports engine modules or another route module. `src/_route.ts` is generated and `src/router.tsx` owns router creation.
- Renderer dependencies form the DAG `@routes → {page, ui, bridge}`, `page → ui`, `ui → bridge`, and `bridge → engine`; Dependency Cruiser is the automated owner of these boundaries.
- Bridge paths remain shallow and concrete. `app` is reserved for genuinely Electron/router-wide application concerns; the loaded gameplay root is `Game`.
- `src/_archive` is historical reference only, excluded from TypeScript, tests, bundling, Dependency Cruiser roots, and formatting. Active source, CLI, and tests may never import it.

## Electron renderer foundation

- TanStack Router file routing is generated from `src/@routes` into `src/_route.ts`. Visual components remain standalone, while route modules own only router-specific lifecycle composition over public contracts, never gameplay implementation.
- TanStack Router uses standard history routing. Development Electron loads the renderer from the Vite HTTP origin for HMR; packaged Electron serves the same renderer from the privileged standard origin `arkini://app/*`.
- `/` is the one-session startup splash, `/main-menu` is the semantic out-of-game menu, `/arkpacks` contains the shared package selector, `/settings` owns the sole theme control, `/about` contains credits, `/game/$packageId` is the live resource boundary, and `/game/$packageId/board` is the explicit gameplay page. Hash routes, implicit game index pages, and `file://` are not supported application modes.
- Electron main/preload live under `electron/`, own only typed platform capabilities, and may not import renderer/engine roots. Preload exposes only the Arkpack, save, appearance, and controlled-close contracts.
- One trusted-renderer capability authorizes the Electron window. Development accepts only the exact configured loopback Vite origin and packaged mode ignores development renderer overrides and accepts only `arkini://app/*`; all external navigation/redirects, subframes, webviews, popups, and permissions are denied. Every Arkpack/save/appearance/lifecycle IPC sender must be the registered window's trusted main frame at a trusted parsed URL. Packaged responses carry a restrictive CSP. Development derives the exact HMR WebSocket endpoint from the same parsed loopback URL and adds one per-server Vite nonce for the React Refresh preamble; neither development allowance enters packaged output.
- Arkpack, save, and appearance persistence use narrow Effect-native object capabilities on both sides of typed IPC. Renderer adaptation from `ipcRenderer.invoke` happens once in domain transport operations; Electron handlers authorize once and run Effect-native `@effect/platform` filesystem operations through `ElectronMainRuntime`. No project-owned persistence classes or no-op close lifecycle remain.
- `electron-vite` is pinned to `6.0.0-beta.1` because the renderer is already on Vite 8; the stable v5 peer range does not support Vite 8. Re-evaluate only when a stable v6-compatible release exists.
- Electron 43 exposes the official `install-electron` binary but does not install its native executable from its own package lifecycle. The project runs `install-electron` from the root `postinstall`, so `npm install` / `npm ci` prepare Electron once and runtime scripts stay clean. Closing the last Electron window always quits the application so the owning `electron-vite` command and renderer server terminate as well.
- Bundled Arkini and imported packages share one root-owned `ArkpackCatalog`; uploads never leave the device. The startup owner refreshes it once, resolves exactly one built-in package, and `/arkpacks` reuses the same snapshot and mutation operations. TanStack Query never owns catalog data.
- `/game/$packageId` is a non-visual resource branch whose component is only `Outlet`; `/game/$packageId/board` composes `GameShell` and the canonical current-space Board. Future `/dev/**` routes remain outside this resource and shell.
- One renderer-session `LauncherStartup` starts immediately under the initial pure-black frame. Electron reports the actual `ready-to-show` visibility moment through preload; the approximately 500 ms black hold is anchored to that renderer timestamp rather than module evaluation. Appearance publishes early and `heroReady` is explicit after `HTMLImageElement.decode()`. Automatic completion requires hard readiness plus five visible seconds; legal Escape may continue once readiness exists. Startup then navigates to `/main-menu` and never mounts that destination beneath itself.
- `GameSession` and `Game` lifecycle is Effect-native: `flushSaveFx`, `disposeFx`, and `disposeWithoutSaveFx` are the only public lifecycle operations. One session lifecycle state plus `Deferred` shares concurrent disposal, failed final save leaves the same frozen session retryable, and game-owned resource Scope closes only after successful save disposal or explicit discard. Never restore a cached disposal Promise wrapper.
- `gameEngineQueryOptions` creates one `GameEngineResource` for one exact package query. The resource contains the canonical `Game` and one private Effect semaphore; Query stores identity/lifetime only and `useGameEngine()` reads the parent route loader rather than observing Query state.
- `GameMenuProvider` lives only at the Board shell and owns local `closed | entering | open | exiting`, Escape, focus trap/restoration, and a short route-request lock that prevents duplicate clicks while TanStack accepts navigation. It never owns save, release, reset, engine replacement, or cross-page animation.
- The root `AppearanceProvider` owns only the hydrated renderer theme/accent snapshot. `/settings` uses one complete `setAppearanceThemeMutationOptions` contract connected directly to `writeAppearanceThemeFx`, plus its natural `useSetAppearanceThemeMutation` hook. It applies immediately, persists atomically, rolls back on failure, and no-ops for the active value. There is no floating game-canvas selector, second appearance store, callback-injection adapter, or project-specific mutation-state helper.
- TanStack Query owns ordinary asynchronous UI mutation state plus the exceptional stable identity of the route-scoped Game resource. It never mirrors runtime, catalog, save, or gameplay state. Save remains a standalone mutation over `Game`; leave/reset/exit/recovery are loader-owned action pages.
- Controlled whole-application exit requests the native close handshake. Preload navigates to the appropriate exit action and sends `closeReady` only after its loader succeeds. Failure keeps the same frozen resource and route error page retryable; no hidden GameMenu exit animation participates.
- A bootstrap failure exposes destructive recovery only when `createGameFx` raises `GameSaveBootstrapError` with a verified exact save key. `GameEngineErrorPage` only links to `/action/recover-game-save`; that action loader resolves the failed exact Query error, clears only its verified save, removes the failed query, and redirects through the normal fresh `/board` bootstrap. Package validation failures expose no recovery action.

## Live bridge and tile foundation

- `bridge/arkpack` validates compressed package bytes and derives SHA-256 identity. Electron persists the original imported binary plus rebuildable descriptor metadata under `userData/arkini/arkpacks/<sha256>` through narrow preload capabilities. Imported listing reads descriptor files only; official Arkini listing reads its generated tracked metadata sidecar only. Exact package load reads one binary, fully revalidates it, and rejects official metadata/binary mismatch. Renderer `File.size` is checked before `arrayBuffer()`, while the reader keeps the compressed-byte guard for non-File callers. Product runtime always uses the mandatory Electron Arkpack capability; in-memory adapters are test-only and explicitly injected.
- `bridge/save` encodes the canonical `StateSchema` as the strict MessagePack envelope `{ namespace: "arkini", format: 1, state }`. Electron stores opaque bytes atomically under `userData/arkini/saves/<packageId>/<contentHash>` through `pending.arksave → current.arksave`; in-memory save adapters are test-only and explicitly injected. Loads always construct a fresh session.
- `bridge/runtime/useRuntimeSelector` uses `useSyncExternalStore` directly over `Game.getSnapshot` and `Game.subscribe`. It may memoize a selected value for one runtime root but never stores a second runtime or synchronizes through `useEffect`.
- `bridge/board/useBoard` projects board size, current space, live board identities/revisions, quantity, and resource URLs from that exact snapshot.
- The official Arkini package authors a `13 × 9` board (117 cells); inventory remains `7 × 7`. Geometry stays config-owned.
- Board backing cells always carry explicit config-derived grid coordinates. Never auto-place them beside explicitly positioned runtime tiles: CSS Grid reserves explicit items first and would otherwise push backing cells into implicit overflow rows. `BoardFrame` owns responsive size, border, surface, and a shadow that fits inside the board paint inset; `BoardGrid` alone owns rows/columns, gaps, padding, and content clipping.
- `ui/tile` is headless and independent from bridge/engine domains. It owns only mounted DOM nodes and one transient pointer session.
- `BoardTile` receives canonical identity + revision from the live board projection. Revision change or unmount cancels stale pointer state; replacing `Game` remounts the complete tile system.
- Appearance is a UI/platform preference, never gameplay state. `src/ui/styles.css` is the sole semantic color-token source; active UI uses semantic Tailwind utilities and no palette-specific `dark:` branches. Stored theme is `dark | light | system` and stored accent is one explicit semantic palette; absent or malformed preferences resolve to dark and rose. Electron `nativeTheme`, renderer `color-scheme`, and root accent tokens stay aligned without another resolved-theme store.
- `ui/canvas/Canvas` owns one fixed renderer viewport and one CSS size-container coordinate system. Document roots never scroll; pages consume shared container-relative spacing/control/Hero variables and fit or use intentional internal scrolling. The board fits the largest available rectangle while preserving the canonical board aspect ratio, so window size always drives every presentation surface rather than only the board.
- Electron opens centered at 75% of the current display work area. `F11` and `Alt+Enter` toggle native fullscreen, and every resize/fullscreen transition is presentation geometry only.
- Every production desktop build owns `packOfficialGameFx → buildDesktopOutputFx`, so renderer consumers never require a stale ignored Arkpack. `npm run preview:macos` cleans, builds once, stages, creates only `release/mac-arm64/Arkini.app` through `electron-builder --dir`, prints the exact path, and launches that bundle. `npm run package:mac` reuses the same one-time build stage, then creates DMG/ZIP, streams each large artifact once into `SHA256SUMS`, and verifies artifact/app structure without rehashing. Standalone `desktop verify` re-streams artifacts when validating downloads or later changes.
- `.github/workflows/macos-prerelease.yml` runs the same package command on `macos-15`. Format, type, and source-validation gates run before packaging; Dependency Cruiser and permanent tests run afterward against the generated package inputs. The official pack and renderer build therefore occur once in the delivery path without relying on stale ignored output. Manual dispatch uploads an Actions artifact; `v*-dev.*` tags additionally create an immutable GitHub prerelease. Signing/notarization remain explicitly absent.
- The repository toolchain is pinned to Node `24.18.0`, npm `11.16.0`, and `npm-run-all2` `9.0.2`; `.nvmrc`, `engines`, the lockfile, and GitHub Actions must stay aligned.
- Effect execution has one explicit root per physical process: `ElectronMainRuntime` in Electron main, `RendererRuntime` in the renderer, and the standard `NodeRuntime.runMain` boundary for the canonical Arkini CLI. `RendererRuntime` is retained through `import.meta.hot.data`, so Vite HMR cannot create a second renderer root. Each live `Game` owns exactly one child session `ManagedRuntime`; no active source may create direct `Effect.run*` islands.
- `tsx cli/arkini.ts` is the sole project-tooling entry. Game and desktop subcommands own typed options, orchestration, failure rendering, and exits. npm scripts are thin aliases; `npm-run-all2` is allowed only for mechanical checks/shards.
- Animations added later must continuously target the latest bridge snapshot. They may be interrupted/replanned and never queue authoritative state behind presentation.

## Test execution

- The permanent Vitest suite is split into ten deterministic shards for constrained agent/CI environments.
- Every shard inherits `maxWorkers: 1` from `vitest.config.ts`.
- Prefer running affected shards independently when the chained runner prints a green summary but fails to exit cleanly.
- `npm run test` remains the canonical full-suite command; sharding changes execution shape, not test semantics.
- Do not restore source-text policy suites. Stable imports belong in Dependency Cruiser, behavior and build contracts in focused tests, and project grammar in `CODE_GUIDE.md` plus review.

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
- Hard reset is route-owned complete replacement: `disposeWithoutSaveFx` → clear the exact package/content-hash save → remove the exact Query resource → redirect to `/game/$packageId/board` → create one fresh `Game` through the normal query factory.
- Never mutate a running engine back to initial state, add another reset scheduler, expose persistence keys to UI, or represent reset progress as gameplay state.

## Route-owned Game Engine lifecycle

- `GameSession` remains the authoritative runtime/save lifecycle. A failed final save freezes the same session and a later disposal retries the exact obligation; resources release only after save success.
- `GameEngineResource` is one cached `Game` plus one private lifecycle semaphore. The Query cache is an identity registry for that live route resource, not a canonical gameplay store.
- `/game/$packageId` always creates a new engine when its exact query resource does not exist. Re-running parent `beforeLoad` while navigating among `/board` and `/action/*` returns the same resource through `ensureQueryData`.
- The parent route returns `gameEngine` and `gameEngineResource` through TanStack Router context. Its loader returns the same `Game`; React consumers use the named `useGameEngine()` hook over route loader data, while child action loaders consume inherited context directly.
- Successful leave/exit removes the exact query only after final disposal succeeds. Failed disposal keeps the resource cached and frozen so retry uses the same canonical snapshot.
- HMR shutdown uses the same resource release operation. A newly created resource waits for any previous HMR shutdown promise before bootstrap so two sessions cannot overlap during module replacement.
- Global or broad Query invalidation must never be used as a game lifecycle command. Creation and removal happen only through the named game resource operations.

## Action-page transition ownership

- Every blocking lifecycle operation is a named leaf route with a loader, `pendingComponent`, and `errorComponent`. The UI presents Hero, label, and progress only; it never starts, sequences, or completes the domain action.
- `/action/load-game/$packageId` creates the engine before entering the `/game/$packageId` resource branch. This explicit action is required so both loader entry and action → Board completion receive native route transitions; a parent `pendingComponent` alone would not provide the second handoff.
- Pending pages are ordinary Hero-bearing route surfaces, never overlays. The source page is replaced through the native router View Transition, so Board/MainMenu roots are not intentionally double-mounted.
- GameMenu owns only local `closed | entering | open | exiting` state plus a short route-request lock. Settings/Main Menu/reset/exit requests navigate to their action destination; no provider-owned lifecycle, hidden close animation, or root loader remains.
- Action navigation and game links disable intent preload. Hover/focus must never create a game or execute a destructive leaf loader.

## Blocking flow focus and route exits

- Action pending and error pages are complete pages and own their own focus surface. They do not inert or aria-hide another live route beneath an overlay because no covered route is part of the intended visual tree.
- Settings, About, and Arkpacks retain one synchronous route-exit guard. Rapid Back/Escape cannot request multiple history or native transitions, and a rejected navigation unlocks the same source page.

## Startup route transition

- Startup and Main Menu are separate pages. Startup owns bootstrap, minimum timing, interruptible completion, and failure/retry; it never mounts Main Menu beneath itself.
- Startup completion navigates through the typed `startup-to-launcher` native View Transition. Backdrop, Hero shadow, and transparent Hero artwork are shared named layers whose group geometry interpolates to the compact launcher slot.
- Startup copy owns the unique `arkini-startup-content` surface and exits independently. Launcher content owns `arkini-route-content` and enters independently; neither surface morphs into the other.
- No cloned Hero, manual crossfade, hidden destination UI, CSS route entrance animation, or second `document.startViewTransition()` participates.
- The Hero artwork remains an actual transparent image rather than an opaque scene capture. Its shadow is a separate layer so compositor raster bounds cannot flash as a rectangular panel around the logo.
