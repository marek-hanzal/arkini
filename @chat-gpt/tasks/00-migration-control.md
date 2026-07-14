# 00 — Migration control surface

**Status:** Done

## Goal

Create the durable handoff system used while behavior is recovered from the historical implementation.

## Completed work

- ordered numbered task queue;
- task handoff template and status rules;
- historical coverage and supersession map;
- local historical-source README markers;
- explicit behavioral-oracle policy;
- first safe historical deletion of standalone superseded tooling;
- `CURRENT.md` pointer to task 01.

## Permanent rules

- Never port a historical directory one-to-one.
- Never claim a feature exists because its schema validates.
- Every completed slice updates coverage and removes obsolete historical material.
- Current runtime, session, Tick, placement, input, queue, compiler, and save architecture are stable foundations, not migration candidates.
- Named project operations use Effect and the mandatory `*Fx` suffix.

## Closeout

This file remains active only as the migration protocol. It may move to the archive after task 18 removes the historical tree and the queue is no longer needed.
