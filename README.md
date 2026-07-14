# Arkini

Arkini is a client-only, offline merge and production game built around a deterministic, data-driven engine. The current runtime slice fully backs production lines, jobs, queueing, output rolls, placement, state, save, and session boundaries; several authored item capabilities remain schema-only and are listed explicitly in `CONFIG.md` and `GAME.MD`. The repository is intentionally maintained with an LLM as the primary implementer, so documentation is part of the correctness boundary rather than decorative prose that slowly becomes compost.

**Product direction:** Marek

**Architecture, implementation, and documentation:** GPT-5.6 Thinking, professionally harassed into precision by Marek

## Current status

The engine, compiler, validator, binary packer, deterministic Tick model, jobs, queueing, reservations, placement, persistence boundary, and React session adapters are implemented and covered by the repository check gate.

No active browser entrypoint or deployment workflow is committed in this snapshot. A future renderer shell must be introduced against the current engine rather than reviving the archived application bootstrap.

The canonical runtime architecture is considered stable. Do not redesign it without a concrete requirement or reproduced defect.

The historical implementation under `src/v0` is reference-only. It is not a source of current architecture, naming, runtime, configuration, time, save, or UI decisions.

## Read this first

The active documentation surface is deliberately small. Read it in this order:

1. [`README.md`](README.md) — repository orientation, commands, and ownership.
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — canonical runtime, Tick, session, save, and UI boundaries.
3. [`CODE_GUIDE.md`](CODE_GUIDE.md) — mandatory code grammar and review rules.
4. [`CONFIG.md`](CONFIG.md) — game authoring, compiler, validation, schema, and packing.
5. [`GAME.MD`](GAME.MD) — implemented gameplay semantics.
6. [`@chat-gpt/README.md`](@chat-gpt/README.md) — LLM working-memory index and archive policy.
7. [`@chat-gpt/tasks/README.md`](@chat-gpt/tasks/README.md) — ordered behavior-recovery queue when continuing from historical code.

When documentation and implementation disagree, stop and resolve the contradiction. Do not quietly choose whichever version makes the current task easier.

## Path convention

Documentation writes engine source paths relative to the active source root. For example, `runtime/`, `tick/`, and `placement/` mean the corresponding directories in the active domain-oriented source tree.

This keeps documentation independent from the temporary parent directory used while the active tree is moved into the repository root.

## Architecture in one screen

```text
game source fragments + PNG resources
→ canonical compiler
→ schema + semantic + resource validation
→ compressed Arkini pack

loaded config + optional persisted state
→ hydrated runtime
→ serialized interruptible mutation planning
→ candidate validation
→ one STM committed transition
     runtime snapshot + transient events
→ canonical reads, listener-specific subscriptions, autosave, UI
```

The central rules are:

- one canonical committed runtime;
- every production write enters through the serialized runtime mutation path;
- runtime and transient events commit together;
- failed or interrupted planning commits nothing;
- Tick uses a fixed 200 ms simulation step and stores job time as `remainingMs`;
- UI may lag behind the canonical runtime for animation, but never becomes gameplay truth;
- persistence observes runtime identity, not transient event traffic;
- all exact identifiers use the single shared `IdSchema`;
- domain operations follow the mandatory `*Fx` grammar from [`CODE_GUIDE.md`](CODE_GUIDE.md).

## Source ownership

The active source tree is domain-first. Important areas are:

```text
common/       Shared primitive schemas and external-callback isolation.
compiler/     Source-fragment assembly and completed-config compilation.
event/        Transient event contracts committed with runtime changes.
game/         Effect services and layers for one loaded game/session.
input/        Input resolution, buffering, consume and reserve plans.
item/         Canonical item schemas and item reads.
job/          Active jobs, FIFO requests, start and completion behavior.
line/         Product-line rules, reads, resolution and run plans.
merge/        Directional item interaction authoring contracts; execution is pending.
output/       Output rules and result resolution.
pack/         Binary encode/decode and directory packing.
placement/    Stack, spawn, replace, scope and drop placement planning.
query/        Runtime item queries.
runtime/      Canonical runtime, committed-transition store and write boundary.
schema/       Completed game configuration root and JSON Schema generation.
start/        Initial board/inventory planning.
state/        Serializable state conversion.
tick/         Clock adapter and deterministic fixed-step advancement.
ui/           Thin React/session/save/event adapters only.
validation/   Schema-adjacent semantic and resource diagnostics.
when/         Runtime condition evaluation.
```

Do not introduce generic junk drawers such as `shared`, `utils`, `helpers`, or `services`. Ownership must remain visible from the path.

## Installation

The repository uses npm and commits `package-lock.json`.

```bash
npm ci
```

Use `npm install` only when intentionally changing dependencies and updating the lockfile.

## Required checks

Run the full gate before committing non-trivial work:

```bash
npm run check
```

It runs:

```text
Biome format check
→ Dependency Cruiser architecture rules
→ source TypeScript check
→ test TypeScript check
→ complete Vitest suite
```

Useful focused commands:

```bash
npm run format
npm run format:check
npm run dc
npm run typecheck
npm run test
```

## Game authoring commands

The default game source directory is `game/arkini`.

```bash
npm run game:schema
npm run game:validate
npm run game:pack
```

- `game:schema` writes the authoring JSON Schema to `game/schema.json`.
- `game:validate` runs the canonical compiler and all diagnostics.
- `game:pack` validates the same completed config, reads PNG resources, encodes MessagePack, compresses it with gzip, and writes `game/arkini.game.arkpack` by default.

The compiler, validator, tests, and packer must never assemble different versions of the game configuration.

## Working agreement

- Preserve `.git` in every shared repository snapshot.
- Never include `node_modules` in delivered ZIP files.
- Commit coherent slices instead of one giant cleanup blob.
- Keep active documentation current; move historical decisions and completed reviews under `@chat-gpt/archive/`.
- Do not cite archived documents as current contracts.
- Avoid architecture work without a concrete problem. Refactoring for the emotional satisfaction of moving boxes is still moving boxes.
