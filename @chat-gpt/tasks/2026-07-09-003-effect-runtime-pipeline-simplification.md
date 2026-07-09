# Effect runtime pipeline simplification

Status: pending implementation after distance model pass.

## Goal

Make effect evaluation readable by ownership and phase, not by one giant mixed union where half the behavior happens elsewhere because apparently chaos needed an API.

## Current source hotspots

- `src/effects/readEffectiveLine.ts`
- `src/effects/readEffectiveLineRequirements.ts`
- `src/effects/readEffectiveOutputEntries.ts`
- `src/effects/readEffectiveDrop.ts`
- `src/effects/applyEffectiveDropEffect.ts`
- `src/effects/applyEffectiveDropRequirementEffect.ts`
- `src/effects/applyEffectiveDropToggleEffect.ts`
- `src/effects/applyEffectiveDropChanceEffect.ts`
- `src/effects/readEffectiveLineBonusEntries.ts`

## Proposed work

1. Keep `readEffectiveLine` as orchestration only.
2. Split runtime effect work by outcome:
   - start gates/blockers;
   - visibility gates;
   - output enable/disable toggles;
   - duration modifiers;
   - bonus/chance loot;
   - capacity spend requirements.
3. Stop representing unsupported owner/effect combos as runtime no-ops. If a kind is not meaningful for an owner, schema/validation should reject it or the runtime type should make it impossible.
4. Give output-entry evaluation one result object that contains visible/rollable/chance/duration data, so duration is not a weird side pass over the same effect array.
5. Preserve the public `EffectiveLine` shape until UI parity is verified.

## Things not to do

- Do not reintroduce top-level effect registries.
- Do not move output-owned behavior back to item-level global mutators.
- Do not make UI infer effect meaning from raw JSON.

## Acceptance criteria

- Same runtime behavior before/after, proven by current tests plus a focused regression pass.
- No `readUnchangedDropEvaluation` escape hatch for effect kinds that should not be drop-owned.
- Effect owner rules are obvious from types and validation, not tribal knowledge stored in the skull of a tired robot.
