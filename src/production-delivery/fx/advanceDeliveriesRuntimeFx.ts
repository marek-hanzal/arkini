import { Effect } from "effect";

import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { isInstantGameplayEnabledFn } from "~/game-runtime/fn/isInstantGameplayEnabledFn";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { settleItemDeliveryRuntimeFx } from "~/production-delivery/fx/settleItemDeliveryRuntimeFx";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";

interface AdvanceDeliveriesRuntimeResult {
	readonly events: readonly GameEventSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}

/** Advances and settles the step-start delivery identities in stable id order. */
export const advanceDeliveriesRuntimeFx = Effect.fn("advanceDeliveriesRuntimeFx")(function* (
	runtime: RuntimeSchema.Type,
) {
	const instantGameplay = isInstantGameplayEnabledFn({
		runtime,
	});
	const deliveryIds = runtime.items
		.filter((item) => item.location.scope === LocationScopeEnumSchema.enum.Delivery)
		.map((item) => item.id)
		.sort((first, second) => first.localeCompare(second));
	let draft = runtime;
	for (const itemId of deliveryIds) {
		const liveItem = draft.items.find((item) => item.id === itemId);
		if (liveItem?.location.scope !== LocationScopeEnumSchema.enum.Delivery) continue;
		if (liveItem.location.remainingDurationMs === 0) continue;
		const advanced = {
			...liveItem,
			location: {
				...liveItem.location,
				remainingDurationMs: instantGameplay
					? 0
					: Math.max(0, liveItem.location.remainingDurationMs - SimulationStepMs),
			},
		};
		draft = {
			...draft,
			items: draft.items.map((item) => (item.id === itemId ? advanced : item)),
		};
	}

	const events: GameEventSchema.Type[] = [];
	for (const itemId of deliveryIds) {
		const liveItem = draft.items.find((item) => item.id === itemId);
		if (
			liveItem?.location.scope !== LocationScopeEnumSchema.enum.Delivery ||
			liveItem.location.remainingDurationMs !== 0
		)
			continue;
		const [, settledRuntime, settledEvents = []] = yield* settleItemDeliveryRuntimeFx({
			itemId,
			generation: liveItem.location.generation,
			runtime: draft,
		});
		draft = settledRuntime;
		events.push(...settledEvents);
	}

	return {
		events,
		runtime: draft,
	} satisfies AdvanceDeliveriesRuntimeResult;
});
