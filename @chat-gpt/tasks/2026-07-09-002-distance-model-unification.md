# Distance model unification

Status: pending tuning decision.

## Goal

Make board distance/proximity one explicit subsystem instead of a handful of helpers and naming leftovers. Keep behavior unchanged first; tune semantics only after parity tests pass.

## Current source hotspots

- `src/effects/readChebyshevDistance.ts`
- `src/effects/readNearbyDistance.ts`
- `src/effects/readNearbyLineEffectMatches.ts`
- `src/capacity/readNearbyCapacitySpendSource.ts`
- `src/effects/applyEffectiveDropChanceEffect.ts`
- `src/effects/readEffectiveOutputEntries.ts`
- schemas in `src/config/schema/GameLineEffectSchema.ts` and `src/config/schema/GameDropEffectSchema.ts`

## Proposed work

1. Introduce one domain-level distance/matching module, probably `src/distance` or `src/nearby`.
2. Move Chebyshev calculation, bucket resolution, bucket matching, source sorting, and selector filtering behind named functions.
3. Preserve current buckets initially: `neighbour <= 1`, `near <= 2`, `any = board-wide`.
4. Make naming honest. Either keep `nearby` everywhere or explicitly migrate docs/source comments away from old `proximity` wording.
5. Add tests covering:
   - diagonal distance 1;
   - distance 0 self-match behavior, either blessed or explicitly excluded;
   - `near` includes `neighbour`;
   - `any` is board-only, not inventory/global;
   - deterministic tie ordering by item instance id.

## Tuning hooks to consider after parity

- Replace enum-only distance with explicit radius support, e.g. `{ radius: 2 }`, while optionally keeping authoring aliases.
- Rename `neighbour` to `adjacent` if we want clearer copy. Migration cost is small but touches config and schemas.
- Decide whether `any` should mean board-wide local effect or should become a separate `scope: "board"` concept. Current `any` is overloaded and will confuse future-me, which is rude but unsurprising.

## Acceptance criteria

- No behavior change in first pass.
- All nearby behaviors call the same match reader.
- Tests document the distance contract in one place.
- Current config validates and runtime tests pass.
