# Temporary lifetime closeout

Commit scope: Task 06 — temporary item lifetime

## Canonical contract

- authored temporary items define `durationMs`;
- each committed temporary runtime identity owns persisted `remainingDurationMs`;
- lifetime advances only in canonical 200 ms Tick steps;
- identities created during one step begin at full duration and first age on the next step;
- non-aligned durations expire at the first fixed-step boundary at or after the authored duration;
- ready temporary identities expire after job completion in stable runtime-ID order;
- expiry removes the item first and resolves optional output from the released board origin;
- expected placement failure rolls expiry back and leaves the item at `remainingDurationMs: 0` for a later retry;
- one deterministic random stream derived from the temporary identity covers both output resolution and random placement origin;
- save/restore persists the remaining duration and creates a fresh runtime revision;
- legacy state missing the runtime duration starts the temporary identity at its full authored duration.

Temporary lifetime is identity-bound state. Temporary items are therefore always impure and remain board-only.

## Runtime and validation

Added runtime invariants reject:

- temporary items missing `remainingDurationMs`;
- non-temporary items carrying temporary duration state;
- duration state above authored `durationMs`;
- temporary identities outside the board scope.

Expiry emits one committed `item:expired` event and never leaks an event from a rejected candidate.

## Historical cleanup

Removed the superseded persistent active-effect expiry and item-spawn scheduling implementation from `src/v0`. Historical label, interaction, animation, and audio references still needed by tasks 10 and 13–15 remain explicitly linked from those tasks.

## Verification

- formatter and format check passed;
- dependency graph passed with 554 modules, 2367 dependencies, and 0 violations;
- source and test typechecks passed;
- `game:validate game/arkini` passed;
- six test shards passed: 157 files, 480 tests;
- several initial Vitest shard processes again failed to exit cleanly, but conservative single-worker/fork retries produced complete green summaries with no test failures.

## Continuation

Task 07 — Speed cheat is Ready. It must accelerate elapsed budget entering the existing fixed-step Tick engine rather than rewrite jobs, temporary durations, or timestamps.
