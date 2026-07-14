# Arkini LLM workspace

This directory is the private working-memory area for the primary implementation model.

## Required reading order

Before changing code, read:

1. `../README.md`
2. `../ARCHITECTURE.md`
3. `../CODE_GUIDE.md`
4. `../CONFIG.md` when touching authoring/compiler/validation
5. `../GAME.MD` when touching gameplay semantics
6. `CURRENT.md`
7. `tasks/README.md`
8. the one numbered task named by `CURRENT.md`

Do not begin with archived reviews. They explain history, not the current contract.

## Active files

```text
README.md       This index and maintenance policy.
CURRENT.md      Compact durable project memory and non-obvious decisions.
tasks/README.md Ordered task queue and continuation protocol.
tasks/COVERAGE.md Historical behavior coverage and pruning map.
tasks/NN-*.md Numbered vertical slices; read only the current task unless planning dependencies.
archive/        Historical reviews, plans, handoffs, and superseded notes.
```

The active surface must stay short. When a decision becomes canonical, merge it into the owning root document or `CURRENT.md`; do not leave another competing dated note in the root.

## Archive policy

Move a note to `archive/` when it is:

- a completed review;
- a superseded design;
- an implementation plan whose work is finished;
- a historical task queue;
- based on removed paths or architecture;
- useful only for archaeology.

Archived documents may contain obsolete terminology. Never treat an archived snippet as authoritative without checking active documentation and source.

## Repository workflow

The repository is exchanged as ZIP snapshots containing `.git`.

- Confirm `.git` before work.
- Continue from the provided snapshot rather than recreating history.
- Commit coherent work as it progresses.
- Never include `node_modules` in a delivered ZIP.
- Deliver a fresh ZIP and SHA-256 after completing repository work.
- Store project-specific notes here, not in random root scratch files.

## Review discipline

Every substantial implementation pass checks:

- architecture conformity;
- logical correctness and rollback;
- cancellation and resource ownership;
- engine/UI truth boundaries;
- unnecessary synchronization or data forwarding;
- LLM mental load;
- mandatory `*Fx` grammar.

Do not refactor stable core merely because another review cycle exists. Reviews are allowed to conclude that no code change is needed. Humanity will somehow survive the missing commit.
