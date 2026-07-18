# Arkini LLM workspace

This directory is the private working-memory area for the primary implementation model.

## Implementation reading order

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

## Review reading order

Independent implementation reviews start with [`REVIEW_CODEBOOK.md`](REVIEW_CODEBOOK.md) and follow its authority, scope, validation, evidence, GitHub, and reporting protocol. The local numbered implementation queue is not a review backlog and must not manufacture review work.

## Active files

```text
README.md           This index and maintenance policy.
REVIEW_CODEBOOK.md  Authoritative operating manual for independent implementation reviews.
CURRENT.md          Compact durable project memory and non-obvious decisions.
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

GitHub Issues are the active work tracker. Every root work item, simple or complex, uses `epic` + `chat-gpt`. Independently actionable child work uses `task` + `chat-gpt`; the root links every child and every child links back to its root.

## Review discipline

[`REVIEW_CODEBOOK.md`](REVIEW_CODEBOOK.md) is the authoritative protocol for independent Arkini reviews. In particular:

- review passes are read-only and do not create repository commits or modified ZIPs unless explicitly requested;
- findings and review history live in GitHub Issues, not a second active Markdown backlog under `@chat-gpt`;
- every review root uses `epic` + `chat-gpt` + `review`, and each independently actionable child uses `task` + `chat-gpt` + `review` + `P1|P2`;
- roots and children link bidirectionally;
- a clean review is recorded and closed instead of manufacturing refactors;
- stable architecture is protected as deliberately as defects are reported.

The codebook owns the full review invariants, evidence standard, validation matrix, false-positive checks, and issue workflow. Do not duplicate it into `CURRENT.md` or the numbered implementation queue.
