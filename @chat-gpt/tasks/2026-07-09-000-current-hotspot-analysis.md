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
