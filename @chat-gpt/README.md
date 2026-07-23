# Arkini LLM instructions

This directory contains narrowly scoped, durable instructions for implementation and review. It is not a project-status surface.

## Reading order

Before changing the repository, read the canonical contracts that own the affected area:

1. [`../README.md`](../README.md)
2. [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
3. [`../CODE_GUIDE.md`](../CODE_GUIDE.md)
4. [`../CONFIG.md`](../CONFIG.md) for authoring, compiler, schema, validation, or packing work
5. [`../GAME.MD`](../GAME.MD) for gameplay semantics

Use [GitHub Issues](https://github.com/marek-hanzal/arkini/issues) as the only active backlog and continuation map. Do not create a local roadmap, current-status file, handoff queue, or replacement planning surface.

## Durable local surface

```text
README.md           This instruction and ownership index.
REVIEW_CODEBOOK.md  Authoritative protocol for independent implementation reviews.
tasks/              Temporary historical-migration evidence; never an active queue.
archive/            Temporary non-authoritative archaeology pending migration closeout.
```

When an architecture or gameplay decision becomes canonical, put it in the owning root document and cover executable behavior in source and tests. Work status, dependencies, review findings, and follow-up tasks belong in GitHub Issues.

## Review discipline

Independent implementation reviews follow [`REVIEW_CODEBOOK.md`](REVIEW_CODEBOOK.md). Review findings and review history live in GitHub Issues, not another Markdown backlog.

## Historical oracle policy

Historical files may explain prior player-visible behavior, UX, copy, edge cases, animation or audio intent, and useful test scenarios. They never override root documentation, active source, tests, or current GitHub issue decisions, and they are never an architectural donor.

The temporary migration evidence under [`tasks/`](tasks/README.md), [`archive/`](archive/README.md), and [`../src/_archive`](../src/_archive/README.md) exists only while [#263](https://github.com/marek-hanzal/arkini/issues/263), [#264](https://github.com/marek-hanzal/arkini/issues/264), and [#265](https://github.com/marek-hanzal/arkini/issues/265) finish parity classification and historical-source retirement. Git history is the durable archive.
