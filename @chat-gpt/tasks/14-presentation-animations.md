# 14 — Presentation events and animations

**Status:** Queued

## Goal

Build a presentation-only event-to-animation layer that may lag, redirect, coalesce, or skip work without ever becoming gameplay truth.

## Historical oracle

- `src/v0/play/game-engine-visual/`;
- animation parts of `src/v0/tile-engine/`;
- transient board tiles, stack/merge/drop feedback, memory effects, and timing constants.

## Core contract

```text
engine commits immediately
→ events describe what happened
→ presentation queues/redirects animation
→ canonical runtime may already be newer
```

Animation completion never gates commands, Tick, save, or event publication.

## Do not port

- previous save + current save diff as authoritative gameplay interpretation;
- visual stores that mirror runtime;
- event replay to newly mounted listeners;
- DOM motion state fed back into engine decisions.

## Acceptance criteria

- motion plans are presentation data only;
- later transitions can redirect in-flight motion;
- stale animations can be shortened/skipped safely;
- event batches preserve commit order per listener;
- merge, stack, replacement, removal, input transfer, completion, memory, and utility actions have deliberate feedback;
- canonical snapshot remains directly readable throughout.

## Required tests

- event-to-motion mapping;
- rapid successive transitions;
- redirect during movement;
- late subscriber receives no historical event;
- remove/replace/merge ordering;
- memory collect/distribute backlog;
- unmount/dispose cancels DOM work without touching engine state.

## Historical cleanup on closeout

Delete remaining historical visual planner and TileEngine motion code once equivalent behavior is covered.
