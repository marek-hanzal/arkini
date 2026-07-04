# 2026-07-04 stored input boundary pass

Commit: stored input boundary pass

Goal: continue the post-logic-folder cleanup by centralizing producer/craft stored input state lifecycle writes after job write/remove and active-effect boundaries were centralized.

Changes:

- Added producer input state boundaries for creating line input state, pruning empty line/producer state, and removing producer input state during board-item runtime cascade cleanup.
- Added craft input state boundaries for creating/writing/pruning/removing craft input state.
- Rewired producer/craft store, withdraw, consume, craft start, and board-item runtime cleanup paths to use those boundaries instead of raw `save.producerInputs[...]`, `lineInputs[...]`, or `save.craftInputs[...]` writes/deletes.
- Tightened `audit:current` so raw production stored-input writes/removals are rejected outside the named boundaries.

Rationale:

Stored activation input quantities were already centralized, but the parent save maps still had direct lifecycle writes in multiple runtime routes. Keeping map ownership behind named Fx boundaries makes future metadata/invariants grepable and prevents producer/craft input flows from growing parallel state routes again.
