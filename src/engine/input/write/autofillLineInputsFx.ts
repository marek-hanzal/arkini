import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { DeliveryPhaseEnumSchema } from "~/engine/delivery/schema/DeliveryPhaseEnumSchema";
import type { DeliveryPurposeSchema } from "~/engine/delivery/schema/DeliveryPurposeSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { planLineInputAutofillFx } from "~/engine/input/fx/planLineInputAutofillFx";
import { isolateStatefulOwnerTransitionFx } from "~/engine/item/fx/isolateStatefulOwnerTransitionFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace autofillLineInputsFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly purpose?: DeliveryPurposeSchema.Type;
	}

	export interface Result {
		readonly deliveryItemIds: readonly IdSchema.Type[];
		readonly scheduledQuantity: number;
		readonly remainingMissingQuantity: number;
	}
}

export namespace autofillLineInputsRuntimeFx {
	export interface Props extends autofillLineInputsFx.Props {
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly result: autofillLineInputsFx.Result;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Applies canonical delivery admission to an immutable runtime draft. */
export const autofillLineInputsRuntimeFx = Effect.fn("autofillLineInputsRuntimeFx")(function* ({
	ownerItemId,
	lineId,
	purpose = {
		kind: "fill",
	},
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
	for (const [sourceItemId, input] of allocationsBySourceItemId) {
		const runtimeSource = deliveryRuntime.items.find((item) => item.id === sourceItemId);
		if (runtimeSource === undefined) continue;
		const source = Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeSource));
		if (source === undefined) continue;
		const delivery = yield* reviseRuntimeItemFx({
			item: {
				...source,
				location: {
					scope: LocationScopeEnumSchema.enum.Delivery,
					phase: DeliveryPhaseEnumSchema.enum.Outbound,
					generation: 0,
					origin: source.location,
					purpose,
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
			...deliveryRuntime,
			items: deliveryRuntime.items.map((item) => (item.id === delivery.id ? delivery : item)),
		} satisfies RuntimeSchema.Type;
		deliveryItemIds.push(delivery.id);
	}
	if (purpose.kind === "fill-and-try-start") {
		const existingIntents = deliveryRuntime.deliveryStartIntents ?? [];
		const sameLine = (intent: (typeof existingIntents)[number]) =>
			intent.ownerItemId === purpose.ownerItemId && intent.lineId === purpose.lineId;
		const playerIntentExists = existingIntents.some(
			(intent) => sameLine(intent) && intent.source === "player",
		);
		deliveryRuntime = {
			...deliveryRuntime,
			deliveryStartIntents:
				purpose.source === "autonomous" && playerIntentExists
					? existingIntents
					: [
							...existingIntents.filter((intent) => !sameLine(intent)),
							{
								ownerItemId: purpose.ownerItemId,
								lineId: purpose.lineId,
								source: purpose.source,
							},
						],
		} satisfies RuntimeSchema.Type;
	}

	const isolation = yield* isolateStatefulOwnerTransitionFx({
		ownerItemId,
		runtime: deliveryRuntime,
	});
	return {
		events: isolation.events,
		result: {
			deliveryItemIds,
			scheduledQuantity: plan.entry.reduce((total, entry) => total + entry.quantity, 0),
			remainingMissingQuantity: plan.remainingMissingQuantity,
		},
		runtime: isolation.runtime,
	} satisfies autofillLineInputsRuntimeFx.Result;
});

/**
 * Atomically admits whole source stacks into canonical line-input deliveries.
 *
 * One physical source may claim several compatible slots on the same line; its ordered allocations
 * travel together under one runtime identity. Actual input remains unchanged until delivery
 * settlement, so readiness and start commands observe only material that has physically arrived.
 */
export const autofillLineInputsFx = Effect.fn("autofillLineInputsFx")(function* ({
	ownerItemId,
	lineId,
	purpose = {
		kind: "fill",
	},
}: autofillLineInputsFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const autofill = yield* autofillLineInputsRuntimeFx({
				ownerItemId,
				lineId,
				purpose,
				runtime,
			});
			return [
				autofill.result,
				autofill.runtime,
				autofill.events,
			] as const;
		}),
	);
});
