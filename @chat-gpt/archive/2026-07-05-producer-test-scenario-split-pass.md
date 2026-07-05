# Producer test scenario split pass

Commit: this pass

Goal: continue the LLM-friendliness cleanup from the review checkpoint by splitting the largest remaining producer test file.

Changes:
- Removed the monolithic `src/producer/applyGameActionProducerFx.test.ts` (~3137 lines).
- Added shared producer test helpers in `src/producer/applyGameActionProducerFx.testSupport.ts`.
- Split scenarios into focused files:
  - `applyGameActionProducerFx.start.test.ts`
  - `applyGameActionProducerFx.blueprint.test.ts`
  - `applyGameActionProducerFx.selection.test.ts`
  - `applyGameActionProducerFx.grants.test.ts`
  - `applyGameActionProducerFx.inputs.test.ts`
  - `applyGameActionProducerFx.queue.test.ts`

Reasoning:
- The producer runtime was already split in previous passes, but the single producer integration test file remained the largest LLM-hostile artifact in `src`.
- Scenario-grouped tests make future producer changes easier to target without loading a 3000+ line file.
- No behavior change intended; this is a test organization pass only.

Validation:
- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- Targeted producer tests: 6 files / 44 tests passed.
- Full test suite verified in chunks: 107 files / 622 tests passed.
- `npm run build`

Notes:
- The full suite file count increased because the producer test was split into six files.
- The current full suite remains 622 tests; producer scenarios are preserved as 44 tests.
