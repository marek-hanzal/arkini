# 2026-07-02 Unused code and motion cleanup

Context: follow-up senior cleanup after alias/re-export removal. Goal was to find hidden dead code, stale parameters, useless motion metadata, and local truth debris that regular tests do not necessarily punish.

Done:
- Tightened `npm run typecheck` to run `tsc --noEmit --noUnusedLocals --noUnusedParameters` so unused locals/parameters fail the hard gate instead of quietly rotting.
- Removed unused imports, locals, and test fixtures surfaced by the stricter TypeScript gate.
- Deleted unused time schemas that were not part of any runtime/schema contract.
- Removed dead item catalog/view schema exports; retained the view types directly where the app actually needs them.
- Simplified TileEngine motion APIs by removing unused `meta`, cancel reasons, and drop commit props that were never read by the runtime.
- Removed dead hover feedback bookkeeping refs in `useTileDragHover`; the hook now computes and publishes the current active feedback directly.
- Removed unused private motion request cleanup code and unused audit plumbing.
- Fixed a duplicated craft consumption entry in the game config audit item-flow collector.
- Updated README local gate docs to state that typecheck rejects unused locals/parameters.

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
