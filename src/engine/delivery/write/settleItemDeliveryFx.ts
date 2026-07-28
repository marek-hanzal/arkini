import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { reconcileOutboundDeliveriesRuntimeFx } from "~/engine/delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import { fulfillDeliveryStartPurposesRuntimeFx } from "~/engine/delivery/fx/fulfillDeliveryStartPurposesRuntimeFx";
import type { DeliveryPurposeSchema } from "~/engine/delivery/schema/DeliveryPurposeSchema";
import { applyInputMaterialStorePlanFx } from "~/engine/input/fx/applyInputMaterialStorePlanFx";
import { planInputMaterialStoreFx } from "~/engine/input/fx/planInputMaterialStoreFx";
import { filterInputSlotItemsFx } from "~/engine/input/read/filterInputSlotItemsFx";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";
import type { InputMaterialStorePlanSchema } from "~/engine/input/schema/store/InputMaterialStorePlanSchema";
import { isolateStatefulOwnerTransitionFx } from "~/engine/item/fx/isolateStatefulOwnerTransitionFx";
import { isLineInputClosedFx } from "~/engine/line/fx/input/isLineInputClosedFx";
import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import { readGridLocationClaimsFx } from "~/engine/location/read/readGridLocationClaimsFx";
import { readGridLocationKey } from "~/engine/location/read/readGridLocationOccupantsFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isDeliveryRuntimeItemFx } from "~/engine/runtime/read/isDeliveryRuntimeItemFx";
import type { DeliveryRuntimeItemSchema } from "~/engine/runtime/schema/DeliveryRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace settleItemDeliveryFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly generation: NonNegativeIntegerSchema.Type;
	}

	export interface Result {
		readonly acceptedQuantity: number;
		readonly purpose?: DeliveryPurposeSchema.Type;
		readonly status: "ignored" | "returned" | "stored";
	}
}

/**
 * Commits one presentation contact against the exact canonical delivery generation.
 *
 * Missing and superseded completions are ordinary idempotent no-ops. Outbound material is admitted
 * only against current physical input truth; a remainder is reconciled into a return. Returning
 * material may reclaim only its retained origin lease.
 */
export const settleItemDeliveryFx = Effect.fn("settleItemDeliveryFx")(function* ({
	itemId,
	generation,
}: settleItemDeliveryFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const runtimeItem = runtime.items.find((candidate) => candidate.id === itemId);
			if (runtimeItem === undefined) {
				const result: settleItemDeliveryFx.Result = {
					acceptedQuantity: 0,
					status: "ignored",
				};
				return [
					result,
					runtime,
				] as const;
			}
			const delivery = yield* isDeliveryRuntimeItemFx(runtimeItem);
			if (Option.isNone(delivery) || delivery.value.location.generation !== generation) {
				const result: settleItemDeliveryFx.Result = {
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
				const claims = yield* readGridLocationClaimsFx({
					runtime,
				});
				const conflictingClaim = claims.find(
					(claim) =>
						claim.itemId !== current.id &&
						readGridLocationKey(claim.location) ===
							readGridLocationKey(current.location.origin),
				);
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
				const result: settleItemDeliveryFx.Result = {
					acceptedQuantity: 0,
					purpose: current.location.purpose,
					status: "returned",
				};
				return [
					result,
					returnedRuntime,
				] as const;
			}

			const purpose = current.location.purpose;
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

			if (
				owner?.location.scope === LocationScopeEnumSchema.enum.Board &&
				line !== undefined
			) {
				for (const allocation of target.input) {
					if (source === undefined) break;
					const input = line.input[allocation.inputIndex];
					if (
						input === undefined ||
						input.type !== InputEnumSchema.enum.Materials ||
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
					const plan: InputMaterialStorePlanSchema.Type | undefined =
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
			if (
				source !== undefined &&
				owner?.location.scope === LocationScopeEnumSchema.enum.Board
			) {
				const returningSource = yield* reviseRuntimeItemFx({
					item: {
						...source,
						location: {
							scope: LocationScopeEnumSchema.enum.Delivery,
							phase: "returning",
							generation: current.location.generation + 1,
							origin: current.location.origin,
							purpose,
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
			const fulfilledPurposes = yield* fulfillDeliveryStartPurposesRuntimeFx({
				purposes: [
					purpose,
				],
				runtime: reconciledRuntime,
			});
			const result: settleItemDeliveryFx.Result = {
				acceptedQuantity,
				purpose,
				status: acceptedQuantity > 0 ? "stored" : "returned",
			};
			return [
				result,
				fulfilledPurposes.runtime,
				[
					...isolation.events,
					...fulfilledPurposes.events,
				],
			] as const;
		}),
	);
});
