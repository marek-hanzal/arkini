# Arkini code guide

This document is mandatory. It is not a collection of optional style preferences.

Engine paths are relative to `src/engine` unless written explicitly. `src/bridge/<domain>/<operation>` is the only legal React-to-engine connection. Reusable presentation and transient interaction code lives under `src/ui`; route-level visual composition lives under `src/page`; TanStack Router registration plus `beforeLoad`/loader/redirect/context orchestration lives under `src/@routes`. `electron/` is the explicit main/preload platform boundary and may not import renderer or engine roots; renderer code may not import Electron.

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

Private synchronous functions are allowed only as non-exported implementation details inside one Effect-operation file. Use them to keep hot collection loops local without creating a reusable plain-operation grammar. The exported project operation remains the same-named `*Fx` entry point. This is a documented implementation and review rule, not a source-text test contract.

Framework-required declarations are not named project operations and retain their framework grammar:

- React components;
- React hooks beginning with `use`;
- TanStack `queryOptions` / `mutationOptions` declarations and their natural React hooks;
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

### Object and factory composition

Arkini-owned reusable capabilities use readonly objects created by explicit Effect factories. Do not introduce project-owned classes, constructor-injected repositories, managers, services, adapters, or `new ProjectThing(...)` composition. State and dependencies belong in the closure of the owning factory; public behavior is exposed through narrow `*Fx` capability fields.

External and framework constructors remain valid where their API requires them. Effect declaration forms such as `Data.TaggedError`, `Context.Tag`, and framework-owned classes are not project composition abstractions. Do not mechanically replace constructor injection with Layers or generic services unless a real scoped capability exists.

### Asynchronous UI and Game lifecycle boundaries

React never owns canonical gameplay state, runtime reads, persistence truth, catalog truth, or domain lifecycle semantics. React-visible asynchronous commands use feature-owned Effect Atoms. A standalone operation may expose its `Atom.fn` `AsyncResult` directly. A surface that must synchronously exclude sibling commands or survive an allowed React remount exposes one domain-specific writable command Atom backed by a private `Atom.fn` runner and one tagged state; React must not reconstruct that ownership with refs, local booleans, or result-identity effects. The renderer-wide live Game is owned by one scoped Effect service in `RendererRuntime`:

```text
GameEngineResourceFx
→ one explicit renderer-process state machine
→ one lifecycle semaphore
→ scoped acquisition leases
→ exact adoption, replacement, release, reset and failed-save recovery

/action/load-game/$packageId loader
→ acquire a scoped lease
→ keep provisional ownership through the complete action hold
→ adopt that exact lease before its Scope closes

/game/$packageId beforeLoad
→ read the exact adopted resource
→ expose the exact Game/resource through inherited route context

useGameEngine
→ typed inherited-route-context adapter
→ never create or mirror gameplay state

PlayableGameRoute
→ mount GameAudio and CheatItemSpawnProvider only for Board/Cheats pages
→ never mount gameplay observers around leave/reset/exit action routes
```

`GameEngineResourceFx` owns renderer-wide object identity and same-package single-flight only. `GameSession` remains the canonical runtime/save owner. Explicit named route operations release or reset the exact adopted resource, while native controlled close atomically claims pending acquisition and joins any terminal operation already finalizing that resource. Acquisition, destructive cleanup, save recovery, and service shutdown continue under the service Scope even if an individual route caller is interrupted. Application state is not handed off or preserved across HMR. Do not add React providers, component effects, cache entries, WeakMaps, module locals, or UI observers as competing Game lifecycle owners, and never allow UI components to create/reload the Game.

Ordinary asynchronous UI commands stay standalone in their owning UI domain:

```text
saveGameAtom(exact Game)
→ Atom.fn command
→ game.runFx(RuntimeSaveFx.flush)
→ AsyncResult consumed by the owning UI
```

`Atom.fn` owns Effect execution, cancellation, typed failures, defects, and interruption. A writable command authority may project that runner into one tagged domain state, but the runner's `AsyncResult`, a React ref, and a local action owner may not become additional public truths. Registry-owned authorities use keep-alive only when their command must survive React remounts; Game-bound commands remain subscription-scoped so leaving the owning screen interrupts them. Blocking lifecycle commands are not component-mounted Atoms. They are explicit `action/*` leaf route loaders that consume inherited TanStack Router context; their pending/error pages only render presentation. Do not create a central command-key object, generic command factory, callback-injection adapter, lifecycle command manager, or project-specific wrappers around Atom hooks. Keep navigation, menu visibility, and other caller-specific success behavior at the composition site unless the route itself is the lifecycle boundary.

### Enforcement strategy

Use the narrowest mechanism that proves the actual contract:

- dependency direction and import isolation → Dependency Cruiser;
- runtime, lifecycle, security, persistence, and UI behavior → focused public tests;
- packaged renderer and release contracts → tests against generated output or artifacts;
- type and schema validity → TypeScript, Zod, compiler, and validation tests;
- code grammar and maintenance conventions in this guide → implementation review.

Do not add source-text recurrence tests for naming, exact calls, UI copy, file counts, class names, token usage, or current implementation snippets. Do not replace such tests with a custom AST policy engine. A harmless refactor must not fail because spelling changed while architecture and behavior stayed correct. Add automation only when it observes a stable dependency, type, schema, behavior, or generated-output contract.

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

Input storage, line start, and partial charge spending are canonical callers. A fresh charged item remains pure while `remainingCharges` is absent; a partial spend stores identity-bound state and must isolate one board instance. Full idle depletion consumes one quantity in place because no changed identity survives. Inventory and Toolbar are passive storage: either may hold an already stateful owner, but no new identity-bound state is attached or spent there.

Board location is always explicit: `space + position`. Never accept a bare position at a spatial domain boundary and never infer or default a space. Board operations remain local to the supplied origin space; Inventory and Toolbar are the only global passive-storage bridges between Board spaces. Callers place new quantities through canonical material placement and surviving live identities through `placeRuntimeItemFx`; do not add lifecycle-specific placement entry points.

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

`src/engine` is standalone and framework-neutral. `src/bridge` owns concrete live adapters and snapshot projections grouped as `bridge/<domain>/<operation>`; it may use public engine modules but never engine internals or UI. `src/ui` owns reusable presentation and transient gesture/geometry/animation state. `src/page` composes route-level screens from UI components and may not access bridge or engine contracts directly. `src/@routes` owns TanStack registration plus route lifecycle orchestration; it may render page/UI surfaces and call public bridge capabilities, but never imports the engine or another route module. Renderer dependencies form the DAG `@routes → {page, ui, bridge}`, `page → ui`, `ui → bridge`, and `bridge → engine`. `electron/` owns only actual Electron main/preload/protocol capabilities and is not part of that chain. Do not import renderer/game modules into Electron or Electron/Node APIs into renderer domains.

Allowed:

- `useSyncExternalStore` over the canonical session snapshot;
- public engine commands and reads exposed through concrete bridge domains;
- transient-event reactions for animation, audio, and telemetry;
- local presentation state;
- pure visual projections.

Forbidden:

- gameplay state in React state or refs;
- snapshot synchronization through `useEffect`;
- line eligibility, missing input, queue, reservation, drop, or job logic in UI;
- reconstruction of runtime from events;
- direct UI imports from any engine module or bridge imports from engine internals;
- a second read-model API without a concrete need.

Presentation may lag runtime. Presentation is never authoritative.

### Component ownership and exhaustive UI decisions

A non-trivial React component normally has this shape:

```text
props
→ a small number of focused ownership-specific hooks
→ direct attributes and markup
```

Named `use*` hooks own effects, timers, focus and pointer lifecycle, async command or navigation orchestration, Motion coordination, and non-trivial presentation projection. Each hook owns one concrete concern. Do not move a component body wholesale into one equally large `usePageModel`, `useFoo`, manager, registry, or generic UI framework merely to make the JSX file shorter. Markup, simple event forwarding, direct attributes, and small local booleans remain in the component.

Use `ts-pattern` with `.exhaustive()` for discriminated unions, phase or outcome combinations, mutation/catalog/startup status variants, and other decisions where adding a new variant must produce a compile error. Nested ternary chains may not encode a state machine. Ordinary booleans remain appropriate for optional images, binary classes, disabled attributes, simple labels, and other genuinely two-way presentation choices. Do not wrap trivial conditions in `match()` as ceremony.

UI-owned discriminated state and reusable presentation vocabularies may use the same canonical Zod schema pattern as engine domains. Place them under the owning UI domain, for example `src/ui/<domain>/schema/FooSchema.ts`, and infer TypeScript types from that schema. Do not duplicate a schema-backed union independently across components, and do not introduce runtime schemas for one-off booleans that have no shared contract.

UI may own gesture facts, pointer geometry, hover and focus, menu visibility, pending or error presentation, and frozen source/target facts for one gesture. These are presentation workflow data. UI may not own copied canonical item locations or revisions as a continuously synchronized truth, command validity, readiness, placement viability, queue or job state, or a full live runtime projection maintained beside the engine. Live tile actors render directly from the bridge projection. A removed runtime identity leaves the canonical actor registry and hit testing immediately; an already-detached, non-interactive exit paint may finish briefly under Motion without becoming a hidden canonical actor.

Enforce these conventions through types, discriminated schemas, exhaustive matching, focused behavior tests, dependency rules, and implementation review. Do not add source-text or custom AST guardrails for hook names, component line counts, `match()` spelling, ternary counts, or file topology.

Tile dragging is renderer-native under `src/ui/pixi`. One full-viewport main scene owns Board and Toolbar; the Inventory modal owns one isolated scene because Pixi display objects cannot cross canvases. Within a scene, the visible static tile and dragged tile are the same retained display object keyed by exact runtime item ID. Inventory release writes one consume-once, short-lived source-geometry handoff beside the engine command, keyed by the origin actor ID; receiving choreography uses it only when committed facts expose a compatible actor. It never asserts identity continuity, creates duplicate gameplay truth, or enables cross-canvas drag. Never create a preview actor, ghost, screenshot, hidden canonical tile, or competing runtime projection.

Arkini is the presentation source of truth. Pixi scene owners hold actor phase, operation generation, frozen source/target identities, hit testing, z-order, scene handoff, and current canonical placement. Motion owns interruptible interpolation and spring channels; Motion values and displaced display geometry never decide gameplay semantics. Do not drive pointer-frequency React renders. Pointer press only arms the interaction. Crossing the drag threshold reparents the same live actor into the scene's transient layer, direct pointer movement owns its root pose, and pickup/magnetic offsets stay isolated visual channels.

Every drag release invokes one public atomic engine drop command. Ordinary Inventory click invokes the explicit release command; Shift+click remains Item Detail. UI must never infer merge, consume, swap, stacking, storage eligibility, placement fallback, or removal semantics. While a command is pending, the exact released source and target facts stay frozen; the newest canonical transition remains authoritative underneath any temporary presentation lag. Distance-bounded travel, pickup correction, magnetic neighbour response, producer emission, replacement, and entry/exit paint consume engine previews or standalone transition facts only. Rejected and unsupported targets are truthful feedback and settle from the exact released pose.

Every substantial rendered UI component exposes a stable `data-ui` marker on its owning DOM node using the component/export name, for example `data-ui="BoardFrame"`. Named internal paint or interaction layers use a component-prefixed marker such as `BoardTileTitle`. These markers exist for live DOM inspection, focused behavioral tests, and presentation tooling; they do not encode gameplay state or authoritative runtime attributes. Pixi game scenes do not maintain a parallel DOM or ARIA mirror of retained display objects.

Cross-cutting UI actions use the game-wide button primitives under `src/ui/button`, not page-owned copies. `Button` / `ButtonLink` are the canonical neutral action, `PrimaryButton` / `PrimaryButtonLink` are the canonical emphasized action, and `DangerButton` / `DangerButtonLink` are the canonical destructive action. Pages may add layout or sizing classes but do not recreate visual interaction classes. Custom TanStack Router links must preserve registered-route typing through `createLink` and `LinkComponent`; never flatten router navigation into a hand-written `to: string` wrapper.

Local visual lifecycles may own explicit Arkini-authored presentation states, but Motion is the sole local animation runtime for both DOM and Pixi display objects. Pixi owns explicit demand rendering and may invalidate a frame from Motion subscriptions; it must not implement a parallel tween/spring clock. Only the Pixi animation driver imports the non-React `motion` entrypoint; scene domains consume its explicit finite-tween or retargetable-spring capabilities and never import `motion/react`. Active UI code must not call `element.animate()`, construct `Animation` / `KeyframeEffect`, or coordinate interruptible interaction feedback through CSS transitions or keyframes. Presentation never decides whether save, reset, route release, or shutdown succeeded. Keep the authoritative operation fully visible while pending; start a closing transition only after success, retain pointer authority until actual completion, and leave failures in their truthful settled scene. A scene-wide animator may own cancellation and display-object writes, but domain sequencing remains with the scene owner rather than a generic cross-UI animation manager.

Route transitions use one pure route-pair classifier and native View Transition CSS. For an explicit Arkini transition, old/new `root` snapshots remain invisible and every painted route region must be represented by a deliberate named surface. Assign a shared name only to genuinely corresponding geometry, currently launcher backdrop and Hero layers. Give unrelated launcher panels, progress, action errors, Board, and GameMenu their own identities and sequence old exit before new entry. A whole card owns one snapshot including border, background, content, and shadow; do not split one visual card into nested independently animated chrome/content surfaces. Put the live shadow on the same outer named element so snapshot-to-live handoff cannot lose depth. Cross-route opacity/transform may not be coordinated through WAAPI, CSS component animations, React timers, or a second local `startViewTransition()`.

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
