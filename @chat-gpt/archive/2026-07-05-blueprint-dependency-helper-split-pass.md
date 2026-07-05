# Blueprint dependency helper split pass

Commit: see git history for this archive note

Goal: continue the GameConfigValidation cleanup after the gameplay softlock helper split by reducing the next largest validation domain file.

Changes:
- Split `src/config/validation/validateBlueprintDependencyCycles.ts` from a 598-line all-in-one validator into a thin public orchestrator.
- Added explicit blueprint dependency types in `BlueprintDependencyTypes.ts`.
- Moved blueprint item/source readers into `readBlueprintDependencyItems.ts`.
- Moved dependency edge collection into `collectBlueprintDependencyEdges.ts`.
- Moved DFS/cycle detection into `readBlueprintDependencyCycles.ts`.
- Moved issue formatting into `addBlueprintDependencyCycleIssue.ts`.

Validation:
- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run build`
- Full test suite verified in blocks: 102 files / 622 tests passed.

Notes:
- No gameplay/config validation behavior intentionally changed.
- The public entrypoint remains `validateBlueprintDependencyCycles`.
