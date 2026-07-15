# Arkini code guide

This document is mandatory. It is not a collection of optional style preferences.

All source paths are relative to the active source root.

## 1. The `*Fx` rule is absolute

Every named project operation anywhere in the repository, including engine, compiler, validation, configuration, CLI, runtime, domain, and UI-adapter code, must:

1. be expressed as an Effect program;
2. use a name ending in `Fx`;
3. live in a file with the same operation name.

This applies even when the operation is currently:

- deterministic;
- synchronous;
- pure-looking;
- one line long;
- used only once;
- free of dependencies today.

Examples of project operations include anything named or extracted to:

- read;
- query;
- resolve;
- validate;
- assert;
- plan;
- apply;
- create;
- revise;
- convert;
- compile;
- pack;
- select;
- roll;
- calculate;
- orchestrate gameplay or configuration data.

There is no exception for “this helper could stay pure.” Do not create a named plain function as an escape hatch. Inline a trivial expression or make it an Effect operation with `*Fx`.

Existing plain project helpers are cleanup debt, not precedent. Do not copy their shape into new code.

Private synchronous functions are allowed only as non-exported implementation details inside one Effect-operation file. Use them to keep hot collection loops local without creating a reusable plain-operation grammar. The exported project operation remains the same-named `*Fx` entry point, and architecture tests guard this boundary.

Framework-required declarations are not named project operations and retain their framework grammar:

- React components;
- React hooks beginning with `use`;
- Effect Context tags and Layer values;
- Zod schemas;
- TypeScript types, interfaces, namespaces, and constants;
- inline callbacks and inline expressions whose only purpose is implementing a surrounding Effect operation or framework declaration.

A reusable named projection, resolver, adapter, mapper, or formatter does not become exempt merely because UI calls it. Make it an Effect operation with `*Fx`, keep it inside a framework hook/component, or inline the trivial expression.

This boundary is categorical, not subjective. Do not write “maybe `Fx`” in review notes.

## 2. File and export grammar

Prefer one exported concept per file.

```text
resolveLineRunFx.ts
→ export const resolveLineRunFx

RuntimeSchema.ts
→ export const RuntimeSchema

ItemNotFoundError.ts
→ export class ItemNotFoundError
```

Do not create:

- `utils.ts`;
- `helpers.ts`;
- `types.ts` piles;
- catch-all barrels;
- generic service folders without domain ownership;
- files exporting several unrelated operations.

Small files are acceptable when they make domain grammar predictable. Do not inline them merely to reduce file count.

## 3. Domain ownership

Code is organized by the domain that owns the concept.

A shared-looking operation must still have an owner. If no domain clearly owns it, the design is not ready.

Do not add generic top-level buckets such as:

```text
shared/
utils/
helpers/
services/
core/
misc/
```

Primitive cross-domain schemas may live under `common/`, but domain behavior does not.

## 4. Identifiers

Every exact identifier uses the single shared `IdSchema`.

Do not create aliases or pseudo-domain wrappers such as:

```text
ItemIdSchema
LineIdSchema
JobIdSchema
AssetIdSchema
ResourceIdSchema
```

Domain ownership, uniqueness, and reference validity are checked by the owning schema, compiler, validator, or runtime boundary. The string value schema remains one canonical contract.

## 5. Schema pattern

Every business schema uses the standard export pattern:

```ts
export const FooSchema = z.object({ ... }).strict();

export type FooSchema = typeof FooSchema;

export namespace FooSchema {
  export type Type = z.infer<FooSchema>;
}
```

Rules:

- one schema concept per file;
- strict objects unless unknown keys are deliberately supported;
- discriminated unions for behavioral variants;
- Zod enums rather than duplicated TypeScript enum mirrors;
- meaningful `.describe()` or `.meta()` text on business contracts;
- no defaults unless the domain has a real default;
- no optional/null values unless absence is meaningful state;
- config and runtime contracts remain separate.

Do not introduce schema aliases merely to make a property name sound more domain-specific.

## 6. Runtime mutations

Every production gameplay write enters through `modifyRuntimeFx`.

A write operation must:

```text
resolve live entities inside the serialized boundary
→ plan against one pinned runtime snapshot
→ build a new candidate without in-place mutation
→ validate the complete candidate
→ return candidate runtime and transient events
```

Forbidden:

- direct store mutation;
- in-place mutation of committed arrays, objects, or item state;
- stale state-derived plans passed into a later write;
- detached live job or queue objects passed across command boundaries;
- publishing external events before commit;
- nested public write commands;
- a second gameplay cache or mirror.

Use stable IDs and resolve the live entity inside the owning mutation.

### Purity and identity-changing operations

Runtime purity is a composable boolean resolved from the current runtime draft. Line purity owns line input, active-job, and queue checks. Item purity composes every owned line and future item-specific state.

Generic stacking and quantity replacement may operate only on pure items. Evaluate purity inside the same `modifyRuntimeFx` candidate or internal immutable draft as the mutation, and re-check it at the authoritative apply boundary. Never read purity from one snapshot and carry the boolean into a later write.

Any write whose candidate would make an item non-pure while its quantity exceeds `1` must use the canonical owner-isolation operation inside that same candidate:

```text
attach state to the original board identity
→ revise the original identity to quantity 1
→ standard-place the pure remainder
→ validate and commit once
```

Input storage, line start, and partial charge spending are canonical callers. A fresh charged item remains pure while `remainingCharges` is absent; a partial spend stores identity-bound state and must isolate one board instance. Full idle depletion consumes one quantity in place because no changed identity survives. Inventory is passive storage: it may hold an already stateful owner, but no new identity-bound state is attached or spent there.

Board location is always explicit: `space + position`. Never accept a bare position at a spatial domain boundary and never infer or default a space. Board operations remain local to the supplied origin space; inventory is the only cross-space bridge. Callers place new quantities through canonical material placement and surviving live identities through `placeRuntimeItemFx`; do not add lifecycle-specific placement entry points.

Charge resolution and application are line-wide operations. Resolve payer identity per input, reserve charge budget by runtime item ID across all inputs, aggregate costs by payer, and spend each payer once inside the same candidate. Resolve idle full depletions before surviving stateful payers so capacity freed by the command is available to later isolation. Never let separate input previews overbook the same payer and rely on rollback as the first line of correctness.

### Future output and max-count

Every active job reserves the worst possible quantity of each canonical item its completion may create. This includes `line.output` and deferred `charges.output` for an owner already at zero charges. Resolve and assert that reservation inside the same candidate runtime that creates the job. Queue entries reserve nothing until dispatch. `clearItemJobQueueFx({ ownerItemId })` may remove all pending requests of one owner, but must never cancel active work, reinterpret resources, require item/request revisions, target individual stale request shapes, or silently discard blocked heads.

All later quantity-creating paths and runtime hydration must include active-job reservations in canonical `maxCount`: placement planners, direct spawn, direct quantity mutation, and runtime invariant checks all use the same reservation reader. Completion must remove its own ready job from the candidate before placing output so the job spends rather than duplicates its reservation. A depleted owner and job-owned consumed material offset worst-case output of their own canonical items by the quantities that will disappear. Immediate external depletion output is placed during start and must see the new job's future reservations. Do not use expected values, average chances, or one sampled roll as capacity planning.

Line completion is data-driven but lifetime is not a line property. Every item type uses optional `line.output`; optional item `charges` and input charge costs alone decide finite lifetime. A non-depleted owner remains. A depleted owner is removed before line output, then emits optional `charges.output`, releases owned inputs, and relocates reserved instances. Completion code must not switch on item type or reinterpret authored placement. Output placement supports only ordinary `drop` and `random`; do not reintroduce replacement as hidden item lifecycle.

Material `consume` is destructive conversion, not ordinary identity removal. Before start, the material remains an ordinary input item with all owned state intact. At authoritative start, discard its passive owned subtree without returning anything, commit only the consumed root to `job` scope, and remove that root at completion. Hydration must reject a consumed root that still owns descendants, work, job material, or queued intent. Passive-state discard must fail rather than silently cancel active jobs.

Material `reserve` moves the same live instance into `reserved` scope. Completion relocates that instance from the line owner's current board position without historical return metadata. Existing-item placement owns the generic distinction: pure items may normalize through normal stack/spawn placement and disposable identities; impure items preserve exact identity and complete state, cannot stack or split, and require one exclusive cell. Both material modes are one atomic candidate and failed later start or completion checks must restore the pre-transition ownership tree exactly.

Do not pass feature-specific exclusion IDs through generic placement or hide them in Effect Context. Put stack eligibility in the canonical purity predicate and state attachment in the canonical isolation operation. Do not create craft-, producer-, stash-, or blueprint-specific split variants.

## 7. Effects, services, and layers

Use Effect services for owned capabilities and lifecycle boundaries, not as ceremony.

- Context tags describe capabilities.
- Layers build capabilities.
- Scoped resources use `acquireRelease`, scoped Layers, or equivalent cancellation-safe ownership.
- Long-running fibers belong to a Scope.
- External callbacks are isolated from engine infrastructure.
- Production time comes from Effect Clock.
- Production randomness comes from Effect Random or a deliberately provided deterministic Random service.

Do not hide ordinary domain logic behind a generic repository/service abstraction.

## 8. Orchestrators

Orchestrators should read in domain order.

Good shape:

```text
resolve
→ assert
→ plan
→ apply
→ return
```

An orchestrator owns sequencing and transaction boundaries. Focused operations own local decisions.

Do not:

- maintain a mutable mini-state-machine inside an orchestrator;
- extract every line into a helper;
- create generic pipelines to eliminate harmless repetition;
- pass transport bags containing unrelated services, snapshots, and derived views;
- make readers chase several files to discover the commit order.

Prefer a little navigation over one function that requires tracking six mutable variables through twelve branches.

## 9. Errors and defects

Expected domain rejection uses typed failures.

Unexpected invariant violations may die, but only when the condition truly means the program is internally inconsistent.

Do not catch a defect and turn it into a normal gameplay result merely to keep a loop alive. Fix or isolate the correct boundary.

Error precedence is observable behavior. Refactors must preserve it unless the change is deliberate and tested.

## 10. UI boundary

UI is a presentation adapter.

Allowed:

- `useSyncExternalStore` over the canonical session snapshot;
- public engine commands and reads;
- transient-event reactions for animation, audio, and telemetry;
- local presentation state;
- pure visual projections.

Forbidden:

- gameplay state in React state or refs;
- snapshot synchronization through `useEffect`;
- line eligibility, missing input, queue, reservation, drop, or job logic in UI;
- reconstruction of runtime from events;
- imports from engine-internal modules;
- a second read-model API without a concrete need.

Presentation may lag runtime. Presentation is never authoritative.

## 11. Configuration and compiler

Game source files are authoring fragments, not runtime truth by themselves.

All consumers use the canonical completed-config compiler. Tests, validation, and packing may not assemble their own variation.

Duplicate providers and duplicate record keys are diagnostics. Later files never silently overwrite earlier files.

Never infer exact resource or item references from naming conventions when the schema requires an explicit ID.

## 12. Comments and documentation

Comments explain invariants, temporal boundaries, non-obvious ownership, or reasons a simpler-looking design is wrong.

Comments must not:

- narrate obvious syntax;
- describe removed implementations;
- promise unimplemented features;
- cite archived architecture as current;
- use historical primitive names after the boundary has changed.

When architecture changes, update active documentation in the same slice. A stale LLM-facing comment is a behavior bug waiting for confidence.

## 13. Tests

Tests should exercise public or canonical boundaries whenever practical.

For gameplay flows:

```text
build valid config
→ create live runtime through normal commands
→ fill inputs through normal paths
→ start or queue work through the public command
→ advance deterministic elapsed time
→ assert complete runtime/state outcome
```

Permanent tests should protect:

- atomicity;
- cancellation and resource cleanup;
- error precedence;
- FIFO and reservation invariants;
- before/after subscription semantics;
- long Tick equivalence;
- save isolation;
- dependency direction.

Do not rely on timing roulette when a deterministic `Deferred`, Scope, or service seam can express the boundary.

## 14. Review gate

Every significant review checks:

1. conformity with the canonical architecture;
2. logical correctness and rollback behavior;
3. temporal and cancellation semantics;
4. engine/UI source-of-truth boundaries;
5. unnecessary synchronization or data forwarding;
6. LLM mental load;
7. adherence to the mandatory `*Fx` grammar.

Reject architecture work performed only to manufacture review output. The goal is a system that is easier to change correctly, not a larger diagram.
