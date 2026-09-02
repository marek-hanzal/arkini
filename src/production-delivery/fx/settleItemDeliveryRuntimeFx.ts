import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { readDeliveryTravelDurationMsFn } from "~/production-delivery/fn/readDeliveryTravelDurationMsFn";
import { reconcileOutboundDeliveriesRuntimeFx } from "~/production-delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { applyInputMaterialStorePlanFx } from "~/production-input/fx/applyInputMaterialStorePlanFx";
import { planInputMaterialStoreFn } from "~/production-input/fn/planInputMaterialStoreFn";
import { filterInputSlotItemsFn } from "~/production-input/fn/filterInputSlotItemsFn";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import { isolateBoardStatefulOwnerTransitionFx } from "~/item-state-isolation/fx/isolateBoardStatefulOwnerTransitionFx";
import { isLineInputClosedFn } from "~/production-line/fn/isLineInputClosedFn";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import { readGridLocationClaimsFn } from "~/item-location/fn/readGridLocationClaimsFn";
import { readGridLocationKeyFn } from "~/item-location/fn/readGridLocationKeyFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { narrowDeliveryRuntimeItemFn } from "~/game-runtime/fn/narrowDeliveryRuntimeItemFn";
import type { DeliveryRuntimeItemSchema } from "~/game-runtime/schema/DeliveryRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

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
		const delivery = narrowDeliveryRuntimeItemFn(runtimeItem);
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
				: readItemLineFn({
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
					isLineInputClosedFn({
						input,
						ownerItemId: owner.id,
						lineId: line.id,
						runtime: inputRuntime,
					})
				) {
					continue;
				}
				const storedItems = filterInputSlotItemsFn({
					inputIndex: allocation.inputIndex,
					items: inputRuntime.items,
					lineId: line.id,
					ownerItemId: owner.id,
				});
				const plan: planInputMaterialStoreFn.Plan | undefined = planInputMaterialStoreFn({
					input,
					item: source,
					requestedQuantity: allocation.quantity,
					storedQuantity: storedItems.reduce((total, item) => total + item.quantity, 0),
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
						remainingDurationMs: readDeliveryTravelDurationMsFn({
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
				? yield* isolateBoardStatefulOwnerTransitionFx({
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
