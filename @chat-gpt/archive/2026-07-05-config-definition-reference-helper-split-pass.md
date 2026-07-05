# 2026-07-05 Config definition reference helper split pass

## Commit intent

Split `src/config/validation/validateGameConfigDefinitionReferences.ts` by definition-reference family after the current review identified config validation modules as the next remaining medium-sized LLM-heavy area.

## What changed

- `validateGameConfigDefinitionReferences.ts` is now a thin orchestrator.
- Shared definition-reference types moved to `ConfigDefinitionReferenceTypes.ts`.
- Asset resource/overlay checks moved to `validateAssetDefinitionReferences.ts`.
- Item iteration moved to `validateItemDefinitionReferences.ts`.
- Item asset checks moved to `validateItemAssetReferences.ts`.
- Item own-definition checks moved to `validateItemOwnDefinition.ts`.
- Item merge references moved to `validateItemMergeReferences.ts`.
- Item removal references moved to `validateItemRemovalReferences.ts`.
- Item capability reference checks moved to `validateItemCapabilityReferences.ts`.

## Notes

- This is a structural split only. No validation rule change was intended.
- The public entrypoint stays the same: `validateConfigDefinitionReferences`.
- The split keeps config validation domain modules smaller while preserving direct, grep-friendly ownership for asset, item, merge, removal, and capability references.

## Validation

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npx vitest run --no-color src/config/GameConfigSchema.test.ts cli/game/auditGameConfig.test.ts --pool=forks`
- `npm run build`
- `timeout 220 npm run test -- --pool=forks` still hangs before final summary in this container, after reporting many passing files. First explicit 25-file block passed: 25 files / 183 tests.
