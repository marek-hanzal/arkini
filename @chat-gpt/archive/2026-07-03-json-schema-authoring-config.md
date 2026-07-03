# JSON Schema for authoring config

Added a generated JSON Schema for Arkini source config files.

Rules:
- `game/arkini.schema.json` is generated from `GameConfigAuthoringSchema` via Zod's `toJSONSchema`.
- Every source JSON fragment under `game/arkini/*.json` points at the same schema with `$schema: "../arkini.schema.json"`.
- Source fragments are all the same authoring schema: top-level config sections are optional so files can be split for convenience, but nested shapes stay strict.
- `$schema` is allowed only as authoring metadata and is ignored by source merging.
- `.schema.json` files are ignored by the config package file scanner so colocated schemas cannot be compiled as gameplay fragments.

Tooling:
- `npm run game:schema` regenerates the schema.
- `npm run game:schema:check` fails if the committed schema is stale.
- `npm run check` includes the schema freshness check.
