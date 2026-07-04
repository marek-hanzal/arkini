# Effective line helper split pass

Commit: `Split effective line helpers`

## Context

After lifecycle write/removal boundaries and local `Context.Tag` cleanup, `src/effects/readEffectiveLine.ts` remained the biggest runtime mental-load file outside the heavier producer/config/schema areas. It mixed selector label formatting, nearby matching, applied effect operation construction, line-level start/block requirement evaluation, drop effect evaluation, output filtering, duration modifiers, and final `EffectiveLine` assembly.

## Change

Split the lowest-risk cohesive helpers out of `readEffectiveLine.ts`:

- `createAppliedGameEffectOperation.ts` owns `AppliedGameEffectOperation` construction.
- `readNearbyLineEffectMatches.ts` owns nearby board matching and nearby duration band multiplier lookup.
- `readNearbyLineEffectLabel.ts` owns nearby selector/effect labels.
- `readRuntimeLineEffectLabel.ts` owns generic runtime line/drop effect labeling and percent formatting.
- `readEffectiveLineRequirements.ts` owns line-level requirements, start gating, and `grant.blockStart` block reasons.

The public `readEffectiveLine` behavior was kept intact. The remaining file still owns drop effect application, output visibility/rollability, duration aggregation, and final `EffectiveLine` assembly.

## Result

`readEffectiveLine.ts` dropped from about 1299 lines to 946 lines. The extracted modules make nearby matching/labels and line requirements grepable without opening the whole effect evaluator blob.

## Validation

- `npm run format:check`
- `npm run audit:current`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini` (known finite-deposit warnings only)
- `npm run dc`
- `npm run typecheck`
- `npm run audit:optional`
- `npm run build` (known Vite chunk-size warning only)
- `npx vitest run --no-color src/effects/readEffectiveLine.test.ts src/play/game-engine-bridge/readRuntimeLineViewsFromGameSave.test.ts src/producer/applyGameActionProducerFx.test.ts`
- `npm run test` passed all 101 files / 619 tests separately.
- `npm run check` passed through typecheck and timed out during the monolithic Vitest phase in this sandbox; the standalone full test run passed.
