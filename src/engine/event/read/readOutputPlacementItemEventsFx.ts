import { Effect } from "effect";

import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import type { OutputPlacementResultSchema } from "~/engine/placement/schema/OutputPlacementResultSchema";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";

/** Translates concrete placement results into exact committed spawn and stack facts. */
export const readOutputPlacementItemEventsFx = Effect.fn("readOutputPlacementItemEventsFx")(
	function* (placement: OutputPlacementResultSchema.Type) {
		const events: GameEventSchema.Type[] = [];
		for (const drop of placement.drop) {
			for (const stack of drop.placement.stack) {
				if (!isGridRuntimeItem(stack.item)) {
					return yield* Effect.dieMessage(
						`Output placement stacked ${stack.item.id} outside a visible grid scope.`,
					);
				}
				events.push({
					type: GameEventEnumSchema.enum.ItemStacked,
					itemId: stack.item.id,
					canonicalItemId: stack.item.item.id,
					location: stack.item.location,
					previousQuantity: stack.item.quantity - stack.quantity,
					quantity: stack.item.quantity,
				});
			}
			for (const item of drop.placement.spawn) {
				if (!isGridRuntimeItem(item)) {
					return yield* Effect.dieMessage(
						`Output placement spawned ${item.id} outside a visible grid scope.`,
					);
				}
				events.push({
					type: GameEventEnumSchema.enum.ItemSpawned,
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
