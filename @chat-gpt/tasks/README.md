# Ordered implementation queue

This directory is the active handoff surface for continuing the game from the historical implementation.

## Current task

**Next implementation task: [`10-engine-read-models.md`](10-engine-read-models.md)**

Tasks 00–09 are complete. A new thread must:

1. read the root documentation in the order defined by `@chat-gpt/README.md`;
2. read `@chat-gpt/CURRENT.md`;
3. read only the current numbered task and the relevant rows in [`COVERAGE.md`](COVERAGE.md);
4. inspect the referenced historical source as a behavioral oracle;
5. design the behavior in the current engine grammar instead of copying historical topology.

Do not read every queued task before starting. The queue is an ordered backlog, not a mandatory context dump.

## Queue

| # | Task | Status | Depends on |
| ---: | --- | --- | --- |
| 00 | [`Migration control surface`](00-migration-control.md) | **Done** | — |
| 01 | [`Craft lifecycle`](../archive/tasks/01-craft-lifecycle.md) | **Done** | 00 |
| 02 | [`Blueprint lifecycle`](../archive/tasks/02-blueprint-lifecycle.md) | **Done** | 01 |
| 03 | [`Stash lifecycle`](../archive/tasks/03-stash-lifecycle.md) | **Done** | 01–02 |
| 04 | [`Item charges and deposit inputs`](../archive/tasks/04-deposit-capacity.md) | **Done** | 03 |
| 05 | [`Directional merge execution`](../archive/tasks/05-merge-execution.md) | **Done** | 04 |
| 06 | [`Temporary item lifetime`](../archive/tasks/06-temporary-lifetime.md) | **Done** | 05 |
| 07 | [`Speed cheat`](../archive/tasks/07-speed-cheat.md) | **Done** | 06 |
| 08 | [`Multi-space board runtime`](../archive/tasks/08-multi-space-board-runtime.md) | **Done** | 07 |
| 09 | [`Destructive utility items`](../archive/tasks/09-destructive-utilities.md) | **Done** | 08 |
| 10 | [`Engine-owned read models`](10-engine-read-models.md) | **Ready** | 01–09 |
| 11 | [`Player interaction contract`](11-player-interaction.md) | Queued | 05, 10 |
| 12 | [`Renderer shell, board, and inventory`](12-renderer-board-inventory.md) | Queued | 11 |
| 13 | [`Detail and line controls`](13-detail-line-ui.md) | Queued | 10, 12 |
| 14 | [`Presentation events and animations`](14-presentation-animations.md) | Queued | 11–13 |
| 15 | [`Audio`](15-audio.md) | Queued | 14 |
| 16 | [`Debug and explain tooling`](16-debug-explain.md) | Queued | 10–15 |
| 17 | [`Behavioral parity and historical pruning`](17-parity-pruning.md) | Queued | 01–16 |
| 18 | [`Final historical source removal`](18-final-historical-source-removal.md) | Queued | 17 |

## Status transitions

Use only these statuses:

- **Ready** — next task with no unresolved dependency;
- **In progress** — currently owned by one implementation thread;
- **Blocked** — requires an explicit product or architecture decision;
- **Queued** — ordered work not started yet;
- **Done** — implementation, tests, documentation, and historical cleanup completed.

When starting a task:

1. mark it **In progress** here;
2. update `@chat-gpt/CURRENT.md` with the exact next action;
3. record newly accepted decisions in the task file;
4. do not create another competing plan document.

When closing a task:

1. satisfy its acceptance criteria and required tests;
2. update [`COVERAGE.md`](COVERAGE.md);
3. delete historical source that has no remaining oracle value;
4. update or remove local `src/_archive/**/README.md` markers;
5. move the completed task file to `@chat-gpt/archive/tasks/`;
6. promote the next task to **Ready** and update `CURRENT.md`.

## Migration rule

The historical implementation is a **behavioral oracle**, never an architectural donor.

Preserve deliberately selected:

- player-visible behavior;
- product decisions;
- edge cases;
- animation and audio intent;
- useful test scenarios;
- UI information requirements.

Do not copy by default:

- save topology;
- runtime mirrors;
- action bus or adapter layers;
- wall-clock job scheduling;
- old directory structure;
- UI-owned gameplay decisions;
- previous compiler conventions;
- subsystem-specific state maps.

Every feature is rebuilt as one vertical slice through the current grammar:

```text
schema or capability decision
→ validation
→ resolver
→ planner
→ apply
→ command or Tick lifecycle
→ runtime invariant
→ event
→ engine-owned read model
→ flow test
→ thin presentation adapter
```
