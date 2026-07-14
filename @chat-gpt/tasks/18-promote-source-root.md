# 18 — Promote the active source tree

**Status:** Queued

## Goal

Remove the historical source tree and move the active domain tree into the repository root source layout without changing behavior.

## Dependency

Task 17 must prove that the historical tree has no remaining oracle responsibility.

## Work

- delete the remaining historical tree;
- move active domain directories from their temporary parent into `src/`;
- rewrite imports, TypeScript paths, CLI paths, tests, Dependency Cruiser rules, and documentation mechanically;
- regenerate schema/pack as needed;
- preserve Git history where practical;
- do not mix feature development into this move.

## Non-goals

- no domain redesign;
- no naming campaign unrelated to removed parent prefixes;
- no facade/barrel introduction;
- no UI feature work;
- no config semantics changes.

## Acceptance criteria

- source paths match active documentation directly;
- no temporary generation label remains in active paths or docs;
- complete check, game validation, and pack pass;
- Git diff is structurally explainable and behavior-neutral;
- migration task queue can be archived and replaced with ordinary feature work.
