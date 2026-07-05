# Producer line run state helper split pass

Commit: pending at time of writing.

## Goal

Continue the LLM-friendly refactor after producer realtime sync by reducing the next producer-facing view state hotspot: `src/producer/view/readLineRunState.ts`.

## Changes

- Kept `readLineRunState.ts` as a public facade/entrypoint.
- Split line run view state into focused helpers:
  - `LineRunStateTypes.ts`
  - `readLineRunFacts.ts`
  - `readLineRunInputAvailabilityLabel.ts`
  - `readLineRunStatusMetaLabel.ts`
  - `readLineRunProgressLabel.ts`
  - `readLineRunLabel.ts`
  - `createLineRunState.ts`

## Notes

This is a structural refactor only. No label text or branch behavior was intentionally changed. The split keeps the existing public import path stable and makes producer view-state debugging easier by separating facts, input hints, blocked labels, progress labels, and final state assembly.

## Validation

Ran:

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dupes`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- targeted producer view/control tests
- `npm run build`

Expected limited-deposit warnings remain in game validation.
