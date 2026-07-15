# Material eligibility and merge closeout

Closed against the runtime speed-mode snapshot.

- Material selectors now describe their complete accepted candidate set. Every matched canonical item must be able to enter material-input storage; temporary board-bound items fail semantic validation.
- The authoritative material store planner uses the same eligibility rule and rejects an ineligible source before mutation or event publication.
- Canonical selector semantics now live in one pure `matchesSelector` reader; `selectorFx` is the runtime Effect wrapper, while semantic validation avoids thousands of needless Effect spans.
- Merge validation rejects the narrow provably impossible exact self-target rule when the owner has `maxCount: 1`.
- Merge replacement now recreates canonical initial runtime state through `createRuntimeItemFx` while preserving the target runtime ID and board location.
- Placement, temporary Tick lifecycle, buffered identity preservation, and runtime same-identity merge guards were not redesigned.
