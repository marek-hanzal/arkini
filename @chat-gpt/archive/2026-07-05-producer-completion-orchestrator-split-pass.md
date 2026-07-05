# Producer completion orchestrator split pass

Commit: 18fa7d52

Goal: continue LLM-friendliness cleanup after the first producer completion helper split by turning `completeProducerJobFx` into a thin orchestration boundary.

Changes:
- Reduced `src/producer/completeProducerJobFx.ts` from ~585 lines to a tiny public entrypoint/program wrapper.
- Added `ProducerJobCompletionTypes` for shared completion scope, delivery item, and placement result/failure types.
- Split live job lookup, live line lookup/placement assertion, delivery item rolling, queue resume, no-output completion, delivery placement, placement success effects, success completion, failure/block routing, and live-job orchestration into focused producer files.
- Added `createMissingProducerJobResult` to `ProducerJobCompletionEvents` to keep missing-job result creation symmetrical with craft completion.

Rationale:
The previous pass extracted events and charge accounting, but the main completion file still mixed line validation, loot rolling, placement, blocked retry state, queue rescheduling, depleted-source replacement/removal, and final result assembly. This pass makes producer completion closer to the craft completion shape: public entrypoint -> live target -> blocked/success application helpers. The domain remains behaviorally identical, but future changes should now land in smaller files with clearer ownership.

Validation:
- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- targeted producer/runtime tests
- full test suite verified in blocks
- `npm run build`
