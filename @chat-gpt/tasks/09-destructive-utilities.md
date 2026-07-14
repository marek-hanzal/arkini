# 09 — Destructive utility items

**Status:** Queued

## Goal

Implement the two authored destructive utility items with their already accepted product roles:

- the cheat-inventory board item consumes items dropped onto it through the ordinary removal path;
- the nuke opens an explicit confirmation and deletes the active persisted save before restarting a fresh session.

They are different ownership boundaries and must not be forced into one generic destructive-runtime abstraction merely because both delete something.

## Current engine facts

- both item schemas are markers only;
- generic item removal rejects protected job-scoped state and owners with active/queued work;
- owner removal already releases idle buffered inputs atomically;
- session save ownership exists, but no active browser shell or hard-reset command exists.

## Historical oracle

Cheat-inventory sink:

- board/drop handling under `src/v0/play/drop/`;
- utility-item activation under `src/v0/board/`;
- remove animation behavior under `src/v0/play/game-engine-visual/`.

Nuke:

- `src/v0/debug/NukeSaveSheet.tsx`;
- shell/sheet activation under `src/v0/play/` and `src/v0/board/`;
- browser storage reset behavior.

The historical `CheatInventorySheet` item-spawn catalogue is debug tooling for task 16, not the cheat-inventory item's gameplay behavior.

## Do not port

- direct save-object mutation from React;
- bypasses around runtime removal invariants;
- a generic “destroy anything” engine command;
- confusing persisted-save deletion with an atomic runtime board mutation;
- the debug spawn catalogue as behavior of the cheat-inventory item.

## Acceptance criteria

### Cheat inventory

- dropping an eligible item onto the utility consumes that item through a public atomic engine command;
- protected job-scoped items and busy owners follow current removal rules;
- the utility item itself remains intact;
- events provide removal feedback without creating a swap handoff;
- UI does not directly mutate runtime.

### Nuke

- tapping the nuke produces a presentation request for explicit confirmation;
- confirmation closes/disposes the active session, deletes persisted state through the storage boundary, and starts/reloads a fresh game;
- cancellation changes nothing;
- persistence failure is reported and does not pretend success;
- nuke behavior is not represented as a gameplay mutation of every live item.

## Required tests

- eligible and protected cheat-inventory drops;
- busy owner and buffered-input removal rules;
- no swap/merge semantics on the sink;
- nuke confirmation/cancellation;
- storage deletion success/failure;
- session disposal and fresh hydration;
- event/presentation mapping.

## Historical cleanup on closeout

Remove historical sink drop handling and nuke-save sheet/storage wiring after tasks 12, 14, and 16 capture the remaining shell, animation, and debug-spawn behavior.
