# Split GameItemDefinitions

Status: DONE

## Goal

Break the remaining large item definition file into focused item-definition groups while preserving a single composed exported `GameItemDefinitions` collection.

## Current state

- `GameConfig` is split into focused manifest config files.
- `GameItemDefinitions.ts` stays as the single composed item collection.
- Large root item categories now fan out into focused one-level folders instead of absorbing every economy detail like a hungry spreadsheet demon.

## Final grouping

Top-level composed groups under `src/v0/manifest/config/item/`:

- `NaturalItemDefinitions.ts` composes `natural/PlantItemDefinitions.ts`, `natural/WoodItemDefinitions.ts`, `natural/StoneItemDefinitions.ts` and `natural/UtilityMaterialItemDefinitions.ts`.
- `CurrencyItemDefinitions.ts` stays flat because the chain is still tiny.
- `BlueprintItemDefinitions.ts` composes blank blueprint progression plus lumber camp, quarry and town hall blueprint families.
- `BuildingItemDefinitions.ts` composes town hall, lumber camp, quarry and coal mine families.
- `CrateItemDefinitions.ts` composes finite crate containers and keys from `container/*`.

`GameItemDefinitions.ts` remains the single exported collection used by `GameConfig`.

## Acceptance

- No behavior changes.
- All item IDs remain covered by `GameItemIdSchema`.
- Manifest validation still passes.
- Each definition file stays small enough to scan without emotional support.
- Typecheck and build pass.

## Watchouts

- Avoid inventing extra helper factories unless they remove meaningful duplication.
- Keep asset imports stable and do not touch PNG files.

## Result

Completed on 2026-06-16. No gameplay behavior changed; this was a file-ownership/content-scanning cleanup only. `npm run check` and `npm run build` passed.
