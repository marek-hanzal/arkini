# 07 — Speed cheat

**Status:** Queued

## Goal

Implement the authored speed-cheat toggle while preserving the canonical fixed-step engine and keeping the choice outside gameplay truth where appropriate.

## Current engine facts

- speed-cheat schema and two visual assets exist;
- Tick obtains elapsed time through the session adapter;
- runtime Tick semantics are fixed-step and must not branch into a second scheduler.

## Historical oracle

- `src/v0/cheat/`;
- cheat actions/events/audio under `src/v0/action/`, `src/v0/event/`, and `src/v0/audio/`;
- board utility interaction under `src/v0/board/` and `src/v0/debug/`.

## Required design decision

Decide whether enabled speed mode is persisted gameplay state or session-only adapter state. The old implementation is not authoritative. The decision must make save/restore and asset projection explicit.

## Do not port

- wall-clock retiming of every active job;
- rewriting job timestamps;
- UI-owned toggle truth disconnected from the engine/session contract.

## Acceptance criteria

- toggle command/read model is explicit;
- normal and accelerated modes both feed the same fixed-step engine;
- changing mode never rewrites active job state;
- session disposal and save semantics are documented;
- visual asset selection is presentation projection only.

## Required tests

- toggle state transitions;
- active job continuity across toggle;
- deterministic results under equivalent elapsed budget;
- persistence or deliberate non-persistence;
- repeated toggles and session recreation.

## Historical cleanup on closeout

Remove historical cheat-speed action and timestamp-retiming code after UI/audio references are linked to tasks 13–15.
