# Arkini Review Codebook

**Purpose:** reusable operating manual for independent Arkini implementation reviews.

**Audience:** a future ChatGPT reviewer working from a ZIP snapshot containing the repository and `.git`.

**Status:** review protocol, not backlog, roadmap, or implementation plan.

---

## 1. Review mission

An Arkini review verifies that a new implementation still:

1. follows the current architecture and product decisions;
2. preserves logical correctness, atomicity, rollback, and retry semantics;
3. keeps one authoritative runtime truth;
4. respects ownership, cancellation, disposal, and process boundaries;
5. stays understandable and maintainable for future LLM sessions;
6. does not create unnecessary synchronization, forwarding, caches, facades, registries, or framework-shaped bureaucracy;
7. behaves correctly in real Electron, build, persistence, and presentation flows;
8. avoids changes made only to manufacture review output.

A valid review may conclude that no code change is needed. Do not invent work because a review cycle exists.

---

## 2. Review mode is read-only

A review pass does not implement fixes.

- Do not edit source files.
- Do not create review commits.
- Do not reformat the repository.
- Do not remove generated files or `node_modules` from the working workspace.
- Temporary destructive probes are allowed only when necessary to prove a finding. Remove them before finishing and leave `git status` clean.
- Record findings on GitHub. Do not preserve a second active review backlog inside `@chat-gpt`.

Implementation work follows the Arkini ZIP Method separately. Review work returns a report and GitHub issues, not a modified repository ZIP unless explicitly requested.

---

## 3. Required preflight

### 3.1 Verify the snapshot

Stop if the supplied ZIP does not contain `.git`.

Record:

```text
input ZIP
repository root
HEAD
baseline
commit range
working-tree status
Node/npm versions
```

Prefer the previous reviewed HEAD or the implementation task's declared baseline. Never silently compare against an arbitrary old commit.

### 3.2 Read current authority in this order

1. the owning GitHub epic/task and all later authoritative comments;
2. explicit user corrections in the current review conversation;
3. current root contracts:
   - `README.md`
   - `ARCHITECTURE.md`
   - `CODE_GUIDE.md`
   - `CONFIG.md` for authoring/compiler/validation work
   - `GAME.MD` for gameplay semantics;
4. current source and tests;
5. relevant historical notes only when current behavior needs an oracle.

Archived documents explain history. They are not authority.

Later explicit decisions override older issue bodies, archived plans, comments, and reviewer memory. When the user corrects a premise, withdraw the false finding immediately and continue with the corrected contract.

### 3.3 Establish the real scope

Review both:

- the changed commit range;
- the complete boundaries touched by those changes.

A diff-only review misses lifecycle and truth-boundary regressions. A whole-repository review without scope control wastes time and manufactures irrelevant findings.

---

## 4. Canonical architecture invariants

These are defaults unless a newer explicit decision overrides them.

### 4.1 Dependency direction

```text
src/@routes
→ src/page
→ src/ui
→ src/bridge
→ src/engine
```

- TanStack Router files register routes only.
- Route-level composition belongs in `src/page`.
- Reusable presentation and transient interaction belong in `src/ui`.
- `src/bridge` is the only React-to-engine boundary.
- Renderer code does not import Electron.
- `electron/` does not import renderer or engine roots.
- `src/_archive` is historical reference only and may never be imported by active code or tests.

### 4.2 One authoritative game truth

Arkini has one canonical committed runtime.

```text
accepted mutation
→ CommittedTransition { runtime, events }
→ canonical runtime becomes visible
→ transient events describe the same commit
```

Reject:

- React runtime mirrors;
- event-derived state reconstruction;
- duplicate read models used as second truth;
- local UI caches of gameplay decisions;
- previous/current save diffing to rediscover semantic events;
- synchronization added only to keep redundant representations aligned.

Presentation projections are allowed. Gameplay decisions are not.

### 4.3 Engine and UI boundary

The UI may own:

- gestures;
- pointer geometry;
- focus;
- menu visibility;
- pending/error presentation;
- formatting;
- animations and audio;
- purely presentational projections.

The engine owns:

- validity;
- readiness;
- blocked reasons;
- input requirements;
- placement viability;
- queue and job semantics;
- max-count/output limits;
- charge/depletion decisions;
- save and lifecycle semantics;
- authoritative command commits.

Do not accept a UI boolean merely because it is easy to calculate. If it changes command meaning, it belongs to the authoritative engine projection.

### 4.4 Effect runtime roots

One explicit Effect root per physical process:

```text
Electron main → ElectronMainRuntime
renderer      → RendererRuntime
CLI           → NodeRuntime.runMain
```

Each live `Game` owns one child session `ManagedRuntime` containing its scoped services, fibers, subscriptions, and command runtime.

Reject:

- direct `Effect.run*` islands;
- duplicate `ManagedRuntime` instances for one game;
- captured private Promise schedulers;
- HMR creating a second renderer runtime;
- lifecycle state represented by an unrelated async cache.

### 4.5 Project operation grammar

Every exported named project operation:

- is an Effect program;
- ends in `Fx`;
- lives in a same-named file.

Local non-exported synchronous helpers are allowed when they remain implementation details of one operation file.

Framework declarations retain framework grammar:

- React components;
- `use*` hooks;
- TanStack `queryOptions` / `mutationOptions`;
- Zod schemas;
- Effect `Context.Tag`, `Layer`, and `Data.TaggedError` forms;
- types, namespaces, constants, and inline callbacks.

Do not report the `*Fx` rule as subjective. Do not demand `Fx` suffixes on framework-required declarations.

### 4.6 Object and factory composition

Arkini-owned reusable capabilities use readonly objects produced by explicit Effect factories.

Reject new project-owned:

- classes;
- constructor-injected repositories;
- managers;
- generic services;
- adapter objects created through `new`.

External/framework constructors are valid when their API requires them. Do not mechanically replace every constructor with a Layer.

### 4.7 File and domain ownership

Prefer one exported concept per file. Avoid:

- `utils.ts`;
- `helpers.ts`;
- `types.ts` piles;
- generic `shared/`, `services/`, `core/`, or `misc/` buckets;
- unrelated barrels;
- abstractions without a domain owner.

Small files are acceptable when they make the grammar predictable. File-count reduction is not a review objective.

### 4.8 Identifiers and schemas

All exact identifiers use the single shared `IdSchema`.

Do not introduce wrappers such as:

```text
ItemIdSchema
LineIdSchema
JobIdSchema
AssetIdSchema
```

Business schemas follow the repository's strict Zod export pattern. Review schema changes for source-aware diagnostics, strictness, discriminated behavior, and one canonical compiler/validator/packer contract.

### 4.9 TanStack Query boundary

TanStack Query may own transient async mutation state.

It may not own:

- runtime reads;
- catalog truth;
- appearance truth;
- persistence truth;
- lifecycle semantics;
- game ownership.

Prefer one natural `mutationOptions` declaration and one natural `use*Mutation` hook per concrete command. Reject central mutation registries, key registries, generic mutation factories, lifecycle managers, and callback-injection adapters.

### 4.10 Design tokens

UI uses semantic tokens for surfaces, text, borders, states, and accent-aware visuals. Light/dark/system behavior must not require component rewrites.

Prefer:

- Tailwind for component-local static styling;
- `tailwind-variants` for genuinely reusable named variants;
- `twMerge` only at real `className` override boundaries;
- CSS for root viewport contracts, token variables, mathematical board sizing, keyframes, pseudo-elements, and complex selectors.

Do not demand Tailwind class soup for layout mathematics. Do not accept random hardcoded palette values.

### 4.11 Enforcement strategy

Use the narrowest proof mechanism:

- import boundaries → Dependency Cruiser;
- runtime/lifecycle/security/persistence/UI behavior → focused tests;
- generated output and packaging → tests against real artifacts;
- types/schemas → TypeScript, Zod, compiler, validation;
- code grammar and maintenance conventions → review.

Reject source-text recurrence tests and custom AST style-policy systems for naming, exact calls, copy, classes, file counts, or token spelling.

---

## 5. High-value gameplay and lifecycle decisions

These decisions frequently cause false-positive reviews.

### 5.1 Jobs and queue

- Jobs start explicitly through the canonical command path.
- Reservation is all-or-nothing.
- Active jobs are not cancellable.
- Queued intents consume and reserve nothing.
- Queue clearing is explicit UI functionality.
- A producer moved away from non-universe dependencies pauses.
- Starting work in inventory is invalid; inventory is passive storage.
- Runtime progress uses `remainingMs`, not UI wall-clock reconstruction.

### 5.2 Scopes and spaces

- `scope: "any"` means the current board/current space.
- It is not a cross-universe query.
- `scope: "universe"` is the explicit cross-space scope.
- Moving between spaces goes through inventory.
- Inactive spaces continue running.

Do not report current-space filtering of `any` as a regression.

### 5.3 Placement and reserved material

- Placement uses one canonical engine pipeline.
- Reserved material returns through standard placement.
- Do not preserve original instance IDs, positions, or source references merely to return reserved material.
- Random placement failure falls back to the standard placement path.
- Split/placement operations are atomic; if the remainder cannot be placed, the operation rolls back optically and logically.

### 5.4 Purity and stacking

`isPure` is a query, not a stored flag. Purity is reversible and means runtime representation is reconstructable from config.

Only pure identical items stack. The first identity-bound state attachment must correctly split or reject a stack atomically.

### 5.5 Charges and depletion

- Charges are authoritative item state.
- Input cost may come from self or deposit according to schema.
- Depletion outcome and payer selection are engine decisions.
- UI renders charge/depletion facts but does not predict them.

### 5.6 Hard reset

Canonical `hardResetFx`:

```text
hard reset requested
→ discard current live game without final save
→ clear only the exact current package/content-hash save
→ create one fresh game for the same package
→ publish truthful state
```

Reject arbitrary filesystem deletion, package removal, launcher detours, exposed save keys, or a duplicate `destroyFx` alias.

### 5.7 Save and exit

Current decision: in-game `Save and exit` performs controlled whole-application shutdown.

```text
request close
→ router enters the explicit exit action
→ the cached GameEngineResource performs serialized final save/disposal
→ the successful action reports close-ready
→ Electron closes the window
```

Failure retains the same frozen cached game resource and exposes the route error page for retry. It does not navigate to `/main-menu` and does not pretend the final save succeeded.

Ordinary route release remains a separate lifecycle operation.

### 5.8 Appearance

Appearance is application presentation state, not gameplay state.

- modes: `system | light | dark`;
- System reacts to operating-system changes;
- selection persists through the trusted appearance capability;
- no `localStorage` fallback or second appearance store;
- the resolved theme is not a second canonical state graph.

### 5.9 Presentation and audio

Animations and audio consume semantic committed events.

```text
engine commits immediately
→ presentation targets the latest live snapshot
→ motion/audio may lag, redirect, shorten, skip, or fail
```

They never gate gameplay, Tick, save, event publication, or runtime truth.

Old-game nodes, ghosts, audio, subscriptions, and pointers must die on complete `Game` replacement.

---

## 6. Review axes

Every substantial review explicitly checks the following.

### 6.1 Architecture conformity

- correct domain owner;
- legal dependency direction;
- public bridge only;
- no archived imports;
- no second runtime or cache;
- no speculative generic framework.

### 6.2 Logical correctness

Trace complete success and failure paths:

```text
input
→ validation/planning
→ accepted commit
→ publication
→ persistence/presentation
→ caller-visible result
```

Check:

- no-op semantics;
- stale command behavior;
- rollback;
- retry after partial failure;
- exact resource identity;
- duplicate execution;
- event ordering;
- max-count/output capacity;
- ownership changes during work.

### 6.3 Atomicity and interruption

Identify the point of no return.

Before accepted commit, interruption may abort cleanly. After commit begins, runtime truth, publication, persistence watermark, and caller-visible success must not diverge.

A finding based on effect structure is valid even if a tiny race cannot be reproduced, but label it clearly as an inference. Never claim reproduction that did not occur.

### 6.4 Cancellation and disposal

Review:

- route exit;
- HMR;
- native close;
- hard reset;
- package replacement;
- game replacement;
- component unmount;
- failed disposal and retry;
- pending callbacks/promises;
- subscriptions and timers.

Ask which owner disposes each resource and whether disposal can leave a half-committed state.

### 6.5 Persistence

Verify:

- one exact save identity;
- final save ordering;
- failed saves remain retryable;
- appearance and game saves use their canonical persistence capabilities;
- generated save/package identifiers do not leak into UI;
- unpublished/stale games are discarded without inappropriate final save;
- clean checkout does not depend on ignored generated artifacts.

### 6.6 Electron security

Check development and production separately.

Production:

- trusted `arkini://app` origin;
- strict CSP;
- denied subframes, popups, permissions, and arbitrary navigation;
- IPC validates registered `webContents`, exact main frame, and trusted current URL;
- renderer has no arbitrary filesystem access.

Development:

- exact validated loopback Vite origin;
- exact HMR WebSocket allowance;
- no `localhost` / `127.0.0.1` mismatch;
- React/Vite development scripts work under the narrowest dev-only CSP;
- production policy remains unchanged.

Never propose `webSecurity: false`, global CSP disablement, wildcard origins, or production relaxations merely to make development work.

### 6.7 Routing and startup

Verify real route ownership and the actual Electron paint lifecycle, not only React timers.

For startup visuals ask:

- does the timer start when the user can actually see the window?;
- are persisted appearance and assets paint-ready before reveal?;
- does exit cross-fade into an already prepared destination?;
- is unmount tied to real transition completion?;
- can Escape interrupt without snap or duplicate navigation?;
- is the splash once per renderer session rather than once per route visit?

### 6.8 Interaction and accessibility

Review:

- one keyboard owner;
- focus entry, trap, restoration, and disposal;
- pointer blocking from enter through exit;
- duplicate input during transitions;
- pending and failure visibility;
- reduced-motion ordering;
- menu/dialog interaction authority;
- stale drag/drop and target replacement.

### 6.9 Animation quality

Animation is a product contract, not decoration.

Check:

- enter/open/exit states;
- real completion signals instead of duplicated timers;
- current visual state as interruption origin;
- current live target as destination;
- no teleport, snap-back, stale resurrection, or fade-to-empty jump;
- layering and hit testing;
- resize and relocation;
- cleanup after route/game replacement.

Do not accept a generic fade merely because “animation exists.” Review each interaction's timing, easing, direction, and interruption behavior.

### 6.10 Mental load

Review for future LLM readability:

- responsibilities visible from names and files;
- linear command flow;
- no hidden second truth;
- no coupled synchronization primitives serving unrelated contracts;
- no adapter onion;
- no generic framework larger than the concrete problem;
- comments explain invariants, not restate code;
- one clear owner for each lifecycle.

Do not equate more files with more complexity. Hidden coupling is worse than explicit small modules.

---

## 7. Evidence standard for findings

A review finding must contain:

1. **contract:** the authoritative behavior or invariant;
2. **location:** exact files/functions and relevant lines or diff hunks;
3. **current behavior:** what the implementation actually does;
4. **impact:** correctness, security, lifecycle, UX, or maintenance consequence;
5. **evidence type:** reproduced, generated-output observation, test failure, or direct structural inference;
6. **required target:** the behavior that must hold, without overprescribing topology;
7. **acceptance tests:** focused behavioral proof;
8. **do-not list:** tempting but incorrect shortcuts.

Distinguish explicitly:

```text
Reproduced
Observed in generated output
Proven by deterministic test
Directly implied by effect/control-flow structure
Speculative and therefore not a finding
```

Do not inflate uncertainty into certainty.

---

## 8. Severity

Use existing repository priorities.

### P1

A release/development blocker or material risk involving:

- data loss;
- security boundary failure;
- canonical truth divergence;
- broken startup/build/packaging;
- unrecoverable lifecycle failure;
- core operation unavailable in the supported environment.

### P2

A material defect involving:

- incorrect but recoverable behavior;
- broken product contract;
- lifecycle/resource leak without immediate data loss;
- significant animation/accessibility failure;
- misleading documentation likely to misdirect implementation;
- substantial mental-load regression with concrete maintenance impact.

Do not create issues for minor taste, naming preference, harmless duplication, or hypothetical future extensibility. Mention low-value observations only as non-findings or omit them.

---

## 9. Validation protocol

Run the narrowest meaningful matrix, then widen as needed.

### 9.1 Repository state

```bash
git status --short
git diff --check
git log --oneline <baseline>..HEAD
```

Record toolchain mismatch. Engine warnings from running an older Node/npm version do not automatically invalidate results, but the final report must disclose them.

### 9.2 Install

When dependencies are absent:

```bash
npm ci --ignore-scripts
```

Reuse `node_modules` within the thread. Do not delete it after review.

### 9.3 Static gates

Run repository scripts rather than invented equivalents:

- format/check;
- source typecheck;
- test typecheck;
- Electron typecheck;
- game validation;
- Dependency Cruiser;
- focused duplication scan when useful.

### 9.4 Build and generated output

Validate real output:

- production Electron build;
- official Arkpack generation before renderer consumption;
- renderer asset graph;
- clean-checkout build path;
- packaged protocol/CSP output;
- platform packaging only where the current environment can truthfully exercise it.

Do not claim a macOS binary was launched from Linux.

### 9.5 Tests

1. run focused tests around changed contracts;
2. run affected permanent shards;
3. widen to all shards when practical;
4. use deterministic probes for races rather than timing roulette.

If a command prints passing assertions but hangs, report exactly that. Do not translate it into “all tests passed.”

Record:

```text
files
assertions/tests
completed shards
hung shards
failing assertions
orchestration behavior
```

### 9.6 Real-environment smoke tests

For Electron, CSP, HMR, focus, animation, packaging, and native close behavior, component tests alone are insufficient. Require a boundary-level or generated-output proof where feasible.

---

## 10. Avoiding false positives

Before publishing a finding, ask:

1. Is the contract current?
2. Did a later issue comment or user correction supersede it?
3. Is this real behavior or only style preference?
4. Is the state duplicated, or merely a presentation projection?
5. Is the synchronization redundant, or required to linearize a real boundary?
6. Is a local helper actually exported project grammar?
7. Is a framework class being mistaken for project-owned class composition?
8. Is `scope: any` being incorrectly assumed to mean universe?
9. Is a generated artifact intentionally ignored but correctly generated before use?
10. Is the proposed fix larger and riskier than the defect?

Withdraw a false finding visibly. Do not quietly keep its severity while changing the wording.

---

## 11. Non-findings and restraint

Explicitly record important things that were checked and found sound, especially when previous reviews raised them.

Examples:

- trusted renderer boundary remains closed;
- one catalog owner exists;
- Query remains mutation-only;
- no runtime mirror was introduced;
- package build ordering is correct;
- local queue duplication is an acceptable correctness tradeoff;
- a small clone is cheaper than a generic abstraction;
- a large but linear factory should not be split merely because of line count.

A review should protect stable architecture from endless redesign as aggressively as it finds defects.

---

## 12. GitHub review workflow

### 12.1 Search before creating

Search open and closed issues for the same contract.

- Update or reopen the existing owner when the finding is the same work.
- Add concrete new evidence to an existing issue.
- Create a new child only for a distinct unresolved defect.
- Do not create twins because the title differs.

### 12.2 Review root

Every substantial review creates one root issue:

```text
labels: epic + chat-gpt + review
priority: highest unresolved child priority
```

A clean review still creates and closes the root, preserving the reviewed HEAD, baseline, validation, and clean verdict.

Root contents:

```text
Snapshot
Scope
Verdict
Closed previous findings
Open findings / child checklist
Validation
Non-findings
No repository changes statement
```

### 12.3 Review child

Each distinct finding uses:

```text
labels: task + chat-gpt + review + P1|P2
```

Child body:

```text
Parent review
Original feature/issue
Finding
Evidence
Impact
Required behavior
Implementation constraints
Verification
Do not
```

The child links the root. The root links every child.

### 12.4 Existing product issue

When the defect already has a product/review issue, add evidence there and link it from the review root instead of creating another child.

### 12.5 Closing

Close the review root only when:

- all child findings are closed or explicitly accepted;
- existing linked blockers are closed;
- the final snapshot has been revalidated;
- the root records the closing HEAD.

---

## 13. Recommended review report shape

Use this order in the user-facing report:

1. **Verdict** in one paragraph.
2. **Findings**, highest severity first.
3. **What is structurally sound.**
4. **Validation performed and limitations.**
5. **GitHub issues created/updated.**
6. **Repository-change statement.**

For each finding, lead with impact, not implementation trivia.

Example:

```markdown
## P1 — Development CSP blocks the renderer

The development document contains an inline React Refresh preamble, while the effective dev `script-src` allows only `'self'`. Chromium rejects the preamble before renderer initialization. Production CSP is unaffected and must remain strict.

Tracked in #NNN.
```

Do not bury the conclusion under a chronological diary of commands.

---

## 14. Review anti-patterns

Do not:

- implement fixes during review;
- refactor stable core to create activity;
- create generic managers, buses, registries, pipelines, or cache layers as default remedies;
- recommend duplicate state to solve subscription timing;
- accept a second truth because it makes React convenient;
- use source-text tests as architecture enforcement;
- infer success from a process that hung after printing assertions;
- claim a race was reproduced when it was only implied;
- treat archived documentation as authority;
- preserve stale local task queues after GitHub owns the backlog;
- use `@chat-gpt/CURRENT.md` as a continuation or backlog source;
- reopen settled decisions without new evidence;
- confuse visual completion with lifecycle success;
- let route teardown or native close cut an exit transition short;
- weaken production Electron security to fix development;
- report a product decision as a bug after the user confirms it is intentional.

---

## 15. Final checklist

### Authority

- [ ] `.git` exists.
- [ ] HEAD and baseline recorded.
- [ ] owning issues and later comments read.
- [ ] explicit user corrections applied.
- [ ] archived notes treated only as history.

### Architecture

- [ ] route/page/ui/bridge/engine direction preserved.
- [ ] Electron boundary preserved.
- [ ] one runtime truth.
- [ ] one runtime root per process and one session runtime per game.
- [ ] no UI gameplay decisions.
- [ ] `*Fx`, object/factory, `IdSchema`, schema, and token rules reviewed.
- [ ] Query remains mutation-only.

### Correctness

- [ ] success, failure, stale, retry, rollback paths traced.
- [ ] point of no return identified.
- [ ] cancellation/disposal checked.
- [ ] save identity and final-save ordering checked.
- [ ] package/game replacement checked.

### Product

- [ ] current route contract checked.
- [ ] startup timing checked against visible Electron behavior.
- [ ] focus and keyboard ownership checked.
- [ ] animation enter/exit/interruption checked.
- [ ] reduced motion checked.
- [ ] audio/presentation cannot block truth.

### Validation

- [ ] `git diff --check`.
- [ ] formatting.
- [ ] all relevant typechecks.
- [ ] game validation.
- [ ] production build/generated output.
- [ ] Dependency Cruiser.
- [ ] focused tests.
- [ ] relevant shards.
- [ ] hangs and environment limits reported honestly.
- [ ] temporary probes removed.
- [ ] working tree clean.

### Reporting

- [ ] existing issues searched first.
- [ ] one review root created.
- [ ] distinct findings linked as children or existing issues.
- [ ] priorities justified.
- [ ] reproduced versus inferred evidence distinguished.
- [ ] non-findings recorded where valuable.
- [ ] no repository commits made by review.

---

## 16. Definition of a successful Arkini review

A review is successful when a future implementation model can read the report and know:

- exactly what contract was reviewed;
- what is definitely wrong;
- what was only inferred;
- why it matters;
- what behavior must replace it;
- how to prove completion;
- which tempting shortcuts are forbidden;
- which architecture is already sound and must not be redesigned;
- what validation actually completed;
- where the authoritative GitHub work now lives.

The review must reduce uncertainty and mental load. If it creates another layer of vague plans, duplicate truth, or speculative abstractions, it has failed even if the Markdown looks impressive.
