import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import { readDeliveryTravelDurationMsFn } from "~/production-delivery/fn/readDeliveryTravelDurationMsFn";
import { DeliveryPhaseEnumSchema } from "~/production-delivery/schema/DeliveryPhaseEnumSchema";
import type { EngineFact } from "~/game-event/type/EngineFact";
import { detachLineInputSourceFx } from "~/production-input/fx/detachLineInputSourceFx";
import { planLineInputAutofillFx } from "~/production-input/fx/planLineInputAutofillFx";
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
		readonly facts: readonly EngineFact[];
		readonly result: {
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
			facts: [],
			result: {
				scheduledQuantity: 0,
				remainingMissingQuantity: plan.remainingMissingQuantity,
			},
			runtime,
		} satisfies autofillLineInputsRuntimeFx.Result;
	}

	let deliveryRuntime = runtime;
	const admittedDeliveries: {
		id: IdSchema.Type;
		revision: RevisionSchema.Type;
	}[] = [];
	let scheduledQuantity = 0;
	let skippedQuantity = 0;
	for (const { sourceItemId, inputIndex } of plan.entry) {
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
			skippedQuantity += 1;
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
						inputIndex,
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
		admittedDeliveries.push({
			id: delivery.id,
			revision: delivery.revision,
		});
		scheduledQuantity += 1;
	}
	const facts: EngineFact[] = [];
	if (scheduledQuantity > 0) {
		const owner = yield* readRuntimeItemByIdFx({
			itemId: ownerItemId,
			runtime,
		});
		facts.push({
			type: "autofill:admitted",
			ownerItemId,
			itemUid: owner.item.uid,
			lineId,
			deliveries: admittedDeliveries,
		});
	}
	return {
		facts,
		result: {
			scheduledQuantity,
			remainingMissingQuantity: plan.remainingMissingQuantity + skippedQuantity,
		},
		runtime: deliveryRuntime,
	} satisfies autofillLineInputsRuntimeFx.Result;
});
