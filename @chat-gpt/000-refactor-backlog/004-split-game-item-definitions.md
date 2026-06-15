# Split GameItemDefinitions

Status: TODO

## Goal

Break the remaining large item definition file into focused item-definition groups while preserving a single composed exported `GameItemDefinitions` collection.

## Current state

- `GameConfig` has been split into focused manifest config files.
- `GameItemDefinitions.ts` remains too large and should not keep absorbing all economy data like a hungry spreadsheet demon.

## Proposed grouping

Possible folders/files under `src/manifest/config/item/`:

- `RawMaterialItemDefinitions.ts`
- `CraftedMaterialItemDefinitions.ts`
- `CurrencyItemDefinitions.ts`
- `ProducerItemDefinitions.ts`
- `StashItemDefinitions.ts`
- `BlueprintItemDefinitions.ts`
- `CraftConstructionItemDefinitions.ts`
- `UtilityItemDefinitions.ts`

Then compose in `GameItemDefinitions.ts`.

## Acceptance

- No behavior changes.
- All item IDs remain covered by `GameItemIdSchema`.
- Manifest validation still passes.
- Each definition file stays small enough to scan without emotional support.
- Typecheck and build pass.

## Watchouts

- Avoid inventing extra helper factories unless they remove meaningful duplication.
- Keep asset imports stable and do not touch PNG files.
