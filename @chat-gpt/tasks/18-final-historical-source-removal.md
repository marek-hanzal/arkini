# 18 — Final historical source removal

**Status:** Queued

## Goal

Delete the remaining historical oracle after Tasks 10–17 have captured every required behavior, without changing active engine or UI behavior.

## Dependency

Task 17 must prove that the historical tree has no remaining oracle responsibility.

## Work

- delete the remaining `src/_archive` tree after its oracle responsibilities are exhausted;
- remove obsolete archive references and local markers from the task coverage map;
- verify active code, CLI, and tests never depended on archived modules;
- preserve Git history rather than copying historical code elsewhere;
- do not mix feature development into this final deletion.

## Non-goals

- no domain redesign;
- no naming campaign unrelated to removed parent prefixes;
- no facade/barrel introduction;
- no UI feature work;
- no config semantics changes.

## Acceptance criteria

- `src/_archive` no longer exists;
- every historical behavior retained by the product is represented in active code, tests, or documentation;
- complete check, game validation, and pack pass;
- Git diff is structurally explainable and behavior-neutral;
- migration task queue can be archived and replaced with ordinary feature work.
