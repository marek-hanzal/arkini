# 2026-07-10 dev inspector

Branch: `feat/dev-game-inspector`

## Implemented

- Added a client-only dev workspace under `src/dev` with hash routes:
  - `/dev` pack landing/upload state
  - `/dev/table` searchable and expandable item catalog
  - `/dev/flow` prepared placeholder sharing the same loaded pack state
- Added `readGamePackFx` to the v1 pack business layer. It gunzips an `.arkpack`, decodes the binary payload, and validates the config with `GameSchema`.
- Added packed asset resolution through the canonical `asset:*` to PNG resource naming convention.
- Added TanStack Table with sorting and expandable rows plus Fuse.js fuzzy search.
- Item rows and nested details consume the v1 schema-inferred types directly. Discriminated item, input, quantity, roll, query, selector, condition, line rule, drop rule, and merge variants are rendered with `ts-pattern`.
- Expanded details include packed image previews, common item metadata, type-specific fields, lines, inputs, outputs, rules, and merges.

## Next quest

Build the real `/dev/flow` graph:

- derive directed item edges from merges, material/deposit inputs, line outputs, stash/depletion outputs, and weighted/chance rolls;
- use React Flow for the canvas and ELK for a left-to-right layered layout with branch-aware routing;
- reuse the current pack context and asset URLs rather than adding another upload or decode path;
- decide how to represent cycles, item sinks, sources, optional/chance edges, and unresolved references before styling the graph.
