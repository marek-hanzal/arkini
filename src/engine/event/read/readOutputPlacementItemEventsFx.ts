import { Effect } from "effect";

import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import type { OutputPlacementResultSchema } from "~/engine/placement/schema/OutputPlacementResultSchema";

/** Translates concrete placement results into exact committed spawn and stack facts. */
export const readOutputPlacementItemEventsFx = Effect.fn("readOutputPlacementItemEventsFx")(
	function* (placement: OutputPlacementResultSchema.Type) {
		const events: GameEventSchema.Type[] = [];
		for (const drop of placement.drop) {
			for (const stack of drop.placement.stack) {
				if (stack.item.location.scope === "job" || stack.item.location.scope === "reserved") {
					continue;
				}
				events.push({
					type: "item:stacked",
					itemId: stack.item.id,
					canonicalItemId: stack.item.item.id,
					location: stack.item.location,
					previousQuantity: stack.item.quantity - stack.quantity,
					quantity: stack.item.quantity,
				});
			}
			for (const item of drop.placement.spawn) {
				if (item.location.scope === "job" || item.location.scope === "reserved") continue;
				events.push({
					type: "item:spawned",
					itemId: item.id,
					canonicalItemId: item.item.id,
					location: item.location,
					quantity: item.quantity,
				});
			}
		}
		return events;
	},
);
