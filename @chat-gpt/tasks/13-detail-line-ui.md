# 13 — Detail and line controls

**Status:** Queued

## Goal

Rebuild item detail, producer/craft/blueprint/stash controls, input state, progress, and queue feedback over engine-owned read models.

## Historical oracle

- `src/v0/item-detail/`;
- `src/v0/producer/view/`;
- `src/v0/board/view/`;
- sheet components under `src/v0/play/sheet/`;
- product copy and labels from historical UI.

## Do not port

- React calculation of `canStart`, visibility, missing input, output limit, or queue eligibility;
- parallel craft/producer UI truth;
- live wall-clock progress calculations from timestamps;
- hidden auto-fill mutations during reads.

## Acceptance criteria

- controls render from coherent engine reads;
- start/store/withdraw/default-selection commands are explicit;
- progress follows `remainingMs` and canonical Tick state;
- blocked reasons are stable and human-presentable;
- special item panels reflect implemented capabilities only;
- schema-only features are not shown as operational.

## Required tests

- producer, craft, blueprint, stash, and deposit detail states;
- ready/run/queued/paused/blocked/completed transitions;
- input fill/withdraw behavior;
- max-count and output-capacity messages;
- inventory pause;
- stale command rejection presentation.

## Historical cleanup on closeout

Delete historical item-detail and producer/craft view code after animation/audio tasks retain only presentation timing and sounds.
