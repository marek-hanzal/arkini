# Flip crossfade stage animation

## Task
Update merge and craft/blueprint stage visuals so the tile engine owns a reusable bounce + flip + crossfade animation rather than leaving each gameplay path to fake its own transition.

## Changes
- Added `flip-in` / `flip-out` tile presence motion kinds in TileEngine.
- Routed merge result replacement, craft result replacement, and craft input stage update through the same flip-crossfade presence pair.
- Added `GameVisualMotion.stageUpdate` for craft/blueprint input progress visuals.
- Added transient board tile `assetProgress` support so blueprint/craft stage updates can crossfade the previous asset stage into the current one instead of animating only the already-updated DOM.
- Extracted `appendBoardTargetTransformVisuals` to keep craft result and craft stage visual plumbing shared.

## Verification
- `npm run format:check`
- `npm run audit:current`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run audit:optional`

Known existing warnings remain: Biome max-size warning for `game/arkini.assets.json`, unused packaged PNG resources, and Vite chunk-size warning.
