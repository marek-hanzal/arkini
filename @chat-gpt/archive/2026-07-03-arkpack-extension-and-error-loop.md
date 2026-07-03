# 2026-07-03 Arkpack extension and startup error loop

## Intent

Make the binary Arkini pack the active runtime artifact without exposing gzip as a filename-level format detail, and stop startup errors from auto-reloading into the same failure.

## Changes

- Renamed generated runtime artifact from `game/arkini.game.arkpack.gz` to `game/arkini.game.arkpack`.
- Kept gzip as an internal Arkini pack compression layer decoded by browser `DecompressionStream("gzip")` or Node `zlib.gunzip`.
- Updated compiler, validator, default config loader, tests, and docs to use `.arkpack`.
- Removed the active audit's split-JSON file existence guard; active validation now focuses on the current pack and source config model instead of policing dead artifact names.
- Fixed dev startup fetch/decode path: Vite no longer sees a `.gz` extension and therefore does not serve the pack with `Content-Encoding: gzip`, so the browser does not transparently decompress it before the Arkini loader does.
- Removed automatic root error-boundary storage reset/reload. Runtime errors stay visible, and browser storage reset is explicit.

## Verification

- `npm run format:check`
- `npm run audit:current`
- `npm run game:validate -- game/arkini`
- `npm run game:validate -- game/arkini.game.arkpack`
- `npm run dc`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run audit:optional`
- Dev server check: `/game/arkini.game.arkpack` returns `200` without `Content-Encoding: gzip`.
