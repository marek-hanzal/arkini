# 15 — Audio

**Status:** Queued

## Goal

Restore synth/audio feedback as a transient presentation consumer of engine events.

## Historical oracle

- `src/_archive/audio/`;
- event-specific sound decisions in producer, craft, stash, merge, space-navigation, and cheat paths.

## Do not port

- previous/current runtime diffing to rediscover events;
- audio state as gameplay state;
- blocking callback delivery on sound playback;
- duplicate event bus.

## Acceptance criteria

- audio consumes the existing event subscription;
- callback failure/rejected promises remain isolated;
- batches deduplicate or limit sounds deliberately;
- user gesture/browser audio constraints are handled in the presentation layer;
- missing audio never blocks engine progress.

## Required tests

- event-to-sound mapping, including `speed-mode:changed`;
- batch limits and deduplication;
- rapid completion groups;
- callback rejection isolation;
- session mount/unmount;
- mute/enable state if product requires it.

## Historical cleanup on closeout

Delete the historical audio tree after sound policy, synthesis, and tests are represented in the current presentation layer.
