# Gameplay softlock source helper split pass

Commit: Split gameplay softlock source helpers

Goal: continue the post-review LLM-friendliness cleanup in the config validation medium modules. `createGameplaySoftLockSources.ts` was the largest remaining config-validation source module after the definition-reference split.

Changes:

- Kept `createGameplaySoftLockSources.ts` as a thin orchestrator.
- Split source families into focused modules:
  - starting state sources,
  - passive grant sources,
  - merge output sources,
  - removal output sources,
  - craft sources,
  - producer/craft line output + active effect sources.
- Extracted shared item/grant gameplay source factories.

Rationale:

Softlock source creation feeds reachability checks and is mentally expensive because it maps many config feature families into the same `GameplaySource` model. The split keeps the single public entrypoint while making each family directly greppable and reviewable.

Validation notes:

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- targeted config/audit tests
- build

