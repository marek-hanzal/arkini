# 2026-07-01 — Lumberjack tree-tier loot rolls

## Scope
- Added tree growth tiers: Tree -> Double Tree -> Micro-Forest, grown by merging Water into the current tree tier.
- Added Double Tree and Micro-Forest item assets from the already-generated PNGs; no new image generation was done.
- Changed Lumberjack log output from guaranteed/basic chance output to nearby-source-driven chance output.

## Runtime/config decision
- Added drop-owned `nearby.loot.outputChance.add`.
- The effect scans nearby board sources by selector and radius, sums each matching source contribution, and emits one uncapped chance item for the affected output.
- Chance values above 100% are not clamped. Runtime converts them to guaranteed rolls plus one remainder roll: `floor(chance)` guaranteed drops and `chance % 1` extra chance.
- UI schemas, loot/drop views, and effect summaries now allow/display probabilities above 100%, using guaranteed-plus-remainder language where needed. Zero-probability carrier rows are hidden when runtime chance items replace them.

## Current authored Lumberjack behavior
- Single Tree contributes 50% Log chance.
- Double Tree contributes 65% Log chance.
- Micro-Forest contributes 85% Log chance.
- Multiple nearby sources add together.

## Verification
- `npm run format:check` passes with the known large generated asset warning.
- `npm run game:validate -- game/arkini` passes with the known unused packaged resource warnings.
- `npm run dc` passes.
- `npm run typecheck` passes.
- `npm run test` passes: 90 files, 546 tests.
- `npm run build` passes with the known chunk-size warning.
