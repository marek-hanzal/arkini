# ChatGPT working map

Status: ACTIVE
Updated: 2026-06-17

This directory is the repo-local working memory for GPT-led Arkini work. Treat this file as the current truth. Older task files are retained as audit trail, not as instructions to blindly execute like a cursed treasure map.

## Latest completed work

- `008-domain-effect-boundary-audit` is done: tap intent, drop action policy, activation depletion follow-up, optimistic merge visual-event resolution and inventory statefulness detection now live in focused pure helpers instead of UI/cache glue.
- `004-split-game-item-definitions` is done: large root item config files now compose smaller one-level content-family files (`natural/*`, `blueprint/*`, `building/*`, `container/*`) while `GameItemDefinitions.ts` remains the single exported item collection.
- Repository hygiene checkpoint is prepared for an incoming large product change: the latest completed boundary-audit code checkpoint is saved, and only docs-only handoff notes sit on top before further feature work.

## Current work

- Upcoming large product change: move static game content/rules toward a standalone JSON package (`arkini.json`) with a CLI validator before runtime loading. See `v0-json-game-definition-plan-2026-06-17.md`.
- No implementation is started yet. First concrete step should be schema/source inventory, then validation, then loading. `009-economy-content-pass` remains deferred until this direction settles, because starting economy work now would create avoidable conflicts and humanity has already suffered enough merge conflicts for one week.

## Current mental model

Arkini v0 is a client-only/offline Vite + React SPA. No SSR, no server runtime. Durable save state lives in browser OPFS SQLite through SQLocal/Kysely. Static game truth lives in `src/v0/manifest/GameConfig.ts`, composed from focused files under `src/v0/manifest/config`.

The active runtime has four layers:

1. `manifest` defines all static gameplay data and IDs.
2. SQLite + migrations store mutable save/runtime state.
3. domain `fx/` roots implement backend-like use-cases through Effect.
4. React Query + UI components render cached views and apply visual optimistic patches.

`TileEngine` is generic tile interaction infrastructure: pointer lifecycle, hit testing, drop target geometry, snap/rollback, handoff and tile motion. It must not know Arkini game rules. Game-specific drop policy belongs in `src/v0/play/drop`; board/inventory adapter wiring belongs in concrete hooks such as `useBoardTileEngineModel` and `useInventoryTileEngineModel`.

Drag/drop hover feedback is also owned by `TileEngine`. Concrete adapters may map their domain state to generic effects (`empty`, `merge`, `blocked`) through `drag.dropFeedback`, but slot background highlighting, target tile scale feedback and dragged tile visual feedback belong in the engine layer. Do not style board or inventory cells directly for hover feedback unless the behavior is truly domain-specific. Board and inventory surfaces must use the same TileEngine feedback path, so a filled inventory slot swap target is a generic `blocked` target and an empty inventory slot is a generic `empty` target.

## Hard boundaries

These are now enforced by `npm run dc` through dependency-cruiser where possible:

- `src/v0/tile-engine` must not import Arkini domains such as board, inventory, play, manifest, item, activation, database, craft, upgrade or game.
- Code outside `src/v0/tile-engine` must import TileEngine through the public `~/v0/tile-engine` barrel, not deep implementation files.
- `src/v0/manifest` must not import runtime/UI/persistence domains.
- domain `fx/` roots must not import React or React Query.
- production code must not import tests.
- production `src` code must not import devDependencies, except type/test-only edges covered by config exceptions.
- `~/v0/play/resolveDrop` wrapper is gone; use `~/v0/play/drop/resolveDrop` directly.

If dependency-cruiser complains, fix the boundary. Do not weaken the rule unless the rule is genuinely wrong for the architecture, because otherwise we are just letting the mess negotiate with us. Software does that enough already.

## Standard task start

Before coding:

1. Read this file.
2. Run or inspect `git status --short --branch`; if `.git` is missing, stop.
3. Do a library-first check: use installed libraries before writing in-house infrastructure, and consider a small focused dependency when custom code would be worse.
4. Identify the owning domain before adding files. No `shared` trash cans unless the ownership is truly generic UI/infrastructure.

## Standard task finish

Run the full gate unless the task is explicitly docs-only:

```bash
npm run check
npm run build
git diff --check
```

`npm run check` runs format check, dependency boundaries, typecheck, and Vitest. Run `npm run build` separately before packaging non-doc work. This two-step gate avoids forcing every small test cycle through the production bundle, because waiting on bundlers for tiny pure tests is how machines learn resentment.

Then commit and package a fresh zip including `.git` plus a SHA256 file. Zip names must stay unique to dodge cache weirdness, because apparently downloading a file is still a boss fight.

## Current commands

```bash
npm install --no-package-lock
npm run dev
npm run dc
npm run test
npm run check
```

Arkini uses npm without a committed lockfile. Do not add `package-lock.json`, `bun.lockb`, or similar unless the dependency policy changes deliberately.


## Layer system

Z-index is global infrastructure, not a local styling snack. All stack order must go through the CSS variables in `src/app/styles.css`:

- base surface passive tile actors use `--ak-layer-base-tile`.
- base surface dragging uses `--ak-layer-base-drag-tile`.
- bottom nav and toast have named app layers.
- overlay roots use `--ak-layer-overlay-root`; backdrop/panel are only relative inside that overlay.
- TileEngine only knows generic layer roles: `base` and `overlay`. Feature code maps board-like surfaces to `layerRole="base"` and sheet-like surfaces to `layerRole="overlay"`. Passive overlay tiles use `--ak-layer-overlay-tile` and dragged overlay tiles use `--ak-layer-overlay-drag-tile`.
- TileEngine roots must allow overflow for actors; drag boundaries are controlled by `dragConstraintsRef`, not by clipping the engine itself. Base actors may leave their surface so they can reach global drop targets such as an inventory trigger, but movement is clamped to the app canvas. Overlay/item-container surfaces should usually clamp to their own grid bounds, not the whole sheet, so inventory items cannot drift into headers or surrounding panel chrome.
- When an overlay surface is open, disable covered base TileEngine instances through the generic `disabled` prop. Disabled engines unregister their drops and ignore pointer events instead of competing with overlay hit testing.
- Drop resolution is global but must prefer the visually topmost registered drop by using DOM hit-test order, not registration order. Registration order is not a layering model; it is just a bug wearing a queue costume.

Do not add Tailwind `z-*`, inline `zIndex`, or raw `z-index: 123` declarations. `src/v0/layer/layerSystem.test.ts` exists specifically to slap that hand away. If a new surface needs layering, define or reuse a named layer variable and connect it through the relevant component data/class, not through a one-off number. Yes, even if the number feels “obvious”; that is how z-index archaeology begins.

## Animation contract

Action visual events may carry `animation` metadata. Treat this as the data contract between domain actions, cache patching and TileEngine rendering:

- `mode: "parallel"` means related movement must be allowed to start together. Swap events use this; do not split them into staggered follow-up events unless the UX explicitly changes.
- `mode: "sequence"` means the cache patcher schedules the event by `delayMs` / `sequenceIndex`. Stash exhaust output uses this to drip items one by one.
- There is no legacy/inferred sequencing. Exhaust mode, event reason or item type must not secretly change timing. If something should be sequenced, its event must say `animation.mode: "sequence"`.
- `mode: "instant"` is still an animation. It means no travel/path intent, only enter/fade-in. Never interpret it as “render without animation”, because apparently even words need guard rails now.
- `effect: "fade-in"` maps to TileEngine enter motion without translate/scale. `effect: "move"` means the item is expected to travel or has already been handed off by drag/drop.
- `effect: "merge"` is a parallel cross-fade/pop contract: old merge inputs use transient render-layer actors with `merge-out` scale-down + fade-out, while the durable target tile becomes the result and uses `merge-in` scale-up + fade-in. Never put merge-out actors into board/inventory cache data. Cache is game state, not a prop closet with commitment issues.
- `groupId` ties events that belong to one user-visible action. Keep it deterministic and readable; bug reports include this metadata.

Prefer `ActionVisualAnimation` helpers instead of hand-writing animation objects in fx roots. The helpers are intentionally boring so the event contract stays consistent and testable. Merge can be optimistically rendered from the static `GameConfig` merge rule so the animation starts immediately on drop instead of waiting for SQLite to finish thinking about twigs.

## Tile motion runtime

TileEngine animations are cancellable visual tasks, not state rollbacks. A cancelled motion must freeze the element at its current computed transform and let the next motion start from that rendered state. Never implement cancellation by resetting `style.transform` to zero; that is how jump bugs crawl back out of the grave wearing a tiny hat.

Use `TileMotionRuntime` for actor transform animations instead of calling DOM animation APIs directly inside TileEngine code. The runtime is backed by native Web Animations API (`element.animate`) and keeps the same cancellable task contract without an external motion dependency. Motions are scoped by tile ID via `tileMotionScope(tile.id)`, and starting a new transform motion in the same scope cancels the previous one, captures the current computed transform/opacity/rect before cancelling the browser animation, resolves the old task as `cancelled`, and starts the new task from the captured visual state. Awaiters must check `result.status` or the boolean wrapper return before committing follow-up cleanup. If a motion was cancelled, do not run stale reset/commit cleanup from the old async flow.

Domain actions still own game state. The motion runtime only owns temporary visual transforms and cancellation cleanup. Do not add reverse actions or rollback logic here; optimistic cache rollback belongs in action/cache code, not in animation plumbing.

Arkini-specific visual events may be mapped to TileEngine presence requests only through `src/v0/play/tile-engine-motion/*`. That directory is an adapter boundary: it converts semantic `ActionVisualAnimation` data into generic TileEngine enter/exit requests and registers them in `TileEngineMotionRequestStore`. It must not read or mutate DOM, and it must not become a second animation runtime. Board/inventory React Query rows and `TileEngine.Tile` must not carry temporary `motion` metadata; cache is durable view state, while presence animation handoff belongs to the TileEngine request registry. Exact request settlement is owner guarded, because a sequenced producer output can reuse the same `groupId` across several tiles and the first cleanup must not evict younger requests. The old `play/motion` name is intentionally gone because it sounded like play-level tile animation ownership, which is exactly the kind of naming lie that later turns into a bug report with screenshots.

## Dev Sheet and bug reports

The bottom nav `Dev` sheet replaces the old database-only sheet. It keeps the OPFS/SQLite status and hard reset button, but adds a `Copy bug report` button for animation/debug work.

Dev builds expose these console APIs:

```js
window.__ARKINI_BUG_REPORT__.dump()
window.__ARKINI_BUG_REPORT__.copy()
window.__ARKINI_BUG_REPORT__.clear()
window.__ARKINI_DEBUG_TIMELINE__.entries()
window.__ARKINI_SCENARIO__.list()
window.__ARKINI_SCENARIO__.load("swap-board-items")
window.__ARKINI_SCENARIO__.load("drag-merge-feedback")
```

Bug reports are boring JSON on purpose: browser metadata, active sheet/error context, last loaded scenario, TileEngine DOM snapshots, React Query cache snapshots for board/inventory/database, query states and the latest timeline entries. The timeline records TileEngine pointer/drag/drop/hover feedback/motion lifecycle, action mutation phases, optimistic cache restores, dev scenario loads and visual-event patch sequencing.

Motion timeline events now include `motionId`, source/target tile IDs, source/target slot IDs, runtime drop animation (`parallel-swap`) and action visual animation groups (`groupId`, `mode`, `effect`, `cause`). For swap bugs, verify the same `motionId` has `motion.snap.start` and `motion.peer-snap.start` at nearly the same timestamp. For merge bugs, look for one `effect: "merge"` group followed by two `motion.exit.start` events and one `motion.enter.start` event with the same `groupId`; they should overlap, not politely queue like sad little DOM citizens.

For animation bugs, use the Dev Sheet `Scenarios` section first when possible. Load the closest scenario, reproduce exactly one bug, then click `Copy bug report`. The useful report shape is: scenario ID, exact action, expected behavior, visible symptom, pasted JSON dump. Fewer vibes, more evidence, humanity heals slightly.

For DnD hover feedback regressions, use `drag-merge-feedback`: drag the left twig over the right twig for `merge`, over the pebble for `blocked`, and over an empty cell for `empty`. The report must include `drag.feedback.resolve`, `slot.feedback.render`, `tile.feedback.render`, and `tileEngineDom`. Those distinguish resolver bugs, React/render propagation bugs, and CSS/data-attribute bugs instead of forcing another glorious séance with the DOM.

### Render performance notes

TileEngine slot and actor components use adapter-owned `renderKey` tokens to avoid waking memoized cells/actors just because React Query produced a fresh cache snapshot object. If a TileEngine adapter puts scalar renderer data directly in `slot.data` or `tile.data`, include every relevant scalar in `renderKey`. If data identity itself is meaningful, omit `renderKey` and the engine falls back to object identity. Do not use `renderKey` to hide geometry, visibility, style, motion or feedback changes; those are compared separately and must keep rendering observable.

Inventory slot data should stay layout-only (`slotIndex`). Stack/item/quantity belongs on the tile data, where real stack changes can wake the actor and renderer. Board item actors can use stable board-item keys because the actual mutable board item details are read by focused tile views. TileEngine keeps the latest drag config behind a stable ref; pointer-down re-reads the binding from that ref, so cache changes can update drag/drop behavior without making every actor prop change. This keeps drag/hover/board cache churn from politely asking every actor to rerender because one twig blinked.

## Active improvement priorities

1. Keep the current checkpoint stable for the incoming large change. Avoid starting `009-economy-content-pass` or another broad refactor until the new product branch/ZIP lands.
2. Keep `applyActionResultCachePatch` thin. Board and inventory visual event patching already live in focused pure helpers; continue that direction.
3. Keep action visual events explicit through `ActionVisualAnimation`; test event ordering and animation contract when adding new animated behavior. Drop runtime animation flags must survive error wrapping; losing `parallel-swap` breaks swap concurrency before cache events even get a vote.
4. Add more Vitest coverage around domain action results, visual-event ordering, cache patches, placement planning and manifest validation when the behavior is being touched anyway.
5. Keep board/inventory surfaces as render shells; put TileEngine model wiring in concrete adapter hooks. Adapter hooks may wire React Query, mutations and feedback, but gameplay decisions such as tap activation intent, drop action policy, optimistic merge resolution and inventory statefulness should be delegated to small pure `logic/` helpers or play/drop action resolvers.
6. Expand debug timeline only where it helps bug reports. Do not build a giant debug cockpit unless the game actually needs it.
7. Keep manifest content editable through small topic files and a documented checklist rather than inventing a config framework that cosplays as productivity.

## Backlog conventions

Task files live in `000-refactor-backlog/`.

Status values:

- `TODO` means not started.
- `IN_PROGRESS` means partly done and still relevant.
- `DONE` means completed in a committed change.
- `BLOCKED` means waiting for a product/design decision.
- `OBSOLETE` means replaced by newer architecture or task notes.

Do not delete completed task files. Update status and add a short result note. Old dated audit notes in this folder are reference material only; this README wins when they disagree.

### Stash/producer output animation notes

Activation output spawns may carry an origin tile id into TileEngine enter motion. That id is generic `fromTileId`, not Arkini-specific state, and it lets spawned tiles animate from the current rendered source actor. This matters for producers and exhaust stashes: if the source tile moves while output is being sequenced, later spawn animations should read the source's current DOM rect rather than an old cached board coordinate. Yes, this is exactly the sort of detail that turns “just animate it” into plumbing.

For stash exhaust, do not delete the durable stash row before the sequenced output batch has finished. The stash should become empty/unclickable immediately, remain draggable while it visually emits items, and only apply durable depletion after sequence completion. Visual `activation.depleted` is delayed with the sequence; the follow-up DB finalizer runs after the same sequence window plus a tiny buffer.
Producer output also uses explicit `mode: "sequence"` spawn events. First item enters immediately, later items follow by `actionVisualSequenceDelayMs`; do not silently revert producers to one cache batch unless we deliberately want the player to miss the output animation.

Board merge drops use TileEngine `parallel-merge`, which commits the merge cache patch immediately instead of running a pre-commit source snap first. Merge fade/pop belongs to the merge visual event group, not to a separate “please wait while this twig politely parks itself” phase.

### Tile presence animation tuning

Tile actor travel and presence timings are intentionally a little slower than the old snappy values. Mobile Safari made the old merge success cross-fade feel choppy, especially when opacity and transform changed on the same tile visual. Keep short UI affordance transitions in CSS, but TileEngine presence motions (`enter`/`exit`) should temporarily disable the `.ak-tile-engine-visual` CSS transition with `data-ak-tile-engine-presence-motion`. Otherwise the browser can run CSS transition cleanup and WAAPI keyframes over the same `opacity`/`transform` properties, because apparently two animation systems touching one element is how frontend summons goblins.

Merge success should stay subtle: result `merge-in` scales from roughly `0.9` to `1`, and old inputs `merge-out` scale only slightly down. Avoid giant `0.72 -> 1` scale pops for normal item tiles; they look dramatic on desktop and crunchy on iOS.

Presence motion ownership is tokenized. Never clear `data-ak-tile-engine-presence-motion` blindly from an async continuation; only the motion token that set the marker may clear it. Replaced/cancelled motions resolving late must not re-enable CSS transitions while a newer WAAPI enter/exit animation is still running. This tiny race is exactly how a perfectly innocent merge fade becomes chunky on iOS and makes everyone question their career choices.

User drag owns the outer actor transform as soon as pointer down starts. Cancel only `tileMotionScope(tile.id)` before resetting that actor transform; do not blanket-cancel descendant presence motions from pointer down, because the inner visual may be mid fade/pop and freezing that opacity is a different stupid bug wearing sunglasses.

Motion IDs and presence tokens must be monotonic owner IDs, not rounded timestamps. A stale `finished`/`catch` continuation compares owner IDs before cleanup; if IDs collide, the old animation can delete the new one and everyone gets to enjoy another fake Safari bug.

Presence motion CSS must use an attribute-presence selector (`[data-ak-tile-engine-presence-motion]`), not an equality selector. The dataset value is a unique owner token, not `"true"`; matching only `"true"` re-enables CSS transitions during WAAPI enter/exit and resurrects merge fade chunkiness.

Presence motion cleanup order matters: cancel the scoped presence motion first, then clear the marker token. The marker suppresses CSS transitions, so freeze/cancel must run while the marker still protects the visual element. Drop motion timeline IDs should also be monotonic counters, not timestamp guesses.

TileEngine presence handoff is no longer stored on board/inventory React Query rows. Arkini adapters register exact generic motion requests in `TileEngineMotionRequestStore` through the public `~/v0/tile-engine` barrel, keyed by `engineId` and `tileId`. Do not reintroduce temporary `motion.enter` data on cache rows; cache is durable view state, while presence animation requests belong to the TileEngine registry. Exact request settlement is owner-guarded so a sequenced producer output cannot let the first cleanup evict younger requests from the same `groupId`.

### Shared TileEngine motion settlement timing

Temporary TileEngine motion request cleanup must use `actionVisualMotionSettlementDelayMs(animation)`. It includes `delayMs`, `durationMs` and `TileEngineTiming.motionCleanupBufferMs`. Do not hand-roll `duration + buffer` near presence request registration or transient render actors; delayed sequence/presence motions will eventually make that shortcut look clever for about six minutes and broken forever after.
