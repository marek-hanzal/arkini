# V0 asset kind removal

Removed `assets.*.kind` from the canonical config shape and compiler output.

Why:
- Every current runtime asset is consumed through item definitions via `items.*.assetId`.
- `kind: "item"` was generated on all conventional item/producer assets and did not drive runtime/UI behavior.
- The only alternate value, `ui`, had no active gameplay usage and only existed to support a validation branch that duplicated what asset ids/resources already express.

Current rule:
- Assets describe render metadata only: `resourceId`, optional `overlayAssetId`, optional `render`, optional `label`.
- Item ownership is validated by the item pointing at an existing asset.
- Asset ids/resource ids remain the convention boundary (`asset:item:*`, `asset:producer:*`, generated PNG resource basenames).
- Source or compiled configs with obsolete `kind` keys are rejected by the strict schema.

Validation:
- `game:compile` regenerates `game/arkini.game.json` without asset `kind` fields.
- `game:validate` and runtime parsing share the same schema.
