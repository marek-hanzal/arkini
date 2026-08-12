import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { reconcileOutboundDeliveriesRuntimeFx } from "~/engine/delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
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
import { isDeliveryRuntimeItemFx } from "~/engine/runtime/read/isDeliveryRuntimeItemFx";
import type { DeliveryRuntimeItemSchema } from "~/engine/runtime/schema/DeliveryRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace settleItemDeliveryRuntimeFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly generation: NonNegativeIntegerSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface DeliveryResult {
		readonly acceptedQuantity: number;
		readonly status: "ignored" | "returned" | "stored";
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly result: DeliveryResult;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Commits one canonical delivery contact to an immutable runtime candidate. */
export const settleItemDeliveryRuntimeFx = Effect.fn("settleItemDeliveryRuntimeFx")(function* ({
	itemId,
	generation,
	runtime,
}: settleItemDeliveryRuntimeFx.Props) {
	const runtimeItem = runtime.items.find((candidate) => candidate.id === itemId);
	if (runtimeItem === undefined) {
		return {
			events: [],
			result: {
				acceptedQuantity: 0,
				status: "ignored",
			},
			runtime,
		} satisfies settleItemDeliveryRuntimeFx.Result;
	}
	const delivery = yield* isDeliveryRuntimeItemFx(runtimeItem);
	if (Option.isNone(delivery) || delivery.value.location.generation !== generation) {
		return {
			events: [],
			result: {
				acceptedQuantity: 0,
				status: "ignored",
			},
			runtime,
		} satisfies settleItemDeliveryRuntimeFx.Result;
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
		return {
			events: [],
			result: {
				acceptedQuantity: 0,
				status: "returned",
			},
			runtime: {
				...runtime,
				items: runtime.items.map((candidate) =>
					candidate.id === returned.id ? returned : candidate,
				),
			} satisfies RuntimeSchema.Type,
		} satisfies settleItemDeliveryRuntimeFx.Result;
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

	if (source !== undefined && owner?.location.scope === LocationScopeEnumSchema.enum.Board) {
		const returningSource = yield* reviseRuntimeItemFx({
			item: {
				...source,
				location: {
					scope: LocationScopeEnumSchema.enum.Delivery,
					phase: "returning",
					generation: current.location.generation + 1,
					origin: current.location.origin,
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
	return {
		events: isolation.events,
		result: {
			acceptedQuantity,
			status: acceptedQuantity > 0 ? "stored" : "returned",
		},
		runtime: reconciledRuntime,
	} satisfies settleItemDeliveryRuntimeFx.Result;
});
