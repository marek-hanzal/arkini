# V1 drop placement orchestrator review

Reviewed `planDropPlacementFx` after the first placement strategy split and before continuing with later engine domains.

## Finding

The function still mixed five independent decision axes:

- optional replace prefix planning,
- canonical `maxCount` validation,
- mutable placement draft advancement,
- canonical item scope dispatch,
- board/inventory capacity failure classification.

The behavior was correct, but changing one policy required keeping the whole placement state machine in mind. The mutable `plans`, `draft`, `placedQuantity`, and `remainingQuantity` variables also made later edits more likely to couple unrelated paths.

## Final boundary

`planDropPlacementFx` is now the drop-schema orchestrator only:

```text
resolve canonical item
→ validate global maxCount
→ plan optional replace prefix
→ derive remaining quantity/runtime draft
→ delegate canonical scope policy
→ merge final plan
```

The extracted responsibilities are:

```text
planDropScopePlacementFx
├── board-only complete placement
├── inventory-only complete placement
└── any-scope board-first fallback

planBoardThenInventoryPlacementFx
└── board plan → inventory remainder → complete-plan assertion

assertPlacementPlanCompleteFx
└── partial quantity → PlacementUnavailableError
```

Within one concrete scope, `planScopePlacementFx` remains responsible only for stack-first then spawn planning.

## Deliberate non-splits

The following responsibilities remain in `planDropPlacementFx` because they are intrinsic to one `DropResultSchema` orchestration:

- resolving the emitted canonical item,
- checking its global `maxCount`,
- interpreting `placement: replace` as an optional prefix,
- merging the prefix and scope plans.

Extracting those into one-line forwarding helpers would increase navigation cost without lowering conceptual load.

## Additional cleanup

Board-first fallback no longer applies the board plan to a temporary runtime draft before planning inventory. Board mutations cannot affect inventory stacks or slots, so that draft was a false dependency. The replace prefix still advances a runtime draft because it changes board occupancy before the remaining board placement is planned.

Focused tests now cover board-only failure, inventory-only routing, and any-scope board-first fallback directly at the scope-policy boundary.
