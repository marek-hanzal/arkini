# 11 — Player interaction contract

**Status:** Queued

## Goal

Define the engine-facing interaction flow for tap, long press, drag, drop, swap, stack, merge, input store, and line start without allowing the renderer to own gameplay decisions.

## Historical oracle

- `src/_archive/tile-engine/`;
- `src/_archive/play/drop/` and `src/_archive/play/interaction/`;
- board/inventory drop and activation code;
- action schemas as a vocabulary catalogue.

## Required separation

```text
renderer owns pointer geometry and local gesture state
engine read owns accepted gameplay possibilities
engine command owns final authoritative mutation
presentation owns feedback and animation
```

A preview may become stale. Commit commands must re-resolve inside the runtime mutation boundary.

## Do not port

- a generic interaction engine that knows Arkini domain rules;
- central action bus merely for symmetry;
- dynamic callback registries as gameplay truth;
- readiness calls that mutate time;
- drag state persisted in runtime.

## Acceptance criteria

- all supported gestures map to documented public reads/commands;
- stale preview is safely rejected or redirected by command results;
- merge and stack remain distinct;
- interaction feedback has engine-owned reasons where domain-specific;
- pointer/hover/camera state stays presentation-only;
- no renderer waits on animation before engine mutation.

## Required tests

- drop onto empty, stack, swap, merge, blocked, and ignored targets;
- board/inventory crossing;
- stale revision during drag;
- target changes while animation lags;
- input store and line-start interactions;
- command result to presentation event mapping.

## Historical cleanup on closeout

Delete old action/drop/interaction orchestration once the renderer task has retained only generic pointer and geometry ideas.
