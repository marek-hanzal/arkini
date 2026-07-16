# 13 — Detail and line controls

**Status:** Queued

## Goal

Rebuild item detail, producer/craft/blueprint/stash controls, input state, progress, and queue feedback over engine-owned read models.

## Historical oracle

- `src/_archive/item-detail/`;
- `src/_archive/producer/view/`;
- `src/_archive/board/view/`;
- sheet components under `src/_archive/play/sheet/`;
- product copy and labels from historical UI.
- temporary/effect labels retained under `src/_archive/effects/readNearbyLineEffectLabel.ts`, `src/_archive/effects/readRuntimeLineEffectLabel.ts`, and `src/_archive/effects/readEffectiveLineBonusEntries.ts`; do not reconstruct the removed active-effect save/timestamp lifecycle.

## Do not port

- React calculation of `canStart`, visibility, missing input, output limit, or queue eligibility;
- parallel craft/producer UI truth;
- live wall-clock progress calculations from timestamps;
- hidden auto-fill mutations during reads.

## Acceptance criteria

- controls render from coherent engine reads;
- start/store/withdraw/default-selection commands are explicit;
- pending queue requests can be cleared as one explicit owner action while active jobs remain non-cancellable;
- progress follows `remainingMs` and canonical Tick state;
- blocked reasons are stable and human-presentable;
- special item panels reflect implemented capabilities only;
- a speed-cheat control toggles the global root speed mode directly and renders accelerated/normal assets from engine-owned presentation facts, never item-local state;
- schema-only features are not shown as operational.

## Required tests

- producer, craft, blueprint, stash, and deposit detail states;
- ready/run/queued/paused/blocked/completed transitions;
- input fill/withdraw behavior;
- max-count and output-capacity messages;
- inventory pause;
- stale command rejection presentation;
- speed toggle and consistent asset projection across all speed-cheat item instances.

## Historical cleanup on closeout

Delete historical item-detail and producer/craft view code after animation/audio tasks retain only presentation timing and sounds.
