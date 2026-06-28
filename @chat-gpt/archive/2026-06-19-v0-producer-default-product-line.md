# V0 producer default product line


> Superseded/current rule: producer default line is **not** the first configured product. A default product line exists only when the player explicitly selects it and it is stored in save/runtime state. Do not use this historical note as current architecture truth; it documents the old implementation that was later removed because implicit defaults are a tiny cursed UX/backend contract pretending to be convenience.

Completed: producer default product line is the first `producer.productIds` entry.

Changes:

- `producer.product.start` may omit `productId`; runtime resolves it to the first product line.
- Board click dispatch omits `productId`, so default selection is owned by runtime instead of UI guessing.
- Producer feeding without explicit `productId` still iterates product lines in config order, so the first/default line gets priority before later matching lines.
- Producer product line view now exposes `isDefault`; item detail UI shows a `Default` badge.
- Producer board readiness now reads readiness from the default line instead of the legacy top-level producer input placeholder.
- No save field was added; default is static effective config order, not mutable runtime state.

Validation:

- `npm run check` passed.
- `npm run game:validate -- game/arkini.game.json game/arkini.assets.json` passed.
- `npm run build` passed with the existing Vite chunk-size warning.
