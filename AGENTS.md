# Arkini agent contract

Arkini is an offline, data-driven economy game and Editor. Work as a senior engineer and architect: prefer the smallest explicit design, keep ownership visible, and optimize code and documentation for future LLM comprehension. Engine code is the reference style.

## Operating rules

- Questions and analysis requests are read-only. Edit only on explicit implementation intent.
- Use current source and tests as evidence. Active contracts are [`README.md`](README.md), [`ARCHITECTURE.md`](ARCHITECTURE.md), [`GAME.MD`](GAME.MD), [`CONFIG.md`](CONFIG.md), and [`VERSION.md`](VERSION.md); GitHub Issues own backlog. History is not current authority.
- If code and an active contract disagree, stop and resolve the contradiction in the same change.
- Repository commands live only in [`Argcfile.sh`](Argcfile.sh). Run them through local `argc` (`argc typecheck`, `argc test [paths...]`, `argc check`); never infer npm scripts from history.
- Follow [`VERSION.md`](VERSION.md): readers gate on major only. Until the owner declares a stable baseline, add no migrations, legacy readers, obsolete-shape fixtures, or minor/patch-conditional paths unless explicitly requested.
- Accessibility-only work is out of scope: no ARIA, focus presentation, keyboard-only behavior, accessibility tests, or accessibility review unless requested. Preserve incidental semantics. Gameplay motion is intentional; do not add reduced-motion branches.
- Comments explain ownership, invariants, temporal boundaries, or why a simpler-looking design is wrong. Do not narrate syntax or preserve dead history.

## Architecture defaults

- One canonical runtime truth; React, Pixi, events, caches, and persistence never become mirrors.
- Domain-first ownership; no generic junk drawers or speculative frameworks. Root `shared/` is limited to immutable cross-process build metadata/limits, never domain behavior.
- Engine decisions stay in engine/domain operations. UI binds controls and renders projections.
- Use Effect where it clarifies operations, dependencies, concurrency, or lifecycle. Follow the mandatory grammar below.
- Prefer a linear concrete flow over adapters, registries, synchronization, and forwarding introduced for hypothetical reuse.

## Code grammar

- Every exported named project operation is an Effect program named `*Fx` in a same-named file. This includes reads, queries, validation, planning, conversion, compilation, and UI adapters even when synchronous or one line. Inline a trivial expression or use a private synchronous helper inside its owning operation file.
- Framework declarations keep framework grammar: React components and `use*` hooks, Effect Atom declarations, Zod schemas, Effect Context/Layer/error declarations, types, namespaces, constants, and inline callbacks are not project operations. Existing plain-operation violations are cleanup debt, not precedent or a reason to widen unrelated work.
- Prefer one exported concept per file. A concept has one domain owner; do not create catch-all barrels or `types.ts` piles.
- Reusable Arkini capabilities are readonly objects produced by explicit Effect factories. Do not add project-owned classes, constructor-injected repositories, managers, generic services, or adapters. Framework/external constructors remain valid.
- All exact identifiers use the shared `IdSchema`. Business schemas are strict unless unknown keys are deliberate and export `FooSchema`, `type FooSchema = typeof FooSchema`, and `namespace FooSchema { type Type = z.infer<FooSchema> }`.
- Effect services/Layers own real capabilities and lifecycles, not ordinary domain logic. Scoped fibers/resources belong to a Scope; production time/randomness use injected Effect services.
- Orchestrators read in domain order (`resolve → assert → plan → apply`) and own sequencing/transaction boundaries. Do not hide that order in generic pipelines or mutable mini state machines.
- Expected rejection is typed failure. Defects remain defects unless isolated at the correct external boundary; preserve observable error precedence.
- UI consumes semantic tokens and shared primitives (`src/ui/button`) instead of page-local copies. Use exhaustive matching for real state variants, focused ownership hooks for non-trivial lifecycle, and a stable `data-ui` marker on substantial DOM owners; Pixi does not create a DOM/ARIA gameplay mirror.
- Enforce imports with Dependency Cruiser, types/schemas with TypeScript/Zod, behavior with focused tests, and maintenance grammar by review. Never add source-text or custom-AST policy tests for names, calls, copy, token spelling, or topology.

## Tests

Tests are fast risk feedback, not a coverage project.

- Every test protects one named Arkini regression: a high-risk behavior, invariant, failure boundary, or lifecycle contract. If that regression cannot be stated, do not add the test.
- Test the authoritative lower layer. A higher-layer test must prove a distinct boundary risk such as admission, exact identity wiring, cancellation, stale-result suppression, destructive navigation, or settlement—not repeat engine/schema/selector facts through React DOM.
- Prioritize engine transactions, Tick, jobs, output, placement, merge ownership, persistence, compiler, and Arkpack integrity/trust/load/signing; then bridge concurrency; UI presentation last.
- Do not test copy, CSS/token spelling, markup inventories, visual tuning, framework behavior, trivial passthroughs, schema mechanics, enum membership, defaults, or permutations without distinct risk.
- Use the smallest representative synthetic fixture. Permanent tests must not depend on `game/arkini`, generated official snapshots, or platform packaging.
- Keep scenarios readable. Around 250 lines is a review signal; move non-trivial fixtures beside `Foo.test.ts` under `Foo.test/`, without a global fixture DSL.
- Search the owning suites first. Do not duplicate an existing proof; delete an older scenario when a new one subsumes it.
- Run the narrowest useful focused suite while implementing. `argc check`, build, hosted/platform delivery, and packaging are deliberate closing gates, not substitutes for focused feedback.

## Independent review

For substantial work, use read-only agents when useful:

- **Reviewer:** checks the touched boundary against this contract and its owning domain document.
- **Clean head:** explains the resulting design from minimal context and flags hidden mental load.
- **Code bloat:** looks for avoidable files, machinery, duplication, and oversized diffs.
- **Worker:** implements one bounded, explicitly owned slice.

Run at least one standalone read-only reviewer for substantial code or architecture changes. An implementation worker does not approve its own work. Reviews may validly conclude that no further change is needed.

A review is read-only unless implementation or external tracking is explicitly requested. Record `.git`, HEAD/baseline/range, dirty state, and toolchain; review the diff plus complete touched ownership boundaries. Each finding states contract, exact location, actual behavior, impact, evidence type, required behavior, and focused proof. Distinguish reproduced, generated-output observation, deterministic test, direct structural inference, and speculation (not a finding). P1 means release/security/data/canonical-truth/core-lifecycle blocker; P2 means material recoverable contract or maintenance defect. Ignore taste and hypothetical extensibility.

Validate focused → affected → broad as risk requires, using `argc`; report hangs, failures, skipped platforms, and generated/package smoke honestly. Preserve unrelated worktree changes and remove probes. If issue tracking is requested, search open/closed Issues before creating or duplicating anything.

## Product boundaries

The Game loads an Arkpack and runs the canonical gameplay engine. The Editor authors portable projects and provides Item editing, Assets, Board scenarios, Flow, Estimate, Versions, Notes, Build, and a project-scoped MCP server. Flow is the authored relation graph; Estimate is optimistic static dependency analysis, not runtime simulation.
