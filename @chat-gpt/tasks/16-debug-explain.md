# 16 — Debug and explain tooling

**Status:** Queued

## Goal

Provide development diagnostics and human-readable explanations through public engine reads/commands, never direct runtime mutation.

## Historical oracle

- `src/v0/debug/`;
- historical explanation tests;
- action/test scenario ergonomics.

## Candidate capabilities

- spawn/remove development commands behind explicit development ownership;
- explain why a drop, input store, line start, completion, placement, or a cross-space operation is blocked;
- inspect canonical runtime issues and config diagnostics;
- reusable scenario/test ergonomics inspired by the historical `GameScenario` idea.

## Do not port

- save object editing from React;
- debug bypasses around runtime invariants;
- duplicate readiness logic;
- production-visible capability by accident.

## Acceptance criteria

- explanations derive from the same engine resolution used by commands;
- debug writes still enter the atomic mutation path;
- development-only exposure is explicit;
- scenario helpers do not know private state topology unnecessarily;
- no debug tool can create an invalid committed runtime.

## Required tests

- explanation/read agreement;
- blocked interaction cases;
- debug write invariant enforcement;
- development gating;
- scenario flow readability.

## Historical cleanup on closeout

Delete historical debug/explain code after all retained scenarios are covered.
