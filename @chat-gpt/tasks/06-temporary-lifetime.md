# 06 — Temporary item lifetime

**Status:** Ready

## Goal

Give temporary items canonical fixed-step lifetime state and expiry behavior without reviving the historical active-effect/timestamp subsystem.

## Current engine facts

- temporary schema defines board-only, non-stackable items, duration, and optional output;
- Tick already owns fixed-step elapsed replay;
- runtime has no temporary lifetime state;
- generic output and placement behavior exists.

## Historical oracle

- expiry behavior in `src/v0/effects/`;
- item-spawn/timed jobs in `src/v0/job/` and `src/v0/world/`;
- temporary-item events and visuals under `src/v0/event/`, `src/v0/play/`, and `src/v0/audio/`.

## Do not port

- wall-clock `startAtMs/endAtMs`;
- active-effect save maps;
- a generalized scheduler before concrete need;
- expiry mutation outside Tick;
- effect IDs as a second source of item truth.

## Required design decisions

Choose the smallest canonical representation, likely instance-owned remaining lifetime or an explicit runtime work record. It must survive save/restore and preserve fixed-step equivalence.

## Acceptance criteria

- lifetime begins at a precisely documented creation boundary;
- inventory is impossible by schema and runtime guard;
- Tick progression is deterministic and pause policy is explicit;
- expiry removal and optional output are atomic;
- blocked output has a deliberate retry policy;
- no generic active-effect subsystem is recreated.

## Required tests

- exact step boundaries;
- long elapsed equivalence;
- save/restore mid-lifetime;
- output/no-output expiry;
- blocked output retry or chosen alternative;
- multiple temporary items completing in stable order;
- creation during a step receives no retroactive time.

## Historical cleanup on closeout

Delete old persistent active-effect expiry and item-spawn scheduler code once any remaining effect labels are captured for tasks 10 and 13.
