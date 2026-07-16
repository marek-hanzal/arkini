# 14 — Presentation events and animations

**Status:** Queued

## Goal

Build a presentation-only event-to-animation layer that may lag, redirect, coalesce, or skip work without ever becoming gameplay truth.

## Historical oracle

- `src/_archive/play/game-engine-visual/`;
- animation parts of `src/_archive/tile-engine/`;
- transient board tiles, stack/merge/drop feedback, space-navigation feedback, and timing constants.

## Core contract

```text
engine commits immediately
→ events describe what happened
→ presentation queues/redirects animation
→ canonical runtime may already be newer
```

Animation completion never gates commands, Tick, save, or event publication.

The current bridge snapshot is always the motion target. A plan may never finish against a stale environment merely because it started first. When canonical identity/revision, destination geometry, current space, layout, or complete `Game` instance changes, the coordinator samples the current visual state, cancels the stale plan, and replans toward the newest live target. Presentation may lag; truth may not be queued.

## Do not port

- previous save + current save diff as authoritative gameplay interpretation;
- visual stores that mirror runtime;
- event replay to newly mounted listeners;
- DOM motion state fed back into engine decisions.

## Acceptance criteria

- motion plans are presentation data only;
- later transitions, layout changes, and target relocation can redirect in-flight motion from its current visual state;
- stale animations can be shortened/skipped safely;
- event batches preserve commit order per listener;
- merge, stack, replacement, removal, input transfer, completion, space navigation, and utility actions have deliberate feedback;
- canonical snapshot remains directly readable throughout and is the only authoritative animation target;
- complete `Game` replacement cancels every old pointer, node, ghost, and animation resource.

## Required tests

- event-to-motion mapping;
- rapid successive transitions;
- redirect during movement without teleporting back to the previous layout origin;
- target relocation or resize while motion is active;
- late subscriber receives no historical event;
- remove/replace/merge ordering;
- current-space transition backlog;
- unmount/dispose cancels DOM work without touching engine state.

## Historical cleanup on closeout

Delete remaining historical visual planner and TileEngine motion code once equivalent behavior is covered.
