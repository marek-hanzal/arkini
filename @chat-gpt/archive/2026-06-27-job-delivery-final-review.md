# 2026-06-27 job delivery final review

Focused pass over world wake planning, producer/craft delivery retries, snapshot checks, and queue ordering.

Fixed issues:

- Producer save validation now rejects delivery retry metadata whose `lastBlockedAtMs` predates the job `readyAtMs`, matching the craft-side invariant that already existed.
- World snapshot validation gained a `job-delivery` check for producer/craft delivery retry timing and now reports stale active effects left linked to completed delivery-blocked producer jobs.
- Producer queues now reschedule following queued jobs from the real time a blocked delivery finally releases. This prevents queued jobs from time-traveling through a delivery-blocked queue head when the app wakes late.

Validation notes:

- `npm run format:check` passed with the known generated `game/arkini.assets.json` size warning.
- `npm run game:validate -- game/arkini` passed.
- `npm run dc` passed.
- `npm run typecheck -- --pretty false` passed.
- Full `npm run test` passed: 66 files, 449 tests.
- The combined `npm run check` reached the final Vitest phase after format/game validation/dependency cruise/typecheck passed, then timed out in this execution environment. The same full Vitest suite passed separately.
- `npm run audit:optional` passed: knip completed, jscpd found 0 clones.
