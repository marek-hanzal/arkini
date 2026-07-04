# Context scope flattening pass

## Intent

Continue the deep review cleanup by reducing fake local `Context.Tag` orchestration scopes that only carried stable call props. These scopes made short routes harder to follow without buying real dependency injection value.

## Changes

- Flattened `src/job/processItemSpawnJobsFx.ts` by removing `ItemSpawnJobsProcessingScopeFx` and passing `config`, `save`, and `nowMs` explicitly through private Fx helpers.
- Removed the redundant local due-job batch helper in favor of calling `readDueItemSpawnJobsFx` at the exported boundary.
- Flattened `src/world/readWorldWakePlanFx.ts` by removing `WorldWakePlanScopeFx` and making each wake-reason reader accept its required props directly.
- Documented the rule: use Context services for real ambient services, not as a local prop backpack.

## Validation

- `npm run format:check`
- `npm run audit:current`
- targeted Vitest around item-spawn/world tick paths
- `npm run audit:optional`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test`
- `npm run build`
