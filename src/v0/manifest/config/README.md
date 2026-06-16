# Manifest config editing guide

`src/v0/manifest/config` is the static truth of the game. If a gameplay fact can be derived from this config, derive it instead of copying it elsewhere. Parallel truths are how small games become spreadsheets with anxiety.

## Composition order

- `GameDefinition.ts` owns global board/inventory dimensions and game identity.
- `GameAssetDefinitions.ts` composes asset definitions from `config/asset/*`.
- `GameItemDefinitions.ts` composes item definitions from `config/item/*`.
- `GameLootTableDefinitions.ts` composes loot tables from `config/loot-table/*`.
- `GameUpgradeDefinitions.ts` owns global upgrade definitions.
- `GameStartingState.ts` owns the initial board/save state.

`GameConfig.ts` parses and validates the composed result. Runtime code should depend on parsed config/service indexes, not on random config chunks.

## Item checklist

When adding or changing an item, check:

1. item definition in the right `config/item/*` file
2. asset definition in the matching `config/asset/*` file
3. imported PNG in `src/assets` if the item is visible
4. `GameItemIdSchema` enum
5. `GameAssetIdSchema` enum
6. merge rules, craft recipe, producer/stash behavior or explicit lack of behavior
7. loot tables that should emit the item
8. starting state if the item should exist on a fresh save
9. upgrades if the item is a cost/reward/progression target

Item PNGs should normally be `128x128`. Source art can be larger outside runtime assets, but runtime assets should not turn a tiny icon into a shipping-container-sized PNG because the browser has suffered enough.

## Definition style

Keep definition files boring and grouped by gameplay family. The top-level item files compose root categories, and larger roots split one level deeper by concrete content family:

- `NaturalItemDefinitions.ts` composes plant, wood, stone and utility material chains from `config/item/natural/*`.
- `CurrencyItemDefinitions.ts` stays flat while the currency chain is tiny.
- `CrateItemDefinitions.ts` composes finite containers and keys from `config/item/container/*`.
- `BuildingItemDefinitions.ts` composes building families from `config/item/building/*`.
- `BlueprintItemDefinitions.ts` composes blank blueprint progression and building blueprint families from `config/item/blueprint/*`.

Prefer DSL helpers in `manifest/dsl` for repeated shapes. Do not add a generic config abstraction unless it removes real duplication without hiding the data. The manifest is allowed to be a big honest moloch; it is not allowed to become a clever dishonest one.
