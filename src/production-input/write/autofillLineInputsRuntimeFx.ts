import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readDeliveryTravelDurationMsFn } from "~/production-delivery/fn/readDeliveryTravelDurationMsFn";
import { DeliveryPhaseEnumSchema } from "~/production-delivery/schema/DeliveryPhaseEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { detachLineInputSourceFx } from "~/production-input/fx/detachLineInputSourceFx";
import { planLineInputAutofillFx } from "~/production-input/fx/planLineInputAutofillFx";
import { isolateStatefulOwnerTransitionFx } from "~/engine/item/fx/isolateStatefulOwnerTransitionFx";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { isGridRuntimeItemFn } from "~/game-runtime/read/fn/isGridRuntimeItemFn";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace autofillLineInputsRuntimeFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly result: {
			readonly deliveryItemIds: readonly IdSchema.Type[];
			readonly scheduledQuantity: number;
			readonly remainingMissingQuantity: number;
		};
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Applies canonical delivery admission to an immutable runtime draft. */
export const autofillLineInputsRuntimeFx = Effect.fn("autofillLineInputsRuntimeFx")(function* ({
	ownerItemId,
	lineId,
	runtime,
}: autofillLineInputsRuntimeFx.Props) {
	const plan = yield* planLineInputAutofillFx({
		ownerItemId,
		lineId,
		runtime,
	});
	if (plan.entry.length === 0) {
		return {
			events: [],
			result: {
				deliveryItemIds: [],
				scheduledQuantity: 0,
				remainingMissingQuantity: plan.remainingMissingQuantity,
			},
			runtime,
		} satisfies autofillLineInputsRuntimeFx.Result;
	}

	const allocationsBySourceItemId = new Map<
		IdSchema.Type,
		{
			readonly inputIndex: number;
			readonly quantity: number;
		}[]
	>();
	for (const entry of plan.entry) {
		const allocations = allocationsBySourceItemId.get(entry.sourceItemId);
		const allocation = {
			inputIndex: entry.inputIndex,
			quantity: entry.quantity,
		};
		if (allocations === undefined) {
			allocationsBySourceItemId.set(entry.sourceItemId, [
				allocation,
			]);
		} else {
			allocations.push(allocation);
		}
	}

	let deliveryRuntime = runtime;
	const deliveryItemIds: IdSchema.Type[] = [];
	const events: GameEventSchema.Type[] = [];
	let scheduledQuantity = 0;
	let skippedQuantity = 0;
	for (const [sourceItemId, input] of allocationsBySourceItemId) {
		const runtimeSource = deliveryRuntime.items.find((item) => item.id === sourceItemId);
		if (runtimeSource === undefined) continue;
		const source = Option.getOrUndefined(isGridRuntimeItemFn(runtimeSource));
		if (source === undefined) continue;
		const runtimeOwner = deliveryRuntime.items.find((item) => item.id === ownerItemId);
		const owner =
			runtimeOwner === undefined
				? undefined
				: Option.getOrUndefined(isGridRuntimeItemFn(runtimeOwner));
		if (owner === undefined) continue;
		const detached = yield* detachLineInputSourceFx({
			runtime: deliveryRuntime,
			source,
		});
		if (detached.type === "active-job") {
			skippedQuantity += input.reduce((total, allocation) => total + allocation.quantity, 0);
			continue;
		}
		const delivery = yield* reviseRuntimeItemFx({
			item: {
				...source,
				location: {
					scope: LocationScopeEnumSchema.enum.Delivery,
					phase: DeliveryPhaseEnumSchema.enum.Outbound,
					generation: 0,
					origin: source.location,
					remainingDurationMs: readDeliveryTravelDurationMsFn({
						from: source.location,
						to: owner.location,
					}),
					target: {
						kind: "line-input",
						ownerItemId,
						lineId,
						input,
					},
				},
			},
		});
		deliveryRuntime = {
			...detached.runtime,
			items: [
				...detached.runtime.items.slice(0, detached.insertionIndex),
				delivery,
				...detached.runtime.items.slice(detached.insertionIndex),
			],
		} satisfies RuntimeSchema.Type;
		events.push(...detached.events);
		deliveryItemIds.push(delivery.id);
		scheduledQuantity += input.reduce((total, allocation) => total + allocation.quantity, 0);
	}
	const isolation = yield* isolateStatefulOwnerTransitionFx({
		ownerItemId,
		runtime: deliveryRuntime,
	});
	return {
		events: [
			...events,
			...isolation.events,
		],
		result: {
			deliveryItemIds,
			scheduledQuantity,
			remainingMissingQuantity: plan.remainingMissingQuantity + skippedQuantity,
		},
		runtime: isolation.runtime,
	} satisfies autofillLineInputsRuntimeFx.Result;
});
