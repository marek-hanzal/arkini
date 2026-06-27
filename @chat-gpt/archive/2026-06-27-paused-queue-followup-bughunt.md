# 2026-06-27 Paused queue follow-up bughunt

Focused on reachable queue/effect edge cases after introducing producer requirement pause/resume.

Findings:

- A queued job behind a producer job that later pauses is a valid runtime state. The earlier schema guard that rejected any job behind a paused previous job was too strict: the queue may have been legal before the head paused. Such jobs must wait behind the paused head and be rescheduled when the head resumes.
- Active effects from queued jobs behind a paused queue head must not start, apply, wake, or expire using stale queued `startAtMs`/`endAtMs`. They are not actually running while a paused earlier job blocks the queue.

Changes:

- Added `isProducerJobBlockedByPausedQueueHead` to central producer timing helpers.
- Excluded linked active effects from queued jobs behind paused heads from source reads, wake calculation, and expiration processing.
- Relaxed save/config queue validation to allow already queued jobs behind paused heads while keeping blocked delivery-on-non-head invalid.
- Added expectation tests for preserving queued jobs across pause/resume and suppressing stale queued active effects.

Validation:

- Full test suite passed with 426 tests.
