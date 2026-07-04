# Route map clarity + responsibility pass

Completed another review pass focused on code paths that were mentally expensive to follow, especially route maps where one function had to keep too many runtime states in view at once.

Changes:

- Removed the standalone `matchGameAction` indirection and moved action dispatch into `applyGameActionFx` with `ts-pattern.exhaustive()` and a local `GameActionApplicationScopeFx` context for shared `config/save/nowMs`.
- Split runtime line-view assembly into named route-map pieces: producer queue state, default selection, line timing, input view state, effect requirements, target-limit state, and per-line view assembly.
- Split `readEffectiveLine` drop-effect dispatch into explicit handlers for grant requirements, nearby requirements, grant blockers, drop toggle effects, nearby loot chance, grant extra loot chance, and no-op duration/capacity effects. The dispatch is exhaustive now.
- Split board-cell drop routing into named target/plan routes for move, delete, inventory utility storage, and item-to-board-item interaction plans.
- Split inventory-cell drop routing the same way, with clear current-source-stack validation, occupied-cell interaction, empty-cell placement, and explicit plan handling.

Verification:

- `npm run format:check`
- `npm run audit:current`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `timeout 180s npm run test` -> 101 files / 619 tests passed
- `npm run audit:optional`
- `npm run build`

Expected config warnings remain only the limited-deposit softlock warnings for double-tree, micro-forest, rock, and tree.
