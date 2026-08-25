# Arkini architecture

This document is the canonical technical architecture. It describes the implemented engine, not an aspirational rewrite.

Engine paths are relative to `src/engine` unless written explicitly. `src/bridge` is the only legal connection from React to public engine contracts and mirrors concrete domains as `bridge/<domain>/<operation>`. Reusable presentation and transient interaction code lives under `src/ui`; route-level visual composition lives under `src/page`; TanStack Router registration and route lifecycle orchestration live under `src/@routes`. Renderer dependencies form the DAG `@routes → {page, ui, bridge}`, `page → ui`, `ui → bridge`, and `bridge → engine`; routes may call public bridge Effects but never import the engine directly. `electron/main` is the physical backend process and composition root for feature-owned persistence, MCP, IPC, protocol, and public editor/engine capabilities. It never imports renderer modules or engine internals. `electron/preload` remains a transport-only adapter over `electron/contract`. Renderer bridge domains may import only that pure contract; editor and engine domains never import Electron runtime modules or the Electron package.

Enforcement is deliberately split by contract: Dependency Cruiser owns stable import boundaries; focused tests own runtime, lifecycle, security, persistence, UI, compiler, CLI, and packaging behavior; generated-output tests inspect real renderer/release artifacts; TypeScript and Zod own type/schema validity. Project grammar such as same-name `*Fx`, object + factory composition, one `IdSchema`, and semantic token usage lives in `CODE_GUIDE.md` plus review. The repository does not maintain source-text recurrence tests or a custom AST style policy system.

## 0. Electron host boundary

Electron main is Arkini's backend process and composition root, not another application or another game owner. Its boundary code owns physical capabilities and delegates product decisions to public editor and engine domains.

## Effect runtime roots

Each physical process has one explicit Effect execution root:

```text
Electron main process
→ ElectronMainRuntime

renderer process
→ RendererRuntime

project CLI process
→ NodeRuntime.runMain
```

`RendererRuntime` remains the renderer's non-React Effect execution root. React-visible Effect state has one separate renderer-process lifecycle boundary under `src/bridge/reactivity`: `RendererAtomRegistry` is the sole Atom state registry and `RendererAtomRuntime` is its zero-service Effect-backed Atom runtime. It does not duplicate process-owned service layers from `RendererRuntime`, and Atom state is deliberately not retained or handed off across HMR. Each live `PlayableGame` owns exactly one child session `ManagedRuntime` containing its engine services, Scope, Tick Fibers, subscriptions, and command runtime. Active source may re-enter these declared roots from process/bootstrap code, router loaders/actions, typed native transports, and explicitly scoped Pixi/Motion resource or callback adapters. Ordinary React feature code must consume an Atom, a named bridge capability, or local presentation state instead of inventing a Promise runner, observable store, or additional `ManagedRuntime`. Runtime behavior is protected by focused lifecycle tests; the same-named `*Fx` grammar is maintained through `CODE_GUIDE.md` and review rather than source-text policy tests.

```text
electron/contract ← src/bridge
→ the only pure cross-process transport seam

electron/main + electron/preload + electron/security
→ BrowserWindow, custom protocol, controlled close, window preferences, typed Arkpack/save filesystem capabilities

src/@routes → src/page / src/ui / src/bridge → src/engine
             src/page → src/ui → src/bridge
→ the only renderer, route lifecycle, presentation, game bridge, and engine
```

Development Electron loads the Vite HTTP origin; module replacement remains development tooling and never an application lifecycle boundary. Packaged Electron registers `arkini` as a privileged standard secure scheme and serves the same renderer from `arkini://app/*`. TanStack Router uses standard history routing in both environments: `/` owns the one-session startup splash, `/main-menu` the semantic launcher menu, `/arkpacks` the shared package selector, `/settings` the application theme control, `/about` credits, `/editor/welcome` editor project import, `/editor/$projectId/*` the integrated editor tools, `/game/$packageId` the non-visual live resource boundary, and `/game/$packageId/board` the explicit gameplay page. Electron does not interpret routes beyond static resource serving and SPA fallback.

### Renderer startup and launcher ownership

The root Atom registry owns launcher bootstrap as one Effect-backed `AsyncResult`, alongside focused writable/derived Atoms for appearance hydration, window-mode hydration, cheat readiness, Hero URL/readiness, and splash completion. `LauncherStartupHydrator` mounts that keep-alive bootstrap once under StrictMode; launcher components consume official Atom hooks directly, without a second Context, observer set, or synchronous snapshot object. Bootstrap starts immediately, while Electron main reports the actual `ready-to-show` moment through the typed preload lifecycle. The visible window stays pure black for approximately 500 ms from that renderer timestamp. Appearance and window mode publish early, but an Electron-confirmed native window event wins over a concurrent or retried persisted read. Hero readiness is explicit only after `HTMLImageElement.decode()`; the application-shell `/hero.png` is the non-failing fallback, while optional `lastPackageId` restores validated package-owned Hero bytes through the normal arkpack loader. Owned Hero object URLs live in the Hero Atom scope and are revoked exactly once on retry or registry disposal. A successful Game acquisition persists `lastPackageId` best-effort without making preference storage part of Game availability. Trusted preload readiness, one catalog refresh, and resolution of the effective default package complete the remaining hard bootstrap. Retry and idempotent splash completion are `Atom.fn` commands; application state is never handed off across module replacement.

After the visible black hold and visual readiness, the complete Hero composition fades in as one scene even when the remaining catalog bootstrap is still truthfully loading. Automatic completion requires hard bootstrap readiness and five seconds from visible-window readiness; legal Escape may continue once readiness exists without queueing an earlier request. A failed bootstrap remains on `/` with explicit retry. Completion records the one-session splash and navigates to `/main-menu` through the typed native `startup-to-main-menu` View Transition. Main Menu is not mounted beneath Startup, and no cloned Hero, manual destination crossfade, or second local View Transition participates. Later client navigation to `/` redirects to `/main-menu` without replaying the splash.

`/main-menu` asks the shared catalog for the effective default package ID and does not know whether that package came from the application or user root. `/arkpacks` reuses that same catalog owner and the existing selector; no duplicate catalog list exists. `/settings` is the only theme and native-window-mode control surface. Window mode is the first three-way segmented control and names physical states: `default` is canonical centered bounds, `bordered` is the maximized title-bar window, and `fullscreen` is Electron native fullscreen. One registry-owned tagged command Atom synchronously excludes theme, window-mode, cheat-availability, and exit commands across React remounts while its private runner composes the underlying Effect Atoms; React owns no parallel mutation refs or booleans for those commands. Each BrowserWindow has one main-process window-mode controller registered for IPC lookup. It explicitly enables fullscreen capability, owns shortcut and native enter/leave/maximize/unmaximize events, remembers the preceding windowed mode, applies default bounds after native unmaximize settles, persists only Electron-confirmed state, and publishes that state back through preload. The renderer never optimistically claims a requested mode, startup hydration never overwrites a newer native event, and an unconfirmed native transition fails with a bounded timeout instead of hanging IPC. Main-menu exit uses the same authority shape, while exact-Game Cheats and spawn commands remain subscription-scoped so leaving their owning screen interrupts them. `/about` is standalone. Preference writes are serialized before crossing the Electron transport and again by their main-process filesystem owners, so a superseded request cannot persist after its successor. Launcher and settings routes never create a `Game`; the Editor may create its separately owned ephemeral `EditorBoardGame`. `/game/$packageId` is the route-scoped resource boundary, `/game/$packageId/board` is the explicit gameplay leaf, and blocking leave/reset/recovery operations are sibling `action/*` leaves. Main-menu Exit, in-game Save and exit, title-bar close, and Ctrl+W all request the same trusted native controlled-close handshake. When that handshake observes a current or pending installed Game, the renderer replace-navigates to `/game/$packageId/action/exit`; its loader owns one best-effort final save/disposal and the shared Hero action presentation reaches a completed frame before preload sends `closeReady`. A no-game close remains direct. The game menu owns only local `closed | entering | open | exiting` presentation state rendered through Motion and does not survive navigation as a hidden lifecycle owner. Item Detail similarly keeps modal target, phase, generation, origin, and Motion settlement in one mounted presentation controller, while one provider-scoped writable Atom is the sole pending/error/execution authority for every exact command key. It admits same-key actions synchronously, permits distinct keys concurrently, and suppresses outcomes whose exact target-visit scope no longer owns the visible detail.

Native route presentation uses one explicit typed graph. Every visible pair receives `arkini-route`, a broad Hero/Board relationship, and an exact directional pair. Chromium's implicit old/new root screenshots are hidden, so only named Arkini surfaces can paint during the handoff. Launcher backdrop and complete Hero layers are shared geometry; each launcher destination owns a distinct whole-panel snapshot containing its border, background, shadow, and content. Action progress, action errors, Board, and the GameMenu backdrop/dialog each use separate identities. Unrelated surfaces exit before their destination enters and are never assigned one shared name merely to manufacture a morph. Cross-route motion remains native View Transition CSS only. Motion is the sole local animation runtime; active renderer code contains no direct Web Animations API ownership.

Tile interaction is renderer-native. One full-viewport Pixi scene owns Board plus the optional passive Toolbar row; the routed React-framed Inventory leaf owns one isolated Pixi scene. The main scene retains exactly one display actor per visible Board/Toolbar runtime identity. Inventory has its own actor registry because display objects cannot cross canvases; an explicit short-lived handoff carries only source presentation geometry keyed by the releasing actor ID. Engine placement may preserve that identity or normalize it into a stack, spawn, or replacement, and the receiving scene follows committed facts rather than assuming identity continuity. There is no cross-canvas drag or duplicate gameplay truth. Pixi owns geometry, hit testing, z-order, pointer lifecycle, display-object retention, and demand rendering. Motion is the sole interpolation runtime for distance-bounded travel, cursor pickup correction, magnetic crowd response, settlement, and entry/exit paint. Every drop preview and command uses frozen canonical source/target facts and the public atomic engine boundary; visual offsets never determine command validity or storage eligibility. The ordered semantic event stream remains independent and supplies producer, stack, swap, spawn, and replacement choreography. No ghost, screenshot, hidden canonical actor, pointer-frequency React render, direct WAAPI path, or second runtime projection exists.

The renderer is also a strict authorization boundary. One main-process trusted-renderer capability owns the registered Arkini windows and parses every candidate URL with `URL`. Development allows only the exact configured loopback Vite origin; packaged mode ignores `ELECTRON_RENDERER_URL` and allows only the `arkini://app` origin. Main-frame navigation may remain within that origin, while external navigation, redirects, every subframe, `<webview>`, popup, and unused Chromium permission are denied before content is admitted. Every privileged invoke/send channel validates the registered `webContents`, exact main-frame identity, and trusted current frame URL. `webContents.id` alone is never authorization.

The Editor ChatGPT route adds one explicitly untrusted foreign surface without widening that authorization boundary. A per-window Electron controller lazily owns one sandboxed, Node-free `WebContentsView` in the persistent `persist:arkini-chatgpt` partition. Renderer IPC may declare only its project identity and integer content bounds; Electron clamps those bounds, attaches the view only for a mounted surface, and destroys it with the window. The foreign `webContents` is never registered with the trusted-renderer capability and has no preload or Arkini IPC path. It denies permissions and non-HTTPS navigation, allows credential-free HTTPS origins required by federated login, and funnels popup targets into the same view instead of creating a second window. Every page load detaches the native surface so Arkini can present loading feedback; only a completed allowed page is reattached. Leaving the section preserves the live conversation and login session, while returning from an external or still-pending navigation loads `https://chatgpt.com` before showing the view. A visible view may stage only one bounded PNG download into a random temporary path, which is removed after exactly one candidate notification. Candidate confirmation is an editor-local unsaved session; canonical PNG validation and a dedicated revision-pinned single-resource SQLite transaction enforce insert-versus-explicit-replace policy independently of UI state.

Packaged protocol responses set the production Content Security Policy. Development parses one canonical credential-free loopback HTTP URL, derives both the trusted renderer origin and exact Vite HMR WebSocket endpoint from it, and uses one random per-server CSP nonce for Vite's React Refresh preamble. The nonce and WebSocket allowance never enter packaged output. The policy permits same-origin code/styles plus the blob/data resource forms used by Arkini, and denies objects, frames, embedding, and forms. Window destruction removes trusted-window state and window listeners; process shutdown removes global IPC handlers.

- The renderer entry declares `<base href="/">`, so generated relative assets resolve from the `arkini://app/` origin root even when the current history route is nested.

`./Argcfile.sh build` compiles Electron/Vite first and then invokes that exact built product CLI to pack and sign the official game once. Compilation therefore has no import or existence dependency on generated `.arkpack` or signature files. Packing writes ignored artifacts under `game/`; `electron-builder` maps `.out/desktop/build` directly into the application ASAR and copies only the official package plus detached signature into `Resources/game`. Development reads the repository `game/` root directly. Disposable repository output is partitioned into `.out/desktop/build`, `.out/desktop/release`, and `.out/cache`; there is no staging tree or second packaging implementation. `preview-macos` performs clean → build → unpacked Electron Builder output → launch, while `package-macos` performs clean → build → one Electron Builder DMG/ZIP operation → checksums → packaged-CLI smoke test. GitHub Actions installs the pinned mise toolchain and calls the same `ci-macos` recipe, which wraps packaging with the repository gates. The clean-checkout delivery test exercises the real package path and asserts the generated official package, renderer output, packaged resources, bounded ASAR, working CLI launcher, and unchanged source checkout.

Main/preload do not own game state, package semantics, save codec semantics, or Tick. Renderer domains do not import Electron or Node platform APIs. The shared `electron/contract/ArkiniElectronApi.ts` contract exposes only concrete Arkpack bytes and optional detached signatures, contained editor-project records and directory-open commands, opaque save bytes, theme/accent/window preferences, confirmed window-mode events, and controlled-close signals. Physical paths are derived exclusively in Electron main; the renderer cannot request arbitrary filesystem access.

## 1. Core model

Arkini has three distinct data forms:

```text
GameConfig
→ validated static game definitions

Runtime
→ hydrated live gameplay snapshot

State
→ serializable gameplay state
```

`Runtime` contains live items, active jobs, and FIFO job requests. A committed runtime value is treated as an immutable snapshot by convention. The store is mutable; committed runtime graphs are not mutated in place.

The engine does not maintain a second read model, React copy, runtime cache, or event-derived reconstruction of gameplay state.

## 2. Canonical committed transition

Every accepted gameplay mutation produces one transition:

```text
CommittedTransition {
  runtime,
  events
}
```

The runtime and its transient events describe the same accepted mutation and commit together.

A mutation that fails validation, is interrupted during planning, or produces neither a changed runtime nor events publishes nothing.

## 3. Runtime write boundary

All production writes enter through `modifyRuntimeFx`.

```text
public command or Tick
→ acquire mutation-planning ownership
→ read latest committed transition
→ run effectful planning against one pinned runtime snapshot
→ validate complete candidate runtime
→ commit accepted transition
```

Nested runtime reads during planning receive the pinned transaction snapshot. A planner may not read a newer runtime halfway through and may not export a detached state-derived plan across the write boundary.

### 3.1 One synchronization owner

One `SubscriptionRef<CommittedTransition>` owns mutation serialization, the current transition, and replaying publication. There is no outer semaphore, second current-value cell, second PubSub, or listener queue.

`SubscriptionRef.modifySomeEffect` acquires the sole mutation ownership before reading the current transition. Waiting for ownership and the effectful candidate planner remain interruptible, so failure, defect, or interruption releases ownership without changing or publishing state.

The planner completes the serialized operation with one of two explicit outcomes:

```text
Option.none
→ return the command result
→ keep the identical transition
→ publish nothing

Option.some(nextTransition)
→ store that exact transition
→ publish it exactly once
→ return the command result
```

`SubscriptionRef.changes` is the gap-free subscription primitive. Each scoped consumer receives the transition current at its subscription linearization and every later committed transition exactly once and in order. Runtime listeners drop the initial replay and notify only for changed runtime identity, transition listeners keep the replay, and transient event listeners drop the initial replay so stale events are never redelivered.

## 4. Live game bridge boundary

`GameSession` owns the Effect services, Tick, subscriptions, canonical runtime, and save lifecycle of one loaded engine. The bridge-level `Game` adds completed config and embedded resource URLs. Neither object mirrors runtime state, and React never owns the engine lifecycle.

The live boundary exposes:

- `getSnapshot()` — synchronous read of the canonical runtime;
- `run(effect)` — execution of documented public engine Effects;
- `subscribe(listener)` — runtime invalidation subscription;
- `subscribeEvents(listener)` — transient event batches for presentation;
- `flushSaveFx` — explicit persistence flush Effect;
- `disposeFx` — coordinated shutdown Effect with a retryable final save. A failed flush freezes the session and retains the same canonical runtime for another disposal attempt; resources are released only after the save succeeds;
- `disposeWithoutSaveFx` — explicit destructive disposal Effect used by hard reset or a bootstrap that must be abandoned without writing a final snapshot.

`GameSession` lifecycle operations are reusable Effect values rather than Promise-producing methods. One Effect-owned lifecycle state and one `Deferred` represent the active disposal attempt: concurrent fibers await that exact attempt, failure returns the session to a frozen retryable state, and a later disposal starts a new attempt. Promise exists only at explicit `ManagedRuntime`/process execution boundaries and is never cached as lifecycle state.

`GameSession.run()` remains generic by deliberate soft contract. Bridge domains may run public commands and reads only. UI never imports the engine directly and may not reach runtime-store services through the generic runner.

### 4.1 Route-owned installed Game resource

`/game/$packageId` is a non-visual TanStack Router resource boundary over the renderer-wide Game Engine authority. Creation belongs to the explicit load action; the game branch accepts only the adopted resource for its exact package:

```text
/action/load-game/$packageId loader
→ RendererRuntime runs acquireGameEngineLeaseFx(packageId) in one Scope
→ GameEngineResourceFx registers pending ownership immediately
→ delay CPU-heavy bootstrap until the entering View Transition settles
→ hold the provisional lease for the complete action presentation
→ adopt that exact lease before its Scope closes

/game/$packageId beforeLoad
→ read GameEngineResourceFx.currentFx through the same RendererRuntime
→ require resource.game.arkpack.packageId === route packageId
→ return { gameEngine, gameEngineResource } through route context

/game/$packageId/board
→ render GameShell and Board

/game/$packageId/action/*
→ run lifecycle Effects against inherited gameEngineResource
```

`GameEngineResourceFx` is one scoped Effect service in `RendererRuntime` and the only renderer-wide installed-Game lifecycle authority. Its explicit state machine owns acquisition, provisional consumers, adoption, active identity, cancellation, release/reset finalization, bootstrap failure, exact failed-save recovery, fail-stop ownership failure, and service shutdown. One service semaphore linearizes state changes, while service-owned Fibers let cleanup complete even when a route caller is interrupted. Canonical gameplay state, subscriptions, persistence, and commands remain inside `GameSession`. The package route verifies its exact inherited resource and publishes it through a non-owning `GameEngineProvider`; shared gameplay components call `useGameEngine()` against that provider and never create or mirror gameplay state.

Same-package consumers join one acquisition and receive opaque leases for the exact result. Closing the last unadopted lease cancels or disposes the provisional Game. A different package first finalizes the active Game, then starts a new acquisition; it can never receive the wrong package resource. Ordinary bootstrap failures remain sticky until exact discard, and verified `GameSaveBootstrapError` failures remain sticky until service-owned recovery clears only their exact save key. A defect or composite Cause is never downgraded into a recoverable save failure.

`GameEngineResource` contains one `Game` and one private first-critical-failure guard. The enclosing service is the sole lifecycle lock owner and serializes every destructive operation for that exact resource:

```text
leave / exit
→ Game.disposeFx
→ transition to Idle only after success and exact identity match

reset
→ Game.disposeWithoutSaveFx
→ clear exact packageId + contentHash save
→ transition to Idle only after both steps succeed
→ redirect to /game/$packageId/board
→ the load action acquires one fresh Game
```

A failed ordinary leave or hard reset leaves the exact resource owned by the service but marks it permanently unusable for the current renderer. The original canonical critical failure is preserved for every waiter, the root fatal boundary replaces the application UI, and every later game-route publication check throws that same error. No Board remount, package switch, retry action, or in-process recovery is allowed. The lower-level `GameSession` disposal remains idempotent and may retain a frozen save obligation for controlled-close policy, but renderer ownership is fail-stop.

The pathless launcher boundary reads the active resource through `RendererRuntime` and redirects launcher navigation through `/game/$packageId/action/leave`. A request for another package first routes through the current package's leave action, then enters the destination `/board`. React cleanup, provider unmount, and component effects are never desired-game signals.

Controlled Electron close with an active Game is a terminal route transition. The renderer atomically claims a pending or adopted resource through the same service and replace-navigates to `/game/$packageId/action/exit`; that route joins any terminal finalization already running for the exact resource or owns one best-effort `disposeFx` attempt, logs a failed final save, and completes the shared Hero action presentation at 100%. Preload waits for that completed frame to paint and hold briefly before sending `closeReady`. Without a Game, the same trusted handshake acknowledges directly and never constructs a game route. No retry page, second save loop, or fatal-screen detour participates. Arkini does not coordinate Game shutdown, state preservation, or ownership handoff across HMR; development module replacement may restart application state. Explicit native force close remains process policy and never claims renderer cleanup or save success.

Action routes own their operation in leaf loaders. `pendingComponent` and `errorComponent` are complete Hero pages and contain no domain orchestration. They are ordinary native View Transition destinations, not overlays over a still-mounted Board or launcher root.

Bootstrap save recovery is necessarily top-level because the failing `/game/$packageId` resource boundary cannot load a child action. `GameEngineErrorPage` only links to `/action/recover-game-save` with the public package identity. The action loader asks the service to resolve the exact sticky bootstrap Cause, requires an uncontaminated `GameSaveBootstrapError`, clears its verified private save key, returns the service to Idle only after success, and redirects to the main menu. Package validation failures, defects, composite Causes, and unrelated errors cannot invoke save deletion.

### 4.2 Desktop persistence

Electron `userData` has one Arkini root for native game persistence:

```text
<userData>/arkini/
	game/
		arkpacks/
			<encoded-packageId>.game.arkpack
			<encoded-packageId>.game.arkpack.sig
    saves/<packageId>/<contentHash>/
      current.arksave
      pending.arksave
    preferences/
      appearance.theme
      appearance.pending
      appearance.accent
      appearance-accent.pending
    logs/
```

The original validated Arkpack binary is canonical. Format v2 carries `packageId` inside the signed bytes, independently from the authored `gameId`; SHA-256 remains the derived `contentHash` used by save identity. Electron scans two flat well-known roots using `<encoded-packageId>.game.arkpack` plus an optional `.sig`: repository `game/` in development or packaged `Resources/game`, and writable `<userData>/arkini/game/arkpacks`. Electron transports bounded raw candidates from both roots; the renderer validates user candidates first and falls back to bundled only when the user file cannot form a valid package. A structurally valid user package legally replaces a bundled package with the same ID even when its detached signature is invalid, in which case it remains visible and removable but cannot start. Exact list and load operations share this candidate selection, revalidate filename identity against the embedded identity, verify trust over the exact bytes, decode the config/resources, and run semantic validation. Install atomically replaces only the user file, removal touches only the user root and therefore reveals a bundled fallback, and package removal never removes saves.

The editor is another renderer surface around the same engine/compiler contracts, not a parallel application. Its sole canonical project authority is one process-lifetime Effect repository in the Electron main process backed by SQLite at `<userData>/arkini/editor/projects.sqlite`. SQLite stores validated project configuration, monotonic repository revision/timestamps, and project-scoped binary resources; one repository read materializes those rows into one validated authoring aggregate. Project notes are separate project-scoped SQLite rows: they do not change the authoring revision, survive version checkout, and never enter Versions, JSON source export, Build, or Arkpack output. The renderer reaches that owner only through the narrow validated editor IPC repository. React Context, Atoms, route loader data, object URLs, and form values are projections or local drafts; none is a second writable project truth. SQLite and `node:sqlite` remain confined to the main-process repository boundary and never enter engine, route, page, or ordinary UI modules.

Editor welcome has two explicit import boundaries. Arkpack import validates compressed bytes through the normal size, trust, decode, schema, semantic, and resource boundaries. JSON import asks Electron for one authoring directory, reads it without modifying the source workspace, runs the canonical completed-game compiler and resource validation, and materializes every PNG resource. Both flows derive the project identity from their validated input and commit the configuration plus every resource in one SQLite transaction. A duplicate project identity is rejected rather than silently replacing an existing project. Repository writes are serialized at the main-process owner; full-config and resource-replacement writes use the exact expected project revision, while bounded item upserts either merge against transaction-current configuration or opt into the same exact-revision guard. SQLite schema upgrades are explicit `PRAGMA user_version` transitions. Existing renderer-origin IndexedDB editor projects are deliberately not migrated by this storage cutover, and an editor database-open failure disables the Editor surface without turning gameplay startup or global Settings into a persistence fallback.

Item routes use immutable item UID leaves: `items/list`, explicit `items/$itemUid/detail/$sectionId` read-only leaves, and one `items/$itemUid/form/$sectionId` authoring flow for both new and persisted items; the legacy `view` entry only redirects into the current detail grammar. One canonical item-section taxonomy owns Identity, Artwork, Charges, Merges, Estimate, and type-owned Production. Flow has one global authored-graph surface rather than a second item-local subgraph model; item detail links open that graph focused on the item in either input or output direction. The form parent owns exactly one local TanStack Form session above its section outlet, so routed form leaves share values, dirty state, touched fields, and validation, while routed detail leaves read the canonical loaded item without creating another draft. Form Save validates the complete item schema and atomically upserts it into the canonical SQLite project by immutable UID; human-readable item IDs remain read-only after the first successful Save pending an explicit rename workflow. Project authoring likewise owns one local form session across General, Appearance, and Surfaces and one explicit form-native Project Save that atomically updates the canonical SQLite configuration. Asset import accepts validated PNG files or the resources from a canonically validated arkpack, then atomically upserts them into the project and replaces matching resource IDs without adopting the source config. There is no global staged project overlay, editor-wide Save-all operation, filesystem source-tree revision, source-file provenance index, or editor mutation-lane mirror.

MCP item authoring exposes one discoverable `create_<type>_item` and `edit_<type>_item` tool for every canonical item discriminator. Create inputs omit the immutable UID and discriminator and apply the same canonical draft defaults as the corresponding new-item UI form. Edit inputs preserve ID, UID, and type; supplied top-level fields replace their complete values, omitted fields remain untouched, and `null` clears only optional canonical fields. The bounded `item_config` tool returns one complete canonical item with its project `revision`, so an agent can preserve unchanged nested values and optionally copy that revision into an edit request. `project_config` does the same for complete non-item `meta`, `resources`, and `start` sections; `edit_project` replaces only supplied whole sections and preserves the immutable game ID. All other MCP results remain readable plain text. Project validation, reference-safe item rename, delete-impact preview, and revision-pinned safe or forced deletion reuse the completed-game validators and canonical repository transaction boundary. A supplied stale revision rejects a mutation; an omitted revision on non-destructive patch tools edits the current snapshot, while the repository still guards the read-to-commit interval. Every item edit validates the resulting whole item. Create and edit reach the same canonical schema and repository boundary as UI Save. A successful main-process mutation emits a narrow project-ID notification; the mounted renderer rereads that canonical project, publishes the newer snapshot, and synchronizes Editor Board. Notification is best-effort after commit and cannot turn an already-persisted mutation into a failed MCP acknowledgement.

The global MCP workspace owns explicit transport lifecycle rather than starting a server merely because an editor route mounted. Local MCP and Remote MCP independently enable one lazy loopback HTTP listener: `/editor/mcp` accepts only loopback host/origin traffic while `/remote/mcp` requires a bearer token issued by the colocated OAuth 2.1 routes. Remote start publishes that same listener through the embedded ngrok transport, verifies public OAuth metadata and the bearer challenge before reporting ready, and reuses the first discovered account domain. OAuth clients, codes, tokens, and the scrypt-hashed generated CUID2 password live in a dedicated SQLite database. An ordinary stop or tunnel failure preserves this authority; explicit Reset auth is the only UI operation that replaces it and clears the discovered domain.

One process-owned unsaved-changes guard coordinates the currently mounted Project, Item, and Asset form sessions without turning their local drafts into canonical state. Navigation inside a session's own form route remains uninterrupted. Leaving that route, Editor Exit, and native close share one decision: a valid dirty draft offers Save, Discard, or Cancel, while an invalid draft offers only Discard or Cancel. Save is persistence-only; after the user permits departure, Exit and native close still join already-admitted repository/catalog writes before leaving. SQLite remains the sole canonical project authority, with no global staged project overlay, autosave, editor-wide Save-all operation, or second pending/persistence truth. React-visible asynchronous editor commands execute through feature-owned `Atom.fn` commands or the narrowly allowed domain-specific writable command authority when synchronous sibling exclusion must survive remounts, while standalone renderer Effects use the one process `RendererRuntime`. Repository transactions remain the write-serialization and atomicity boundary; React does not add a private Promise scheduler, query cache, or copied project store.

Build is the explicit heavy validation and publication boundary. It captures one exact project revision, runs the canonical completed-config and resource validators, encodes and compresses one immutable Arkpack artifact, and records the source revision with its bytes and content hash. A failed build publishes diagnostics and no artifact. A successful artifact independently supports browser-style Save As and installation through the existing Arkpack catalog. Any later project mutation makes the previous artifact stale and requires another Build before distribution. The separate source export awaits repository idle, reads the current saved project, and writes `schema.json`, `game.json`, item-type directories, shell `resources`, and item `assets` directly into the selected root. That root can be passed straight back to JSON import. The selected export root is wholly Editor-managed: renderer copy and a native confirmation both state that every existing file and subfolder will be replaced. Electron resolves symlinks, rejects any target overlapping the source checkout, application resources, or Arkini user data, preflights case- and normalization-insensitive output collisions, stages the complete tree beside the target, and swaps it into place only after every source and resource write succeeds. Main-process export ownership is included in Editor idle, so controlled close joins an admitted swap before Electron exits.

The Editor Board is a real gameplay surface over a revision-pinned `EditorBoardGame`, not a static preview or a second runtime model. `EditorBoardGameResource` is a scoped process owner beside the installed-package authority. The project route starts it from the canonical completed config and immutable revision-local resource URLs without `arkpack`, `saveKey`, or autosave capability. Repository publication and explicit scenario restore synchronize replacements through one lifecycle semaphore: the old session must finish `disposeWithoutSaveFx` before a replacement can be created or published, and a failed disposal remains visible. Leaving the project releases the exact editor game. React only projects the owner's `SubscriptionRef` and injects its exact `GameEngine` into the same routed Board, Toolbar, Inventory, Item Detail, audio, cheat spotlight, and Pixi composition used by installed gameplay; the package-only Game Menu is intentionally absent. Editor sessions enable the canonical Cheat mode, and the Board admits `Cmd+P` independently of the player preference.

Named Board scenarios are project-owned SQLite rows separate from the live editor session and Arkpack output. Only the explicit Save button snapshots the canonical runtime through `fromRuntimeFx`; selection strictly decodes and hydrates that `StateSchema` before serially replacing the session. The repository stores opaque MessagePack bytes with their project revision and Arkpack version, while a stale revision cannot write. Same-major, non-newer-minor scenarios remain loadable. Invalid decode, writer provenance, version, or hydration deletes only that proven-invalid scenario and starts fresh; repository, IPC, session, or resource failures preserve it. Every major project configuration commit deletes all of that project's scenarios in the same SQLite transaction; minor commits preserve them. There is no scenario autosave, migration, or best-effort replay.

Editor item estimates are derived static analysis over one immutable acquisition graph compiled from the authored game definition. The graph records canonical starting quantities, complete alternative acquisition routes, AND requirements, output quantity distributions, requirement usage, and stable authored route identities. It does not bootstrap an Engine, Tick runtime, gameplay transition, or simulated player. The canonical game definition remains the only source of truth; an estimate is disposable analysis data.

For every requested item quantity, the estimator evaluates each complete route recursively to authored roots. Its duration is the deterministic optimistic critical path: a selected operation starts after its slowest hard dependency, so independent sibling branches overlap without modeling concrete workers, producer instances, line capacity, or scheduling. Route selection uses the same own-duration-plus-slowest-dependency metric with canonical nested choices and stable route identity; it never searches combinations of sibling choices or runtime schedules. Co-products are shared when those canonical choices select the same authored operation, but discovering a cheaper cross-sibling co-product combination is deliberately outside this bounded analysis. Consumables retain authored quantities and batch scaling, while owners, infrastructure, merge identities, and other hard reusable prerequisites are acquired once. A deposit input is likewise a one-time dependency: it must be an authored root or have a structurally complete acquisition route, its acquisition time is paid once, and charge lifetime does not scale its use. Authored starting quantities remain finite credits for ordinary consumables. Cyclic or unreachable hard dependencies produce path diagnostics without poisoning a valid alternative route.

The editor worker, UI, and MCP projection consume only the immutable estimate result. The renderer keeps at most one process-lifetime in-memory batch for the current project revision; a newer authored snapshot interrupts and replaces it. This batch is disposable derived data, never canonical editor-project persistence. The global UI data source and MCP `estimate` tool share one fuzzy query, optional incomplete-only filter, and `fastest`, `slowest`, and `demand` selection contract; React only renders the selected row order, while `item_estimate` remains the detailed single-item route projection. Presentation explains the selected normalized route DAG, optimistic parallel critical-path duration, aggregate consumed/one-time/ongoing demand, and explicit ignored runtime mechanics, but it must not claim an engine-valid witness or exact player wall-clock time. Every selected fact occurs once in the result and shared prerequisites use stable fact references, so UI and MCP output stay linear in the selected graph; the flat item breakdown may additionally show the direct selected facts that require each row. Bounded diagnostics from rejected alternatives remain available even when another route succeeds. Authored random output occurrences retain expected-run economics, including correlated co-products. Positive enable-rule facts participate as hard acquisition prerequisites and contribute their acquisition time, while rule truth, disable conditions, conditional runtime effects, scope and placement, charges, depletion capacity, renewal, and finite runtime resource capacity are not simulated. A real charge-depletion output remains an acquisition route: it pays the payer's acquisition and the authored repeated line work that produces the output, without recursively modeling later payer renewal.

The engine's existing `StateSchema` is the complete canonical save state; creating a separate alias schema would add a second name without a second contract. `fromRuntimeFx` produces a detached state, and session construction hydrates a fresh runtime from validated state. The save codec wraps that state in exactly:

```text
{ namespace: "arkini", version, game, state }
```

Electron stores the resulting MessagePack bytes opaquely. Writes sync `pending.arksave` and atomically rename it over `current.arksave`; failed replacement preserves the previous successful save. Package identity selects the repository path and is intentionally absent from engine state and the envelope, while the envelope version decides whether that package's save can resume or must be cleared.

Theme and accent preference writes use the same pending-file atomic replacement grammar; missing or malformed committed data resolves to dark and rose. Product runtime always uses the Electron filesystem capabilities exposed by preload. Process-local in-memory adapters exist only as explicit test doubles under `test/support`; runtime never selects them automatically.

Persistence is Effect-native on both sides of the IPC transport:

```text
renderer domain Effect
→ ArkpackStorage / GameSaveStorage / appearance Effect capability
→ one typed preload Promise invocation
→ trusted Electron IPC handler
→ one ElectronMainRuntime execution
→ Effect-native filesystem capability
```

Promise exists only as the Electron IPC transport contract. Main-process package/save logic consumes the `FileSystem` and `Path` capabilities from `effect`, provided once by `@effect/platform-node`; renderer domain operations consume Effects directly. Arkini-owned persistence uses object + factory composition, has no repository/storage classes, and exposes no no-op `close()` lifecycle.

## 5. Runtime and event subscriptions

Each external listener owns its own scoped current-plus-tail subscription.

Runtime listeners use the captured current runtime as an identity baseline and are notified only when a later transition changes the runtime root.

Event listeners consume only later event batches. Historical transient events are never replayed to a listener registered after their commit.

Callback delivery is best effort and may lag canonical runtime. Callback throws and rejected Promise-like results are isolated and cannot kill Tick, autosave, or other listeners.

## 6. UI and presentation time

The engine is framework-neutral and authoritative. React is an adapter.

```text
canonical runtime
→ immediate gameplay truth

live bridge projection
→ synchronous view over that exact snapshot, never cached authority

committed transient events
→ facts about accepted mutations

UI animation state
→ intentionally delayed presentation
```

Animations may lag, change direction, collapse, or skip intermediate presentation. Runtime never waits for them.

UI may own:

- local panel, hover, camera, selection, and animation state;
- coordinate-to-pixel or coordinate-to-3D transforms;
- labels, icons, grouping, sorting, and interpolation;
- presentation queues derived from transient events.

UI appearance uses one semantic color-token source in `src/ui/styles.css`. Active components consume meaning-based utilities such as canvas, surface, foreground, accent, status, and overlay colors rather than palette-specific Tailwind classes or repeated `dark:` branches. Theme is `dark | light | system`; accent is one explicit semantic palette. `/settings` is the sole theme-control surface; the former floating canvas selector is removed. Its complete mutation applies the renderer value immediately, persists through the existing appearance Effect/IPC capability, rolls back on failure, and no-ops for the active value. Missing or malformed durable data defaults to dark and rose, while `system` is respected only after explicit user selection and continues to follow Electron `nativeTheme` updates. Electron persists theme and accent atomically; CSS `color-scheme`, `light-dark()`, and root accent tokens resolve the renderer palette without a second resolved-theme store. Appearance remains outside engine runtime and gameplay saves.

UI may not own or reconstruct:

- line start eligibility;
- missing inputs;
- reservation truth;
- queue capacity or FIFO policy;
- effect/rule availability;
- accepted drop behavior;
- job lifecycle state;
- any second runtime snapshot.

## 7. Tick and time

Effect Clock is the only production wall-clock source.

The Tick adapter owns transient observation state:

```text
observedAtMs
pendingElapsedMs
```

`pendingElapsedMs` is simulation time, not raw wall time. Neither Tick observation field is persisted.

Simulation uses one canonical 100 ms fixed step.

```text
observe new wall-clock delta
→ add elapsed milliseconds to pending budget
→ replay all complete fixed steps
→ keep sub-step remainder for the live session
```

Instant gameplay is a persisted cheat switch in `runtime.cheats`, not a Tick multiplier or session timing mode. While cheat behavior and Instant gameplay are enabled, the authoritative engine completes valid time-based jobs and temporary-item lifetimes without waiting for their authored wall-clock durations. Explicit and observed Tick advancement still use the same unscaled simulation milliseconds.

Every attempted complete-step budget is acknowledged exactly once. A failed advancement propagates its Cause but still consumes the attempted budget; it is never replayed implicitly on the next observation.

Long elapsed intervals are replayed immediately as consecutive fixed steps and must match the equivalent sequence of explicit 100 ms advancements.

One event-free step returning the identical runtime reference proves a stable no-op boundary; the remaining identical backlog may be skipped.

Temporary board items own `remainingDurationMs`, initialized from their authored `durationMs` when the concrete runtime identity is committed. Each identity observed at a step boundary loses exactly one 100 ms step, clamped at zero. An item created by a completion during that step is not in the boundary snapshot and receives no retroactive time.

Ready temporary items expire after job completions in stable runtime-ID order. Expiry removes the item first, then resolves and places its optional output from the released board origin through the canonical deterministic output and placement pipeline. Expected placement failure leaves the same item at `remainingDurationMs: 0` for a later retry; the complete random stream, including random placement origin, is derived from the stable temporary identity. Temporary items are board-only, always identity-bound, and therefore impure.

## 8. Jobs and FIFO requests

An owner may have:

- zero or one active job;
- FIFO queued start requests up to its configured capacity.

A queued request is not a job. It owns no time, consumes nothing, and reserves nothing. Enqueue is
the sole player-facing line execution command and records only explicit player intent; it never fills
an input or starts work in the command transaction. Missing concrete material is therefore queueable.
Pending requests remain editable intent: one explicit owner command may clear the whole pending
queue without touching an active job, materials, charges, or outputs.

Queue playback uses one concrete Autofill selection, physical delivery, input-store, and hard
job-start pipeline for Producer, Craft, Blueprint, and every other line owner. It is opportunistic:
only an idle owner's FIFO head is eligible. Each Tick may admit currently useful concrete material
into delivery, including partial coverage, while retaining the exact queue request. Later Ticks retry
the same head; only settled Input material can produce a job. Actual upstream output becomes ordinary
concrete supply after commit; queued work never reasons about hypothetical future output. A blocked
FIFO head remains first and cannot be overtaken. It waits for fresh runtime facts to make it runnable
or for the player to clear that owner's pending queue; the engine never drops it automatically.

Delivery travel is canonical engine state, not renderer lifecycle. Every delivery persists a fixed-step
`remainingDurationMs`; Tick decrements it independently of route, current Board space, mounted canvas,
or available Pixi geometry and commits the due generation through the same immutable settlement
transition used by the public serialized command wrapper. Presentation may animate the projected
countdown and endpoints, but Motion contact can never admit input, return material, or gate production.
Legacy persisted deliveries without a countdown normalize as immediately due and settle on a later Tick.

The persisted `jobQueue` array is also the canonical cross-owner priority. One bounded Tick settle
walks eligible owner heads in that exact array order, reusing the runtime produced by every accepted
delivery admission or start before considering the next head. No owner-ID sort, wall clock, renderer
order, planned claim, or second scheduler participates.

Jobs persist only:

```text
durationMs
remainingMs
```

Do not add due times, start timestamps, pause timestamps, persisted Tick cursors, or wall-clock reconstruction metadata.

Inventory and Toolbar are hard pauses for active and ready jobs. Returning the same owner to the board resumes evaluation without a separate resume mutation.

Inventory and Toolbar are passive storage. Commands may move an already stateful owner into either surface, but no command may attach new identity-bound state to an owner while it is stored there.

Started jobs cannot be cancelled. Pending queue requests may be cleared only as the whole current queue of one owner; no command targets a previously observed request shape.

## 9. Inputs and reservations

Material inputs may be consumed or reserved. A material selector names its complete accepted candidate set; every matched item must be eligible to enter input storage. Temporary identities are board-bound and are rejected by both semantic validation and the authoritative store planner.

- both modes commit the accepted quantity only when work actually starts;
- `consume` discards the material's complete passive owned subtree at start, moves the surviving root into consumed `job` scope, and discards that root at completion;
- `reserve` moves the same live instance into `reserved` scope, preserving its identity, runtime state, and passive owned subtree until completion relocates it;
- a zero-capacity material input is closed while its line owns an active job;
- a positive-capacity material input remains open as storage while the line runs.

Input closure is resolved from the same live runtime draft as the delivery command. A queued request does not close an input because it is not an active job. Consumed and reserved items are exclusive job-owned locks and are inaccessible to generic item mutations.

Storing the first input on a stacked owner is a general state-attachment transition. The input transfer is applied inside one candidate first, so a fully consumed source may free board capacity, then the original owner identity is isolated at quantity `1` and the pure remainder follows standard placement. A blocked remainder rolls back the input transfer, split, and every generated event together.

Charge costs are authored on individual inputs. `from: "self"` charges the line owner; `from: "target"` charges the deterministic board item resolved by a deposit input. Resolution reserves charge budget by runtime item ID across the whole line so several inputs cannot independently overbook the same payer. Apply aggregates every cost for one payer and spends it exactly once inside the same candidate runtime.

A fresh charged item keeps no redundant live counter: missing `remainingCharges` means the authored full amount and remains pure. A partial spend stores `remainingCharges`, makes the item stateful, isolates the original board identity at quantity `1`, and standard-places the pure remainder. Fully depleting one idle quantity consumes that quantity in place instead of relocating the rest of its stack. Idle payers that die are resolved before surviving payers that need isolation, allowing one atomic start to use board capacity it frees itself.

A charged item dies when its remaining charges reach zero. An idle external payer is removed immediately during the starting command and emits its optional charge output from its own board origin. A self payer or any payer that already owns an active job may remain temporarily at `remainingCharges: 0`; that active job is the only legal deferred-depletion state.

Completion resolves shared live facts once, removes the ready job and consumed material roots from one immutable draft, keeps reserved instances live, and executes one generic line lifecycle:

```text
discard consumed material roots
→ remove a depleted owner identity and queue
→ resolve optional line.output deterministically
→ resolve optional depleted-owner charges.output deterministically
→ release depleted-owner buffered inputs
→ relocate the same live reserved instances
```

A non-depleted owner remains with its identity, inputs, and queue. A depleted owner is removed before output placement, so ordinary line output receives first access to its freed board origin and depletion output follows. Producer, craft, blueprint, and stash keep separate item schemas, but completion never switches on item type. Item lifetime is controlled only by optional charges and authored input costs.

Starting any stacked line owner resolves eligibility from the pre-command snapshot, then creates the job, applies material plans, and pays all charge plans inside one candidate draft. Charge spending or the active job makes a surviving owner non-pure before isolation, so the pure remainder cannot merge back into it. Public item removal and completion share identity-removal primitives rather than nesting public write commands.

Start and completion are all-or-nothing. Insufficient charges, max-count blockage, depletion-output placement failure, remainder placement failure, or material return blockage publishes no partial runtime or transient events.

Reserved materials retain their runtime identity and state but no original stack, slot, or source position. Completion places each existing instance from the current board position of the line owner. Pure instances may normalize into ordinary stack placement and new identities; impure instances preserve their exact identity and require one exclusive grid cell. Consumed materials return nothing and never trigger charge depletion output merely because they were converted. Never add return-location metadata.

Hydration requires every consumed `job` root to own no remaining input subtree, active work, committed job material, or queued intent. Destructive passive-state cleanup fails rather than cancelling active jobs or deleting committed job material.

## 10. Future output and max-count reservations

An active job reserves the worst-case future quantity of every canonical item its completion may create. This includes its `line.output` and, when its owner has already reached zero charges, the owner's deferred `charges.output`. The calculation is deliberately conservative:

- fixed quantities reserve their value;
- ranges reserve `max`;
- chance rolls reserve the successful outcome;
- repeated weighted rolls reserve the same worst candidate for every selection;
- rolls inside one selected set add together;
- alternative roll sets reserve the per-item maximum.

A queued request owns no reservation. The same authoritative check runs when its FIFO head attempts dispatch; unavailable charges or max-count blockage leaves the request in place until fresh state makes it runnable or the player explicitly clears the owner's pending queue.

Placement, direct spawn, and direct quantity mutation include active-job reservations in their max-count check, so later operations cannot consume capacity already promised to a job. Completion first detaches its ready job from the immutable candidate and then materializes output, which spends that job's reservation without double-counting it. A depleted owner offsets worst-case output of its own canonical item by the live quantity that will disappear.

Immediate depletion output from an idle external payer is created during the start candidate rather than reserved afterward. After all charge spends, the final start max-count assertion validates those live immediate outputs together with every active job reservation, including the candidate job. Any overbooking rejects the complete candidate atomically.

## 11. Deterministic randomness

Line-completion randomness derives from stable job identity and an explicit algorithm version. Deferred depletion output derives from the same job plus the depleted item identity.

Immediate depletion during start derives from stable owner, line, payer, quantity, pre-spend charges, cost, and an explicit algorithm version. An unchanged failed retry therefore resolves the same output and placement order; a successful spend changes the payer state before any later use.

Roll-set selection, chance, weights, quantity ranges, and random placement ordering all use the owned deterministic stream. Tick state and wall-clock time never participate in the seed.

## 12. Purity and placement

Purity is a runtime-derived boolean, not an item-config flag. A line is pure only when it owns no buffered inputs, active job, or queued request. An item is pure only when every line it owns is pure and it owns no additional identity-bound state. Explicit `remainingCharges` is item-owned state; an untouched charged item with no stored counter remains pure at its authored full amount.

Generic stack and quantity mutations may target only pure items. A pure item uses its configured stack size; an impure item has an effective stack size of `1`. Purity is resolved inside the same immutable runtime draft as the mutation and is checked both while planning stack placement and again while applying the plan. Never cache or carry a purity result across a write boundary.

Every operation whose candidate would attach identity-bound state to quantity greater than `1` must preserve the original board identity at quantity `1` and standard-place the pure remainder inside that same candidate. Input storage, line start, and partial charge spending share this isolation rule. Full idle depletion is consumption, not state attachment: it removes one quantity in place. Failure publishes no intermediate state or events. Do not add feature-specific split helpers, and do not invent an inventory placement origin for a stored owner.

Placement is one shared policy used by commands, line output, charge-depletion output, reserved-instance return, and buffered-input release. `placeRuntimeItemFx` is the sole internal entry point for relocating an existing live item; lifecycle callsites must not invent specialized placement branches.

Every board location includes mandatory `space`; one cell is `space + x + y`. Board origins carry that full location through the pipeline. Occupancy, stacking, nearest-first ordering, random origin, charges, merge, and output are local to the origin space. Query reach is explicit: `board` is origin-space Board with distance, `inventory` is shared Inventory, `toolbar` is shared Toolbar, `any` is origin-space Board plus both passive storage surfaces, and `universe` is every Board space plus both passive storage surfaces without distance. Scope fallback for an `any` item proceeds Board → Inventory → Toolbar but never enters another Board space. `runtime.currentSpace` is persistent presentation/navigation state only and never filters Tick, background completion, or explicit off-screen passive-storage interactions.

Attached ownership state has no independent space while owned. A movable owner transports its complete ownership graph through Inventory or Toolbar; destination-local rules are re-evaluated after Board placement, and all surviving output or reserved state materializes from the owner's current Board location rather than any historical origin.

Materialized drops follow this high-level order:

```text
validate max count against live and reserved quantities
→ choose allowed scope policy
→ fill compatible pure stacks
→ spawn into empty locations
→ require full quantity placement
```

Existing-item placement uses the same origin, scope, nearest-first board ordering, and inventory fallback. A pure existing item may normalize through ordinary stack/spawn placement and lose its disposable runtime identity. An impure existing item preserves its exact identity and complete state graph, cannot stack or split, and requires one exclusive empty cell. Buffered release starts only from a board owner position; a loaded owner in passive inventory must return to the board before removal, and inventory coordinates are never reinterpreted as a board origin.

Output board placement is explicitly `drop` or `random`; inventory fallback is derived independently from item scope. Board-first fallback may continue into inventory when the item scope allows it.

Placement failure is a domain failure and rolls back the complete owning mutation. Do not partially place an output, partially spend charges, or partially release reservations.

## 13. Save boundary

Autosave owns persistence, not gameplay truth. Item revisions are runtime-only stale-intent tokens: state omits them, and every hydration creates fresh revisions for the new session. Jobs and queued requests are not revisioned because no command targets their previously observed mutable shape.

```text
current + later committed transitions
→ project runtime
→ deduplicate by runtime root identity
→ debounce
→ serialize writes
```

Event-only transitions neither wake nor postpone autosave.

Flush always reads the latest canonical runtime. Duplicate saves are acceptable. Failed mutations publish nothing and trigger no save.

## 14. Shutdown

Session disposal is coordinated:

```text
reject new commands
→ stop production Tick
→ close session-owned command and listener scopes
→ flush latest stable runtime
→ dispose ManagedRuntime
```

Concurrent callers share the same Effect-owned cleanup attempt. The root game owner awaits that attempt before any replacement bootstrap begins, so two sessions cannot write the same package save namespace concurrently. Hard reset uses the separate destructive path:

```text
reject new commands
→ stop production Tick
→ mark autosave discarded
→ wait for any in-flight write
→ close session scopes without final flush
→ delete persisted state
→ create a fresh session
```

The reset request is renderer-owned lifecycle intent rather than gameplay runtime mutation. Cancellation never enters this path, and storage failure propagates without manufacturing a fresh-session success.

A long planner interrupted before `modifySomeEffect` accepts a new transition changes nothing. Once it accepts `Option.some`, the exact transition becomes both current state and the single replay publication from the same serialized operation.

## 15. Explicit non-decisions

Do not introduce without a concrete reproduced requirement:

- a JavaScript or React runtime mirror;
- a second event bus;
- a central callback registry evaluated at delivery time;
- runtime revision counters for subscription membership;
- a command facade wrapping every public Effect;
- a global command queue;
- recursive deep cloning or freezing of every snapshot;
- persisted Tick cursors or job timestamps;
- job cancellation;
- reverse reconstruction of reservation history;
- gameplay decisions inside UI selectors;
- a generic DTO/read-model hierarchy made only for architectural appearance.
