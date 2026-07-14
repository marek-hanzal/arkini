# 17 — Behavioral parity and historical pruning

**Status:** Queued

## Goal

Prove that all deliberately retained game behavior has a current owner, remove obsolete historical source, and leave no ambiguous “maybe still needed” area.

## Inputs

- completed tasks 01–16;
- `COVERAGE.md`;
- current root documentation and tests;
- historical Git history for archaeology only.

## Work

- audit every historical top-level directory;
- classify remaining behavior as implemented, deliberately rejected, or explicitly deferred beyond the migration;
- migrate only missing test scenarios with current APIs;
- delete all source with no remaining oracle value;
- delete local historical README markers as their directories disappear;
- remove stale dependencies, configs, assets, and ignore rules;
- run full authored-game validation and representative long gameplay flows.

## Acceptance criteria

- no historical directory remains without a named unresolved behavior;
- active documentation contains no reference to removed runtime architecture;
- all configured item types are either runtime-backed or explicitly rejected/deferred;
- no current tests depend on historical source;
- dependency graph and checks are clean;
- remaining historical tree, if any, is small and purpose-labelled.

## Required tests/audits

- full gate;
- game validation and pack;
- cross-feature flow tests;
- state round-trip across every runtime-backed capability;
- import/dead-code scan;
- active-document link and truth audit.
