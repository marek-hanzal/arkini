# 02 — Blueprint lifecycle

**Status:** Queued

## Goal

Complete construction by atomically replacing the blueprint owner with its configured `targetId` and placing any authored additional output.

## Dependency

Task 01 must first establish the smallest proven pattern for owner-specific job completion.

## Current engine facts

- blueprint schema, target ID, explicit asset tuple, construction line, and optional output exist;
- line execution, inputs, queue, Tick, and replacement-aware placement primitives exist;
- generic completion currently ignores `targetId` and top-level blueprint output.

## Historical oracle

- blueprint-specific producer tests under `src/v0/producer/`;
- replacement safety in `src/v0/world/`;
- item replacement events and visuals under `src/v0/play/game-engine-visual/`;
- blueprint detail/read models under `src/v0/item-detail/` and `src/v0/play/game-engine-bridge/`.

## Do not port

- producer charge state used to model one-shot construction;
- old replacement-safety tables;
- hidden asset naming inference;
- wall-clock completion and world passes.

## Intended vertical slice

```text
ready blueprint job
→ resolve live blueprint and target
→ plan exact same-cell replacement
→ resolve optional by-products
→ place everything atomically
→ remove job and dispatch successor
→ emit replacement/completion events
```

## Acceptance criteria

- the target replaces the blueprint at the exact owner location;
- target identity/revision semantics are explicit and tested;
- optional output is all-or-nothing with target replacement;
- blocked by-products do not partially replace the blueprint;
- max-count and invalid target failures remain domain failures;
- retry remains deterministic;
- explicit blueprint and target assets remain authoring-only visuals, not runtime inference.

## Required tests

- target-only completion;
- target plus by-products;
- blocked by-product placement rollback;
- max-count rejection;
- owner revision and location preservation rules;
- queue successor at replacement boundary;
- state round-trip during construction.

## Historical cleanup on closeout

Remove historical blueprint completion/runtime paths and replacement-safety machinery after animation/read-model needs are linked to tasks 13–14.
