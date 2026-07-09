# 2026-07-09-000 Current hotspot analysis

## Snapshot
- HEAD at analysis time: `38236f55`
- Implementation files (`src + cli`, excluding tests): `979`
- Implementation LOC: `55,513`
- Median file size: `35`
- Files with `<= 40` LOC: `531`
- Files with `<= 20` LOC: `309`

## What improved already
- many transport `Scope/Context/Facts` bags are gone from producer, craft, board-memory, activation, merge, world
- several pure translator files in drop/interaction and runtime readers were removed
- effect bonus summary moved out of bridge into `effects`
- craft output flow stopped using a fake `EffectiveLine` wrapper

## Current top hotspots by ROI

### 1. Runtime line output bridge
Primary file:
- `src/play/game-engine-bridge/readRuntimeLineOutputViews.ts`

Why it matters:
- still one of the larger bridge modules
- weighted/chance flattening and output-set traversal were already pushed down into `effects/readEffectiveLootPlanViewEntries.ts`
- remaining bridge work is now mostly owned quantity, bonus line attachment, labels, and effect-carrier filtering

Desired direction:
- keep bridge output rendering thin
- only continue here if another clearly shared canonical fact can move below the bridge boundary

### 2. Craft vs line/output effect flow
Primary files:
- `src/play/game-engine-bridge/readRuntimeCraftViewFromGameSave.ts`
- `src/craft/readCraftLineEffectState.ts`
- `src/effects/readEffectiveOutputEntries.ts`

Why it matters:
- craft still has some local truth for effect/output state
- downstream should consume the same canonical post-effect shape more directly
- good place to reduce both duplicate work and duplicate code

Desired direction:
- shared `EffectiveLootPlan` / post-effect output shape
- less manual rebuilding of loot plan at craft and completion callsites
- compute grants once and flow them through

### 3. Interaction decision hub
Primary file:
- `src/play/interaction/resolveItemToBoardItemInteractionPlan.ts`

Why it matters:
- no longer a wrapper jungle, but now a concentrated hotspot
- heavy decision routing for merge / stack / craft input / producer input / swap / reject semantics
- still one of the most expensive files mentally

Desired direction:
- do not split into more helper files
- simplify internal routing by interaction family and remove mechanical branching where possible

## Secondary hotspots
- `src/board/control/resolveBoardItemTapAction.ts`
- `src/play/runtime/drop/dispatchBoardItemDropActions.ts`
- `src/craft/syncRealtimeCraftJobsFx.ts`

## Things not worth targeting right now
- config validation
- schemas
- tests-only builders
- audio synth

- Update after interaction pass: `resolveItemToBoardItemInteractionPlan.ts` now owns one exported commit helper instead of two extra translator exports, and the main resolver is organized by ordered interaction families (merge -> stack -> input families -> swap) rather than by a single mega facts object. Re-measure before doing another pass here.

## 2026-07-09 follow-up
- `resolveItemToBoardItemInteractionPlan.ts` now uses a readable compiled `ItemInteractionProfile` instead of repeatedly spelunking config state inline.
- The hotspot still exists, but the remaining cost is now mostly true precedence logic, not repeated static capability checks.
- `resolveBoardItemTapAction.ts` also shares the new `specialInteractionKind` classification, which reduces one more cluster of open-coded special item checks.

- Follow-up after `readCraftEffectiveLootPlan`: craft runtime view and craft completion now share one canonical loot-plan reader, so the remaining craft hotspot is less about duplicate output assembly and more about effect-state / runtime-view orchestration.

- craft runtime view hotspot was partially reduced by collapsing `RuntimeCraftViewScope` and moving the craft view builder toward a direct top-level flow with smaller local helpers; reevaluate craft cluster before opening a new broad refactor front

- Follow-up after craft gate split: craft runtime/start/sync paths now avoid building full effect requirement labels when they only need start-gate readiness, so the remaining craft hotspot is increasingly concentrated in display/state projection rather than duplicated gate evaluation.

- 2026-07-09 craft remeasure after `7fb8c0b0`: craft total ~2819 LOC across 38 impl files. Top craft hotspots: `readCraftLineEffectState.ts` 324, `syncRealtimeCraftJobsFx.ts` 296, `readRuntimeCraftViewFromGameSave.ts` 274. Follow-up pass moved craft effect evaluation to a single internal analysis path reused by gate and full effect state readers.
- 2026-07-09: Simplified `syncRealtimeCraftJobsFx` to read current draft save once per job, derive `startGateReady` from the same snapshot, and pass that save into retime/resume timing instead of re-reading via separate helpers. Verified with typecheck and targeted craft/runtime tests.

- 2026-07-09 broader remeasure at `7488dfa7`: craft cluster was intentionally cooled down after several passes; next broader ROI should move to board/drop interaction surfaces or remaining interaction hub cleanup rather than tunneling deeper into craft.

- 2026-07-09 broader pass after `7488dfa7`: switched focus away from craft-only cleanup and added a board tap/runtime surface task. Simplified `resolveBoardItemTapAction.ts` and `handleResolvedBoardItemTapAction.ts` to straightforward ordered control flow without matcher ceremony; board tap remains a surface worth watching, but no longer needs a dedicated hotspot push right now.
