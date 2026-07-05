# Visual/audio planner helper split pass

## Context

`src/play/game-engine-visual/createGameEngineVisualPlan.ts` and `src/audio/createGameAudioPlan.ts` were still large event-driven planner files. Each file mixed plan context creation, batch facts, event-family dispatch, per-reason handling, deferred/skipped event handling, and low-level plan writes.

The behavior was acceptable, but the mental cost was too high: every future visual or audio tweak required loading the whole event planner into your head like some cursed state-machine lasagna.

## Changes

- Reduced `createGameEngineVisualPlan.ts` to a thin visual planner orchestrator.
- Split visual planner props/context creation, ignored event detection, deferred removal handling, and event-family handlers into focused files under `src/play/game-engine-visual`.
- Kept visual event family behavior explicit: created, consumed, replaced, activation input, line completed, removed, and board memory events each have their own planner helper.
- Reduced `createGameAudioPlan.ts` to a thin audio planner orchestrator.
- Split audio planner props/context/flags, batch facts, static event sounds, created-item sound limiting, unique sound writes, line lifecycle/stash detection, and event-family handlers into focused files under `src/audio`.
- Preserved the existing plan behavior and tests. No shared generic abstraction was introduced between audio and visual planners, intentionally: same shape, separate domains.

## Validation

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test -- src/audio/createGameAudioPlan.test.ts src/play/game-engine-visual/createGameEngineVisualPlan.test.ts`
- `npm run test`
- `npm run build`
