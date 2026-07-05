# Repo audit guardrails split pass

Commit target: split `cli/repo/auditCurrent.ts` and tighten LLM-friendliness guardrails after the producer/world/UI/runtime cleanup series.

What changed:

- Kept `cli/repo/auditCurrent.ts` as a thin orchestrator.
- Moved audit ownership into focused modules under `cli/repo/audit/`:
  - forbidden runtime/text artifacts,
  - source ownership rules (`index.ts`, `logic`, `Effect.fn` naming),
  - save mutation boundary checks,
  - schema/effect runtime boundary checks,
  - config model checks,
  - shared file readers and finding type.
- Added file-size guardrails to `audit:current`:
  - production `src/**/*.ts(x)` files must stay at or below 400 lines,
  - test/support files must stay at or below 1500 lines.

Why:

The newer LLM-friendliness review called out audit guardrails as the remaining boring-but-important work after the big monoliths were split. Production source now has no files above 400 lines, so the audit should prevent regressions instead of letting us recreate the same concrete slabs later and act surprised.

Validation:

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npx vitest run --no-color cli/game/auditGameConfig.test.ts --pool=forks`
- `npm run build`

Notes:

- One broad Vitest block still hung in the container before final summary, consistent with the previous runner behavior. The first broad block completed `30 files / 266 tests`; the changed CLI audit path was specifically exercised.
