# 2026-07-02 Alias and UI truth pass

Context: follow-up senior pass after root domain layout and runtime quality cleanup. User called out unnecessary alias/re-export modules and asked for another bug/logical consistency sweep, especially stale UI/local truth.

Done:
- Removed catch-all alias barrels and pure re-export wrappers:
  - `src/play/index.ts`
  - `src/play/runtime/index.ts`
  - `src/play/runtime/readers/index.ts`
  - `src/storage/index.ts`
  - `src/tile-engine/index.ts`
  - `src/config/readLineDefinition.ts`
  - `src/config/readProducerCapabilityDefinition.ts`
- Replaced imports with direct owner-module imports so the owning domain is visible at call sites.
- Stopped re-exporting `GameConfig` from `GameConfigSchema`; type consumers now import `GameConfig` from `GameConfigTypes`, while schema consumers import parsing/schema APIs from `GameConfigSchema`.
- Removed the old dependency-cruiser rule that forced the TileEngine barrel. Added `no-local-index-barrel-imports` to reject future catch-all `index.ts` imports.
- Updated `src/tile-engine/README.md` to document the direct-import boundary instead of the obsolete barrel contract.
- Fixed a UI pending-state lie in `useGameAction`: overlapping actions now keep `isPending` true until all in-flight dispatches finish, instead of the first completed action clearing the pending state for later actions.
- Fixed a stale long-press sheet path on board tiles: long activation now re-reads the live board item by instance id + expected item id before opening detail/utility sheets.

Verification:
- `npm run format`
- `npm run format:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run audit:optional`

Known unchanged warnings:
- Biome skips `game/arkini.assets.json` because it is larger than maxSize.
- `game:validate` reports existing unused packaged PNG resources.
- Vite reports the existing >500 kB chunk warning.
