# Historical implementation coverage

This document prevents repeated archaeology. It maps historical source areas to the current engine and to the numbered task that still owns any remaining behavior.

## Status vocabulary

- **Superseded** — current implementation already covers or exceeds the behavior; do not study the historical architecture.
- **Partial** — current behavior exists, but the historical area still contains unported product or presentation knowledge.
- **Reference** — current behavior does not exist yet; consult only for the task named here.
- **Rejected** — the old model is deliberately not being carried forward.
- **Archive-ready** — no active oracle value remains; delete when dependency-safe.
- **Removed** — deleted from the working tree; Git retains history.

A status describes oracle value, not whether historical code still compiles. The historical tree is not production code.

## Capability matrix

| Capability | Current state | Historical role | Owner task |
| --- | --- | --- | --- |
| Config fragments, compiler, diagnostics, pack | Superseded | Old implicit compiler is rejected | Done |
| Initial board and inventory | Superseded | Only visual layout may remain useful | 12 |
| Canonical board/inventory items | Superseded | Historical save maps are rejected | Done |
| Move, swap, spawn, remove, quantity | Superseded | Interaction feedback remains useful | 11, 14 |
| Stack-first placement and scope fallback | Superseded | Visual stack behavior remains useful | 14 |
| Producer lines and explicit start | Superseded | Labels/detail presentation remain useful | 10, 13 |
| Material buffer, consume, reserve | Superseded | Input panel UX remains useful | 10, 13 |
| FIFO queue, pause/resume, completion | Superseded | Presentation and sound remain useful | 13–15 |
| Fixed-step Tick and offline catch-up | Superseded | Wall-clock scheduler is rejected | Done |
| Deterministic output rolls | Superseded | Sound/visual grouping may remain useful | 14, 15 |
| Distance, conditions, runtime line rules | Superseded | Old active-effect store is rejected | 10, 13 |
| Craft completion lifecycle | Partial | Generic authored completion lifecycle is canonical; presentation behavior remains | 13–15 |
| Blueprint completion lifecycle | Partial | Generic authored output, placement, max-count reservation, and atomic retry are canonical; presentation feedback remains | 13–15 |
| Stash completion lifecycle | Partial | Generic authored completion lifecycle is canonical; presentation and sound remain | 13–15 |
| Item charges, deposit input, depletion | Partial | Generic runtime behavior is canonical; read-model, detail, feedback, and animation remain | 10, 13, 14 |
| Directional gameplay merge | Partial | Canonical atomic execution, deterministic output, and semantic event are implemented; interaction feedback and animation remain | 11, 14 |
| Temporary lifetime/expiry | Partial | Canonical fixed-step state, save/restore, deterministic atomic expiry, and retry are implemented; read-model and presentation behavior remain | 10, 13, 14, 15 |
| Speed cheat | Partial | Canonical root runtime session mode, 1×/30× Tick input, save reset, toggle command, and event are implemented | Read-model/asset projection, control UI, and audio remain | 10, 13, 15 |
| Multi-space board runtime | Partial | Canonical spaces, persistent navigation, isolation, placement, Tick, save, explicit `any` versus `universe` query reach, and ownership-graph travel are implemented; renderer/navigation presentation remains | 10–14 |
| Board memory | Rejected | Destructive snapshot/restore and active v1 item authoring were removed in favor of multi-space boards | Done |
| Cheat inventory sink and nuke-save confirmation | Partial | Canonical sink command, committed feedback event, nuke confirmation request, save-discard shutdown, and provisional dispose/delete/create sequencing are implemented | Final hard reset must be shell-owned application-root replacement through one shared factory and complete-transition single-flight in 12; interaction, confirmation UI, animation, and debug wiring remain in 11–14/16 |
| Public board/inventory/line read models | Partial | Historical bridge is an information-requirement catalogue | 10 |
| Drag/drop and activation orchestration | Reference | Historical interaction behavior remains | 11 |
| React board/inventory renderer | Reference | Layout and UX remain; state topology is rejected | 12 |
| Detail sheets and line controls | Reference | Product behavior and copy remain | 13 |
| Visual planning and animation | Reference | Historical event-to-motion behavior remains | 14 |
| Audio | Reference | Sound policy and synthesis remain | 15 |
| Debug/explain tools | Reference | Explanation scenarios remain | 16 |
| Persistent browser shell | Partial | Current save boundary exists; browser adapter and root factory are pending | Application-root ownership, atomic publication, truthful failure state, and single-flight hard reset belong to 12; final pruning belongs to 17 |

## Historical directory map

| Historical area | Status | What is already solved or rejected | What may still be consulted | Cleanup owner |
| --- | --- | --- | --- | --- |
| `action/` | Partial | Central action union is not current architecture | Player command vocabulary and interaction coverage | 11, 17 |
| `activation/` | Partial | Input ownership, consume/reserve, and autofill planning are superseded | Labels, feedback, and input-panel UX | 10, 13 |
| `app/` | Reference | Old bootstrap/runtime wiring is rejected | Splash, shell, layout, and user flow | 12 |
| `audio/` | Reference | No current audio layer | Sound policy, batching, synth choices | 15 |
| `board/` | Partial | Board runtime writes and canonical locations are superseded | Board layout, taps, drag feedback, visual state | 11, 12, 14 |
| `board-memory/` | Rejected | Snapshot/restore semantics and active v1 schema/content are rejected | Nothing; final coupled v0 deletion belongs to task 17 |
| `browser/` | Reference | No active browser shell | Hard reset behavior only | 12, 17 |
| `capacity/` | Partial | Generic item charges, deterministic deposit input, depletion, and output are superseded | Detail/read-model feedback and depletion animation | 10, 13, 14, 17 |
| `cheat/` | Partial | Root runtime speed mode and fixed-step acceleration supersede historical runtime/timestamp behavior | Board control, ordered asset projection, and sound intent only | 10, 13, 15, 17 |
| `cli/` | Removed | Canonical compiler/validator/packer supersede it completely | Nothing; use Git only for archaeology | Done |
| `config/` | Partial | Old compiler conventions and config model are rejected | Historical feature definitions when a task needs semantics | 01–09, 17 |
| `craft/` | Partial | Generic and single-use runtime lifecycle are superseded | Detail, animation, and audio behavior only | 13–15 |
| `debug/` | Reference | No current debug/explain surface | Scenarios, explanations, spawn/delete UX | 16 |
| `effects/` | Partial | Current conditions/rules and temporary-item expiry supersede global effective-line recomputation plus persistent active-effect timing | Effect labels, concrete product behavior, presentation, and audio intent | 10, 13–15 |
| `engine/` | Superseded | Save topology, action dispatch, adapter, readiness mutation, world catch-up are rejected | Tests only when extracting behavior for an open task | 17 |
| `event/` | Partial | Current transitions own runtime events atomically | Event naming and presentation/audio intent | 14, 15 |
| `hash/` | Superseded | Not engine architecture | Only if browser persistence needs compatible hashing | 17 |
| `inventory/` | Partial | Canonical inventory runtime and commands are superseded | Layout, slot UX, drag/drop behavior | 11, 12, 14 |
| `item/` | Partial | Current item schemas own definitions | Product labels and UI presentation | 10, 13 |
| `item-detail/` | Reference | No current detail UI | Panels, controls, copy, effect/input presentation | 13 |
| `job/` | Superseded | Fixed-step jobs and FIFO requests replace timestamp jobs | Rare feature-specific edge cases only | 17 |
| `layer/` | Removed | Old UI layering audit had no current source ownership | Nothing | Done |
| `limit/` | Partial | Runtime max count and placement checks exist | Target-limit presentation | 10, 13 |
| `loot/` | Superseded | Current output/roll model is canonical | Presentation/audio grouping only | 14, 15 |
| `merge/` | Partial | Canonical directional execution, board-viability validation, and tests supersede historical runtime mutation; placement stack merge remains separate | Drag feedback and animation/audio intent only | 11, 14, 15 |
| `placement/` | Partial | Current material placement plus `placeRuntimeItemFx` existing-identity relocation are canonical | Drag feedback and animation intent | 11, 14 |
| `play/` | Reference | Runtime mirrors and bridge-owned gameplay truth are rejected | Information requirements, sheets, visual/audio orchestration | 10–16 |
| `producer/` | Partial | Engine lifecycle, input, queue, Tick, generic completion, and output are superseded | Detail/read-model behavior, feedback, audio | 10, 13–15 |
| `quantity/` | Superseded | Current quantity schemas/plans own semantics | Nothing unless a specific edge case is missing | 17 |
| `random/` | Superseded | Completion-local deterministic RNG is canonical | Nothing architectural | 17 |
| `react/` | Reference | No current renderer shell | Tiny generic hook ergonomics only | 12 |
| `remove/` | Superseded | Current owner lifecycle guards and atomic release are canonical | Presentation feedback only | 14 |
| `save/` | Superseded | Current state/session/save boundary is canonical | Initial UX only if needed | 17 |
| `selector/` | Superseded | Current query/selector compiler and runtime evaluation are canonical | Nothing architectural | 17 |
| `stack/` | Superseded | Current placement stacking is canonical | Animation intent only | 14 |
| `stash/` | Archive-ready | Generic line start/output/completion supersede runtime behavior | Product copy, animation, and audio only | 13–15, 17 |
| `storage/` | Partial | Current save service boundary exists | Browser persistence and reset policy | 12, 17 |
| `tile-engine/` | Reference | Its cyclic package topology is rejected | Pointer, DnD, hit testing, motion behavior | 11, 12, 14 |
| `time/` | Superseded | Wall-clock jobs and hidden catch-up are rejected | Formatting only | 13, 17 |
| `ui/` | Reference | No active renderer | Shared visual components and tokens | 12, 13 |
| `world/` | Superseded | Manual world passes and wake planning are rejected | Behavior tests only when an open task needs them | 17 |

## Deletion policy

Delete historical material only after its remaining behavior is captured in one or more of:

- current implementation and tests;
- current root gameplay/config documentation;
- the owning numbered task;
- a compact local README pointing to the replacement.

A completed task must identify exact historical files or directories that are now safe to remove. Do not leave old runtime infrastructure merely because some UI file imports its types; remove complete vertical slices when their remaining oracle value reaches zero.
