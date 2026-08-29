import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { reconcileOutboundDeliveriesRuntimeFx } from "~/engine/delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import { readDeliveryTravelDurationMsFx } from "~/engine/delivery/read/readDeliveryTravelDurationMsFx";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { applyInputMaterialStorePlanFx } from "~/engine/input/fx/applyInputMaterialStorePlanFx";
import { planInputMaterialStoreFx } from "~/engine/input/fx/planInputMaterialStoreFx";
import { filterInputSlotItemsFx } from "~/engine/input/read/filterInputSlotItemsFx";
import { TypeSchema } from "~/engine/input/schema/TypeSchema";
import { isolateStatefulOwnerTransitionFx } from "~/engine/item/fx/isolateStatefulOwnerTransitionFx";
import { isLineInputClosedFx } from "~/engine/line/fx/input/isLineInputClosedFx";
import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import { readGridLocationClaimsFn } from "~/engine/location/fn/readGridLocationClaimsFn";
import { readGridLocationKeyFn } from "~/engine/location/fn/readGridLocationKeyFn";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import { isDeliveryRuntimeItemFn } from "~/engine/runtime/read/fn/isDeliveryRuntimeItemFn";
import type { DeliveryRuntimeItemSchema } from "~/engine/runtime/schema/DeliveryRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace settleItemDeliveryRuntimeFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly generation: NonNegativeIntegerSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface SettlementResult {
		readonly acceptedQuantity: number;
		readonly status: "ignored" | "returned" | "stored";
	}

	export type Result =
		| readonly [
				SettlementResult,
				RuntimeSchema.Type,
		  ]
		| readonly [
				SettlementResult,
				RuntimeSchema.Type,
				readonly GameEventSchema.Type[],
		  ];
}

/** Applies one guarded delivery settlement to an immutable runtime draft. */
export const settleItemDeliveryRuntimeFx = Effect.fn("settleItemDeliveryRuntimeFx")(function* ({
	itemId,
	generation,
	runtime,
}: settleItemDeliveryRuntimeFx.Props) {
	return yield* Effect.gen(function* () {
		const runtimeItem = runtime.items.find((candidate) => candidate.id === itemId);
		if (runtimeItem === undefined) {
			const result: settleItemDeliveryRuntimeFx.SettlementResult = {
				acceptedQuantity: 0,
				status: "ignored",
			};
			return [
				result,
				runtime,
			] as const;
		}
		const delivery = isDeliveryRuntimeItemFn(runtimeItem);
		if (Option.isNone(delivery) || delivery.value.location.generation !== generation) {
			const result: settleItemDeliveryRuntimeFx.SettlementResult = {
				acceptedQuantity: 0,
				status: "ignored",
			};
			return [
				result,
				runtime,
			] as const;
		}
		const current = delivery.value;
		if (current.location.phase === "returning") {
			const claims = readGridLocationClaimsFn({
				runtime,
			});
			const originKey = readGridLocationKeyFn(current.location.origin);
			let conflictingClaim: (typeof claims)[number] | undefined;
			for (const claim of claims) {
				if (
					claim.itemId !== current.id &&
					readGridLocationKeyFn(claim.location) === originKey
				) {
					conflictingClaim = claim;
					break;
				}
			}
			if (conflictingClaim !== undefined) {
				return yield* Effect.die(
					new Error(
						`Delivery ${current.id} lost its canonical origin lease to ${conflictingClaim.itemId}.`,
					),
				);
			}
			const returned = yield* reviseRuntimeItemFx({
				item: {
					...current,
					location: current.location.origin,
				},
			});
			const returnedRuntime = {
				...runtime,
				items: runtime.items.map((candidate) =>
					candidate.id === returned.id ? returned : candidate,
				),
			} satisfies RuntimeSchema.Type;
			const result: settleItemDeliveryRuntimeFx.SettlementResult = {
				acceptedQuantity: 0,
				status: "returned",
			};
			return [
				result,
				returnedRuntime,
			] as const;
		}

		const target = current.location.target;
		const owner = runtime.items.find((candidate) => candidate.id === target.ownerItemId);
		const line =
			owner === undefined
				? undefined
				: yield* readItemLineFx({
						item: owner.item,
						lineId: target.lineId,
					});
		let inputRuntime = runtime;
		let source: DeliveryRuntimeItemSchema.Type | undefined = current;
		let acceptedQuantity = 0;

		if (owner?.location.scope === LocationScopeEnumSchema.enum.Board && line !== undefined) {
			for (const allocation of target.input) {
				if (source === undefined) break;
				const input = line.input[allocation.inputIndex];
				if (
					input === undefined ||
					input.type !== TypeSchema.enum.Materials ||
					(yield* isLineInputClosedFx({
						input,
						ownerItemId: owner.id,
						lineId: line.id,
						runtime: inputRuntime,
					}))
				) {
					continue;
				}
				const storedItems = yield* filterInputSlotItemsFx({
					inputIndex: allocation.inputIndex,
					items: inputRuntime.items,
					lineId: line.id,
					ownerItemId: owner.id,
				});
				const plan: planInputMaterialStoreFx.Plan | undefined =
					yield* planInputMaterialStoreFx({
						input,
						item: source,
						requestedQuantity: allocation.quantity,
						storedQuantity: storedItems.reduce(
							(total, item) => total + item.quantity,
							0,
						),
					});
				if (plan === undefined) continue;
				const applied: readonly [
					applyInputMaterialStorePlanFx.Result<DeliveryRuntimeItemSchema.Type>,
					RuntimeSchema.Type,
				] = yield* applyInputMaterialStorePlanFx({
					location: {
						scope: LocationScopeEnumSchema.enum.Input,
						ownerItemId: owner.id,
						lineId: line.id,
						inputIndex: allocation.inputIndex,
					},
					plan,
					runtime: inputRuntime,
					source,
				});
				const [storeResult, nextRuntime] = applied;
				acceptedQuantity += storeResult.storedItem.quantity;
				inputRuntime = nextRuntime;
				source = storeResult.sourceItem;
			}
		}

		// One physical contact exhausts this delivery's authored allocations exactly once.
		// A split source remainder must turn home before global reconciliation; otherwise
		// runtime-order arbitration can let this already-settled identity reclaim its old
		// allocation and preempt another delivery that is still physically approaching.
		if (source !== undefined && owner?.location.scope === LocationScopeEnumSchema.enum.Board) {
			const returningSource = yield* reviseRuntimeItemFx({
				item: {
					...source,
					location: {
						scope: LocationScopeEnumSchema.enum.Delivery,
						phase: "returning",
						generation: current.location.generation + 1,
						origin: current.location.origin,
						remainingDurationMs: yield* readDeliveryTravelDurationMsFx({
							from: owner.location,
							to: current.location.origin,
						}),
						returnFrom: owner.location,
					},
				},
			});
			inputRuntime = {
				...inputRuntime,
				items: inputRuntime.items.map((candidate) =>
					candidate.id === returningSource.id ? returningSource : candidate,
				),
			} satisfies RuntimeSchema.Type;
		}

		const isolation =
			acceptedQuantity > 0 && owner !== undefined
				? yield* isolateStatefulOwnerTransitionFx({
						ownerItemId: owner.id,
						runtime: inputRuntime,
					})
				: {
						events: [],
						runtime: inputRuntime,
					};
		const reconciledRuntime = yield* reconcileOutboundDeliveriesRuntimeFx({
			runtime: isolation.runtime,
		});
		const result: settleItemDeliveryRuntimeFx.SettlementResult = {
			acceptedQuantity,
			status: acceptedQuantity > 0 ? "stored" : "returned",
		};
		return [
			result,
			reconciledRuntime,
			isolation.events,
		] as const;
	});
});

/** Commits one guarded delivery settlement against the serialized runtime store. */
