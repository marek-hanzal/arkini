# Production map

This README maps the peer `production-*` roots. It lives beside Production Line because a Line is the authored unit that connects rules, inputs, timing and outputs; `production-line` is not an umbrella owner and the other roots do not sit below it.

[`GAME.MD`](../../GAME.MD) owns production semantics. [`src/game-runtime/README.md`](../game-runtime/README.md) explains the canonical transaction and Tick lifecycle around these operations.

## Owners

| Domain | Owns | Public entrypoints |
| --- | --- | --- |
| `production-condition` | Authored runtime condition evaluation | [`whenFx.ts`](../production-condition/fx/whenFx.ts) |
| `outcome` | Typed Item/Space outcome schemas; deterministic resolution and ordered application | [`resolveOutcomeTableFx.ts`](../outcome/fx/resolveOutcomeTableFx.ts) |
| `production-action` | Immediate action admission, action inputs and unit settlement | [`resolveActionRuleFx.ts`](../production-action/fx/resolveActionRuleFx.ts), [`settleActionUnitsFx.ts`](../production-action/fx/settleActionUnitsFx.ts) |
| `production-input` | Material resolution, buffers, autofill, withdrawal and storage mutation | [`resolveInputRunFx.ts`](../production-input/fx/resolveInputRunFx.ts), [`applyInputRunPlanFx.ts`](../production-input/fx/applyInputRunPlanFx.ts) |
| `production-line` | Line definitions, rules, reads and one pinned-snapshot run plan | [`fx/resolveLineRunFx.ts`](fx/resolveLineRunFx.ts) |
| `production-job` | Queue admission, reservation, start, completion and cancellation cleanup | [`../production-job/fx/enqueueLineFx.ts`](../production-job/fx/enqueueLineFx.ts), [`../production-job/fx/attemptQueuedLineStartFx.ts`](../production-job/fx/attemptQueuedLineStartFx.ts), [`../production-job/fx/attemptJobCompletionFx.ts`](../production-job/fx/attemptJobCompletionFx.ts) |
| `production-delivery` | Single-item delivery, travel, reconciliation and input settlement | [`advanceDeliveriesRuntimeFx.ts`](../production-delivery/fx/advanceDeliveriesRuntimeFx.ts), [`settleItemDeliveryRuntimeFx.ts`](../production-delivery/fx/settleItemDeliveryRuntimeFx.ts) |
| `production-authoring` | Shared controlled Editor fields for Line/Input/Rule/Outcome values | [`LineFields.tsx`](../production-authoring/ui/LineFields.tsx) |

Gameplay consumers import these exact owners directly. Do not add a `production` barrel, coordinator, adapter or directory just to make the island look hierarchical.

## Dependency shape

The production domain graph contains real behavior cycles even though the concrete module graph remains acyclic.

| Crossing | Outbound behavior | Return behavior | Interpretation |
| --- | --- | --- | --- |
| `game-runtime ↔ production-line` | Runtime validation checks selected lines | Line reads and commands use the Runtime capability | Real aggregate integration |
| `game-runtime ↔ production-input` | Runtime validation and Item removal release input state | Input plans read and mutate Runtime items | Real aggregate integration |
| `game-runtime ↔ production-job` | Runtime validation and identity cleanup inspect jobs/reservations | Queue/start/completion use atomic Runtime mutation | Real aggregate integration |
| `game-runtime ↔ production-delivery` | Runtime validation and identity cleanup reconcile deliveries | Delivery advance/settlement reads and revises Runtime | Real aggregate integration |
| `production-input ↔ production-line` | Input resolution reads line policy | Line run planning resolves inputs | One planning boundary split by semantic owner |
| `production-input ↔ production-delivery` | Autofill plans and cleanup use delivery operations | Delivery admission and settlement use input eligibility/storage | One delivery boundary split by semantic owner |

Schema composition adds further non-behavioral back edges:

- Item Definition embeds Line, Outcome and schedule contracts. Navigation is a Space outcome on an ordinary line; input and rule admission have one shared lifecycle.
- Runtime schemas embed Job, default-line, input and delivery state; production operations consume Runtime values.
- Production errors and schemas reuse exact Game Value identity, quantity and time contracts.

Do not call one side globally upstream or downstream. State the exact layer: for example, “Runtime schema composes Job schema” or “Job completion calls Runtime mutation.”

## Execution flow

```text
enqueueLineFx
→ resolve owner + line + rules + non-material requirements
→ validate units and queue capacity
→ append intent only

Tick: persisted global queue order, earliest actionable request per idle owner
→ skip blocked requests without changing state or intent order
→ recheck rules, non-material requirements and units
→ autofill useful material through Delivery when possible
→ retry from fresh Runtime facts
→ resolveLineRunFx from one pinned snapshot
→ commit inputs + spend units
→ start one Job atomically
→ a successful start settlement, including a terminal depletion reset, or scheduled delivery handles this owner for the queue pass

Tick: ready Job in stable ID order
→ remove Job and consumed roots from one candidate
→ place line/depletion outputs
→ release stored inputs
→ relocate reserved material
→ commit all or nothing

Tick: ready expired material after completion settlement
→ remove the expired identity, its Job and remaining consumed roots
→ settle a depleted owner and return stored inputs and reservations
→ place expiry output from the physical owner origin with consumed material removed
→ retry idle owners' queued requests in global intent order
→ commit all or nothing

clear pending owner queue
→ preserve active Job and its consumed/reserved material
→ return stored roots for the cleared request lines
→ reverse their outbound deliveries
→ commit all or nothing
```

Autofill sources always belong to the producer’s board space. Authored reach still filters sources within that board; unit payments have the same home-space boundary, all query ranges stay within the origin board. All outbound deliveries are admitted by the same autofill planner.

A queued request owns no time, material or units. Input filling never starts work. Renderer delivery contact never admits material or settles a job.

Scheduled owners filter their selected Clock pool by line rules, draw by `clockWeight`, then use ordinary one-intent admission. `Item.clock` composes scheduling data; `item-schedule` owns phase, lifetime and the Clock override, while Production retains queue ordering and the complete job/delivery lifecycle. An exhausted schedule closes new intent and Autofill; accepted runnable work still dispatches normally in loose-kill mode, while kill-switch cancels it. Player-control admission is separate from autonomous work and shared by production commands and their projections.

## Important invariants

- Queue intent order stays persisted; each pass chooses the earliest request per idle Board owner that can settle a start or schedule useful delivery. A depletion Template may remove the admitted Job in that same settlement. Blocked probes leave Runtime, events and gameplay randomness unchanged.
- A skipped request keeps its identity, line and valid stored inputs, regaining priority when actionable. Existing in-flight delivery alone does not claim priority in a later pass.
- One owner may progress at most once per queue pass. Completion and expiry can trigger separate passes in the same fixed step; queue dispatch never preempts active Jobs. Explicit forced owner removal can abort active Jobs.
- The engine can cancel an exact active job through [`cancelItemJobFx`](../production-job/fx/cancelItemJobFx.ts). Shared [`abortJobRuntimeFx`](../production-job/fx/abortJobRuntimeFx.ts) consumes committed material, returns reservations, and settles owner depletion atomically. Stale job IDs never cancel a replacement.
- Clearing pending work returns its unused line-input material without cancelling active work. An optional line ID restricts clearing to that line. An exact request ID cancels only that pending request; stale IDs are no-ops. Shared line buffers and deliveries stay while another request for that line remains.
- Start re-resolves all live facts and atomically applies input ownership, unit spending, reservation and Job creation.
- Completion failure preserves the pre-completion state for retry and does not block independent owners.
- Randomness is derived from stable canonical identities and explicit algorithm versions, never wall time or Tick.
- Job, delivery and item-schedule advancement order belongs to Game Tick, not to any production root.

## Changing this island?

Likely affected:

- Runtime validation and exact Item ownership.
- Tick queue/start/completion/delivery order.
- Item Detail Line projections and production commands.
- Flow acquisition facts and Estimate route/cost semantics when authored inputs or outputs change.
- Config validation and Production Authoring when a schema changes.
- Focused tests under the exact `test/production-*` owner plus Game Tick or Runtime when transaction shape changes.

Usually not affected:

- Game Session acquisition, installed-package lifecycle or save transport when Runtime/State shape is unchanged.
- Electron Editor filesystem transactions and Version object storage.
- Pixi geometry, animation or pointer policy when committed event/projection shape is unchanged.

Changes to persisted Job/Input/Delivery schemas, Game Events or Item placement cross those defaults and require following the exact consumers.

Clock kill-switch uses [`forceRemoveRuntimeItemFx`](../game-runtime/fx/forceRemoveRuntimeItemFx.ts), the general atomic removal path. It cancels all owner intent and active work, discards consumed inputs without unit refunds or line output, and returns reservations before buffers and expiry Output. Ordinary completion retains all-or-nothing placement. Forced removal alone permits logged capacity overflow; parent-job reconciliation uses that same policy when the removed root was committed material. Successful completions at the expiry boundary still win.

Clock selection uses [`readClockLinesFn.ts`](fn/readClockLinesFn.ts) for authored markers or an exact owner override. [`selectClockLineFx.ts`](../item-schedule/fx/selectClockLineFx.ts) evaluates line rules before weighted selection; [`advanceItemSchedulesFx.ts`](../item-schedule/fx/advanceItemSchedulesFx.ts) owns the saved pulse cursor and one ordinary admission attempt. This changes neither Default selection nor accepted request identity.
