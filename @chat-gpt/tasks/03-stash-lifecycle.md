# 03 — Stash lifecycle

**Status:** Ready

## Goal

Implement stash-specific completion: consume the stash owner and resolve its top-level authored output through the shared deterministic output and placement path.

## Current engine facts

- stash schema and authored chests exist;
- a stash line can start with normal material inputs;
- top-level stash output is not executed;
- the owner is not consumed by generic completion.

## Historical oracle

- `src/v0/stash/`;
- stash producer/completion cases under `src/v0/producer/` and `src/v0/engine/`;
- stash audio/visual handling under `src/v0/audio/` and `src/v0/play/game-engine-visual/`.

Historical behavior used producer depletion/replacement conventions. Preserve product behavior, not that representation.

## Do not port

- charges as hidden stash lifecycle state unless current product requirements genuinely need multiple uses;
- producer-specific save maps;
- replacement with arbitrary placeholder items as an architectural requirement;
- old auto-fill implementation.

## Open product decision to resolve inside this task

The schema gives the line no canonical output in current authored stashes and uses top-level `output`. Confirm and document whether stash completion always ignores `line.output`, or whether the schema should prohibit the ambiguous combination explicitly.

## Acceptance criteria

- stash top-level output resolves deterministically;
- owner consumption and output placement are atomic;
- blocked placement preserves owner, ready job, and reservations;
- input behavior uses the ordinary line path;
- no permanent stash-specific runtime map is introduced;
- UI-facing completion semantics can be represented by engine events later.

## Required tests

- guaranteed and chance stash output;
- blocked output retry;
- owner consumption exactly once;
- input auto-fill/store/start path where supported by public commands;
- state restore with active stash job;
- schema validation for ambiguous output ownership if prohibited.

## Historical cleanup on closeout

Delete `src/v0/stash` runtime code after retaining only product copy, animation, and audio references for tasks 13–15.
