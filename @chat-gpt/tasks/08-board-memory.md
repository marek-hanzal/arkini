# 08 — Board memory

**Status:** Ready

## Goal

Implement board-layout memory as an explicit atomic engine capability with clear loss/capacity semantics and presentation events.

## Current engine facts

- memory item schema and empty/full assets exist;
- board/inventory locations, placement, state persistence, and atomic mutation exist;
- no memory payload or commands exist.

## Historical oracle

- `src/v0/board-memory/`;
- debug explanations under `src/v0/debug/explain/`;
- memory UI/feedback/audio under `src/v0/debug/`, `src/v0/play/`, and `src/v0/audio/`.

## Product behavior to preserve unless deliberately changed

- empty memory captures a layout;
- filled memory restores it and then clears;
- inventory-backed restoration behavior is explicit;
- capacity shortfall and item loss policy are visible, tested decisions;
- memory item identity/location participates in the snapshot contract.

## Do not port

- separate board-memory save tables if the payload can be owned by the live memory item/state model;
- UI-driven restore planning;
- original-instance restoration assumptions that conflict with current identity rules;
- multi-stage mutations outside one runtime command.

## Acceptance criteria

- capture and restore are atomic commands;
- memory payload persists through state save/restore;
- busy/job-scoped item policy is explicit;
- capacity and loss behavior is deterministic;
- a used memory clears exactly once;
- engine emits enough facts for lagging collect/distribute animation without waiting for it.

## Required tests

- empty capture;
- restore with board-only and inventory-backed items;
- capacity shortfall policy;
- jobs, inputs, reservations, and utility-item edge cases;
- memory moved between board/inventory;
- state round-trip;
- repeat use and clear.

## Historical cleanup on closeout

Delete historical board-memory runtime and debug explanation code after tasks 14 and 16 capture presentation/explanation requirements.
