# Production map

This README maps the peer `production-*` roots. It lives beside Production Line because a Line is the authored unit that connects rules, inputs, timing and outputs; `production-line` is not an umbrella owner and the other roots do not sit below it.

[`GAME.MD`](../../GAME.MD) owns production semantics. [`src/game-runtime/README.md`](../game-runtime/README.md) explains the canonical transaction and Tick lifecycle around these operations.

## Owners

| Domain | Owns | Public entrypoints |
| --- | --- | --- |
| `production-condition` | Authored runtime condition evaluation | [`whenFx.ts`](../production-condition/fx/whenFx.ts) |
| `production-output` | Output, drop and roll schemas; deterministic resolution | [`outputFx.ts`](../production-output/fx/outputFx.ts), [`readOutputMaximumQuantitiesFn.ts`](../production-output/fn/readOutputMaximumQuantitiesFn.ts) |
| `production-action` | Immediate action admission, action inputs and charge settlement | [`resolveActionRuleFx.ts`](../production-action/fx/resolveActionRuleFx.ts), [`settleActionChargesFx.ts`](../production-action/fx/settleActionChargesFx.ts) |
| `production-input` | Material resolution, buffers, autofill, withdrawal and storage mutation | [`resolveInputRunFx.ts`](../production-input/fx/resolveInputRunFx.ts), [`applyInputRunPlanFx.ts`](../production-input/fx/applyInputRunPlanFx.ts) |
| `production-line` | Line definitions, rules, reads and one pinned-snapshot run plan | [`fx/resolveLineRunFx.ts`](fx/resolveLineRunFx.ts) |
| `production-job` | Queue admission, reservation, start, completion and cancellation cleanup | [`../production-job/fx/enqueueLineFx.ts`](../production-job/fx/enqueueLineFx.ts), [`../production-job/fx/attemptQueuedLineStartFx.ts`](../production-job/fx/attemptQueuedLineStartFx.ts), [`../production-job/fx/attemptJobCompletionFx.ts`](../production-job/fx/attemptJobCompletionFx.ts) |
| `production-delivery` | Outbound allocation, travel, reconciliation and input settlement | [`advanceDeliveriesRuntimeFx.ts`](../production-delivery/fx/advanceDeliveriesRuntimeFx.ts), [`settleItemDeliveryRuntimeFx.ts`](../production-delivery/fx/settleItemDeliveryRuntimeFx.ts) |
| `production-authoring` | Shared controlled Editor fields for Line/Input/Rule/Output values | [`LineFields.tsx`](../production-authoring/ui/LineFields.tsx) |

Gameplay consumers import these exact owners directly. Do not add a `production` barrel, coordinator, adapter or directory just to make the island look hierarchical.

## Dependency shape

The production domain graph contains real behavior cycles even though the concrete module graph remains acyclic.

| Crossing | Outbound behavior | Return behavior | Interpretation |
| --- | --- | --- | --- |
| `game-runtime ↔ production-line` | Runtime validation checks default lines | Line reads and commands use the Runtime capability | Real aggregate integration |
| `game-runtime ↔ production-input` | Runtime validation and Item removal release input state | Input plans read and mutate Runtime items | Real aggregate integration |
| `game-runtime ↔ production-job` | Runtime validation and identity cleanup inspect jobs/reservations | Queue/start/completion use atomic Runtime mutation | Real aggregate integration |
| `game-runtime ↔ production-delivery` | Runtime validation and identity cleanup reconcile deliveries | Delivery advance/settlement reads and revises Runtime | Real aggregate integration |
| `production-input ↔ production-line` | Input resolution reads line policy | Line run planning resolves inputs | One planning boundary split by semantic owner |
| `production-input ↔ production-delivery` | Autofill plans and cleanup use delivery operations | Delivery admission and settlement use input eligibility/storage | One delivery boundary split by semantic owner |

Schema composition adds further non-behavioral back edges:

- Item Definition embeds Line and Output schemas; production reads Item definitions.
- Runtime schemas embed Job, default-line, input and delivery state; production operations consume Runtime values.
- Production errors and schemas reuse exact Game Value identity, quantity and time contracts.

Do not call one side globally upstream or downstream. State the exact layer: for example, “Runtime schema composes Job schema” or “Job completion calls Runtime mutation.”

## Execution flow

```text
enqueueLineFx
→ resolve owner + line + rules + non-material requirements
→ validate charges, output capacity and queue capacity
→ append intent only

Tick: FIFO head of idle owner
→ autofill useful material through Delivery when possible
→ retry from fresh Runtime facts
→ resolveLineRunFx from one pinned snapshot
→ reserve inputs + charges + worst-case output
→ start one Job atomically

Tick: ready Job in stable ID order
→ remove Job and consumed roots from one candidate
→ place line/depletion outputs
→ release buffered inputs
→ relocate reserved material
→ commit all or nothing
```

A queued request owns no time, material, charges or output reservation. Input filling never starts work. Renderer delivery contact never admits material or settles a job.

## Important invariants

- The FIFO head retries from fresh Runtime state and cannot be overtaken or silently removed.
- Start re-resolves all live facts and atomically applies input ownership, charge spending, stack isolation, reservation and Job creation.
- Active Jobs reserve the worst possible output quantity; queued requests reserve nothing.
- Completion failure preserves the pre-completion state for retry and does not block independent owners.
- Randomness is derived from stable canonical identities and explicit algorithm versions, never wall time or Tick.
- Job, delivery and temporary-item advancement order belongs to Game Tick, not to any production root.

## Changing this island?

Likely affected:

- Runtime validation and stateful Item isolation.
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
