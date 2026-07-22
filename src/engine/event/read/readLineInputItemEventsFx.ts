import { Effect } from "effect";

import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import type { applyInputMaterialConsumeRunPlanFx } from "~/engine/input/fx/run/applyInputMaterialConsumeRunPlanFx";

/** Translates exact accepted input consume transitions into ordered semantic facts. */
export const readLineInputItemEventsFx = Effect.fn("readLineInputItemEventsFx")(function* (
	consumption: readonly applyInputMaterialConsumeRunPlanFx.Consumption[],
) {
	return consumption.map(
		({ sourceItem, consumedItem, remainingQuantity }) =>
			({
				type: "item:consumed",
				itemId: sourceItem.id,
				consumedItemId: consumedItem.id,
				canonicalItemId: sourceItem.item.id,
				previousLocation: sourceItem.location,
				location: consumedItem.location,
				previousQuantity: sourceItem.quantity,
				consumedQuantity: consumedItem.quantity,
				quantity: remainingQuantity,
			}) satisfies GameEventSchema.Type,
	);
});
