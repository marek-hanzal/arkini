# 2026-07-03 Binary Arkini runtime pack

## Intent

Replace the split compiled runtime JSON artifacts with a single binary transport artifact while keeping authoring and runtime domain models intact:

- Source truth remains `game/arkini/*.json` plus PNG files.
- Compiler input remains the normalized `GameConfig` object already produced by `compileDirectory`.
- Runtime output after decode remains a normal `GameConfig` flowing into the same engine/store pipes.
- No legacy split compiled JSON runtime path remains.

## Implementation

- Added `@msgpack/msgpack` for schema-less config serialization.
- Added Arkini pack v1 binary format:
  - magic header `ARKPACK1`
  - MessagePack manifest
  - MessagePack normalized config payload without `resources`
  - raw PNG resource blobs
  - outer gzip wrapper
- `game:compile` now writes `game/arkini.game.arkpack`.
- Removed generated `game/arkini.game.json` and `game/arkini.assets.json` from active runtime artifacts.
- Browser runtime loads the pack through `loadDefaultGameConfig`, fetches the `.arkpack`, inflates it with `DecompressionStream("gzip")`, decodes MessagePack, creates Blob URLs for PNG resources, validates with `GameConfigSchema`, then hands the normal `GameConfig` to existing runtime creation.
- Node/test/CLI paths use `loadGameConfigPackFromFile`, backed by Node `zlib.gunzip`.
- `game:validate` accepts either source packages such as `game/arkini` or a single `.arkpack` file.
- `audit:current` validates the committed binary pack as the active runtime artifact.

## Verification

- `npm run check`
- `npm run build`
- `npm run audit:optional`
- `npm run game:validate -- game/arkini.game.arkpack`

Known warning remains the Vite chunk-size warning and existing unused packaged PNG resource audit warnings. The old Biome max-size warning for generated assets JSON is gone because that JSON no longer exists.
