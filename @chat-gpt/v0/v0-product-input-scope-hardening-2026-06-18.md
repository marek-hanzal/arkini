# V0 product input scope hardening

Date: 2026-06-18
Commit: pending

## Decision

T5 is intentionally a small schema/resolver hardening pass, not an overlay architecture rewrite.

Marek clarified the target model:

- Upgrades are global for a producer/product-line definition, not per concrete item instance.
- Future upgrade UI will live on concrete buildings/product lines, so the runtime/UI will have producer + product line context.
- Product definitions should not be shared. A `productId` is owned by exactly one producer line.
- Product consumable input definitions should not be shared between product lines. Two lines may accept the same item, but they must reference distinct `inputRefId` records.

This keeps the current `productId`-targeted upgrade effects usable while preventing accidental shared mutable top-level input refs.

## Implemented

`GameConfigSchema` now rejects:

- the same `productId` appearing under more than one producer
- the same product `inputRefId` being referenced by more than one product line
- an effective upgrade prefix where `product.inputRef.set` makes two product lines share one input ref

It still allows two product lines to accept the same item when each has its own input definition. That preserves top-to-bottom runtime routing without allowing one line's quantity upgrade to leak into another line.

`applyConfigLayerFx` no longer scans for the first product layer matching an input ref inside the input loop. It builds an explicit `inputRefId -> product input layer` map from effective products. The schema guarantees unique ownership, so this is deterministic instead of a tiny fortune teller wearing TypeScript.

## Non-goals

- No per-instance upgrade layers.
- No new producer-scoped upgrade effect shape yet.
- No automatic input-ref cloning at runtime.
- No migration of authored content was needed; current Arkini content already uses product/input refs uniquely.

## Follow-up

When upgrade UI moves onto concrete building/product-line rows, consider whether action schemas should carry both `producerId` and `productId` for better user intent tracing. That is UX/action metadata, not a reason to make config upgrades instance-scoped.
