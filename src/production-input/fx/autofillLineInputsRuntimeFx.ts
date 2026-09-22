import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { readDeliveryTravelDurationMsFn } from "~/production-delivery/fn/readDeliveryTravelDurationMsFn";
import { DeliveryPhaseEnumSchema } from "~/production-delivery/schema/DeliveryPhaseEnumSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { detachLineInputSourceFx } from "~/production-input/fx/detachLineInputSourceFx";
import { planLineInputAutofillFx } from "~/production-input/fx/planLineInputAutofillFx";
import { isolateBoardStatefulOwnerTransitionFx } from "~/item-state-isolation/fx/isolateBoardStatefulOwnerTransitionFx";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace autofillLineInputsRuntimeFx {
	export interface Props {
		readonly inputIndex?: number;
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
	inputIndex,
	runtime,
}: autofillLineInputsRuntimeFx.Props) {
	const plan = yield* planLineInputAutofillFx({
		inputIndex,
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
	let scheduledQuantity = 0;
	let skippedQuantity = 0;
	for (const [sourceItemId, input] of allocationsBySourceItemId) {
		const runtimeSource = deliveryRuntime.items.find((item) => item.id === sourceItemId);
		if (runtimeSource === undefined) continue;
		const source = Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeSource));
		if (source === undefined) continue;
		const runtimeOwner = deliveryRuntime.items.find((item) => item.id === ownerItemId);
		const owner =
			runtimeOwner === undefined
				? undefined
				: Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeOwner));
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
		deliveryItemIds.push(delivery.id);
		scheduledQuantity += input.reduce((total, allocation) => total + allocation.quantity, 0);
	}
	const isolation = yield* isolateBoardStatefulOwnerTransitionFx({
		ownerItemId,
		runtime: deliveryRuntime,
	});
	// Delivery admission is the fact; arrival emits its own input-storage event later.
	const events: GameEventSchema.Type[] = [
		...isolation.events,
	];
	if (scheduledQuantity > 0) {
		const owner = yield* readRuntimeItemByIdFx({
			itemId: ownerItemId,
			runtime,
		});
		events.push({
			type: GameEventEnumSchema.enum.LineInputAutofillStarted,
			ownerItemId,
			canonicalItemId: owner.item.id,
			lineId,
			scheduledQuantity,
		});
	}
	return {
		events,
		result: {
			deliveryItemIds,
			scheduledQuantity,
			remainingMissingQuantity: plan.remainingMissingQuantity + skippedQuantity,
		},
		runtime: isolation.runtime,
	} satisfies autofillLineInputsRuntimeFx.Result;
});
