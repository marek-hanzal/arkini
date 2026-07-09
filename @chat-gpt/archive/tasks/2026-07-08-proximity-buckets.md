# 2026-07-08 - proximity buckets simplification

- Removed the experimental root `./config/schema` bootstrap to keep work focused on the live game.
- Simplified nearby/proximity authoring from numeric radius + exact distance bands to three buckets:
  - `neighbour` = within 1 tile
  - `near` = within 2 tiles
  - `any` = anywhere on the board
- Updated the runtime readers to evaluate these three buckets directly.
- Re-authored current game config from `radius` / `minDistance` / `maxDistance` to bucket-based `distance` entries.
- Mapped old authored semantics as follows:
  - `radius: 1` -> `distance: "neighbour"`
  - `radius: 2` -> `distance: "near"`
  - `radius >= 3` -> `distance: "any"`
  - old duration bands collapse onto bucket representative distances (`1`, `2`, `3` respectively, with `0` only as fallback for `neighbour`)
