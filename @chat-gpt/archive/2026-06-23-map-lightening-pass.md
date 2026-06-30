# Map/lightening deep pass

Date: 2026-06-23

Goal: reduce short-lived lookup maps and mental overhead after the board race hardening pass.

Done:

- Replaced stored input quantity `Map` conversions with a plain `GameItemQuantityIndex` that matches save shape directly.
- Switched activation selected/required input sums from transient `Map` objects to quantity/requirement indexes.
- Flattened short-lived runtime maps in handoff tracking, visual cleanup grouping and auto-fill inventory reservation.
- Made runtime readiness wait for the mutation queue, so UI readiness checks do not read a stale save while dispatch/tick/replace is in flight.
- Shared board-input consumability in one helper, used by auto-fill planning and UI availability reads.
- Removed the no-op `buildGameConfigServiceFx` layer and inline-provided `GameConfigFx` where the engine needs contextual config.
- Removed repeated runtime config rebuilding from `RuntimeGameEngineAdapter.commit`; config is immutable runtime input.

Intentionally kept:

- TileEngine motion/drop/index maps. They are real runtime indexes and event/motion registries, not short-lived transform noise.
- Central `GameConfigSchema` and `GameSaveSchema` validation maps. They track first owners/counts and duplicate paths; keeping `Map` there avoids prototype-key weirdness and keeps validation error ownership explicit.
