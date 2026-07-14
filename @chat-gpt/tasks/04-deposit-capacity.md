# 04 — Deposit capacity and inputs

**Status:** Queued

## Goal

Add finite deposit capacity as canonical live item state, support deposit inputs, spend capacity at the chosen lifecycle boundary, and resolve depletion output atomically.

## Current engine facts

- deposit item and deposit-input schemas exist;
- validation understands authored references;
- runtime input resolution rejects deposit inputs explicitly;
- runtime items do not yet own deposit capacity;
- shared output and placement machinery exists.

## Historical oracle

- `src/v0/capacity/`;
- deposit-related producer cases under `src/v0/producer/`;
- configured deposit behavior under `src/v0/config/`;
- capacity feedback and detail behavior under `src/v0/board/`, `src/v0/item-detail/`, and `src/v0/play/`.

## Required design decisions

Resolve explicitly before coding:

- capacity belongs to the live deposit item, not a parallel map;
- whether capacity is reserved/spent at job start or completion;
- how multiple matching deposits are selected deterministically;
- whether partial capacity from multiple deposits may combine;
- what happens when a selected deposit moves or disappears;
- depletion removal/replacement/output semantics.

Do not inherit these decisions accidentally from old save maps.

## Do not port

- separate item-capacity state tables;
- location references treated as durable ownership;
- mutation of capacity outside the atomic runtime path;
- UI-side capacity eligibility calculations.

## Acceptance criteria

- live capacity survives state save/restore;
- deposit input planning is deterministic and all-or-nothing;
- spending and job lifecycle cannot diverge;
- generic item commands respect deposit/job ownership rules;
- depletion output uses standard placement;
- blocked depletion completion is retry-safe;
- runtime invariants detect invalid capacity.

## Required tests

- exact and bounded capacity spend;
- insufficient capacity;
- competing owners using the same deposit;
- deposit move/removal guards;
- depletion with and without output;
- blocked depletion output retry;
- state round-trip and invariant failures;
- full line flow using authored deposit input.

## Historical cleanup on closeout

Remove `src/v0/capacity` and deposit-specific old producer paths after presentation requirements are linked to tasks 10, 13, and 14.
