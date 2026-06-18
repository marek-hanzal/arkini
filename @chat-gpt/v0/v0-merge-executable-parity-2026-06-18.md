# v0 merge executable parity

Status: SUPERSEDED 2026-06-18 by `v0-strict-gameconfig-merge-rules-2026-06-18.md`
Commit: historical

## Decision

Historical note: this task briefly treated regular combo merge rules as bidirectional executable pairs. That decision was reverted. Current rule: merge execution is strictly source-owned by `GameConfig`; both directions require two explicit source-owned rules.

- source item owns the merge id -> execute directly
- target item owned reverse rules no longer execute. This older file is intentionally not the current rule.

Directed/imprint rules remain one-way and only execute when the dragged/source item owns the merge id. Reverse-directed drops may reject instead of silently becoming swaps.

## Why

Reported bug context was later corrected: the real architectural requirement is stricter than this file first assumed. Runtime must not synthesize reverse executable rules. The current config authors water -> twig explicitly as `merge:water-twig-sprout`.

## Implementation

Central helper:

- `src/v0/game/engine/logic/resolveExecutableItemMergeRule.ts`

Consumers:

- `checkItemMergeReadinessFx`
- `resolveDropIntent`
- `useGameRuntimeDropActions`
- `readRuntimeItemCatalogViewFromGameConfig`

Item catalog merge relations now use the executable resolver instead of raw config scans. This keeps detail relations aligned with actual board/runtime behavior. Regular symmetric pairs are shown as source-executable merge results and not duplicated in reverse “used in merges”. Directed imprint relations remain one-way.

## Regression coverage

- Historical only. Current coverage lives in `v0-strict-gameconfig-merge-rules-2026-06-18.md`.
