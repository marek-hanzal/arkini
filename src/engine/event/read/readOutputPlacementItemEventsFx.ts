import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import type { applyOutputPlacementFx } from "~/engine/placement/fx/applyOutputPlacementFx";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";

export namespace readOutputPlacementItemEventsFx {
	export interface Props {
		readonly originItemId: IdSchema.Type;
		readonly placement: applyOutputPlacementFx.Result;
	}
}

/** Translates concrete placement results into exact committed spawn and stack facts. */
export const readOutputPlacementItemEventsFx = Effect.fn("readOutputPlacementItemEventsFx")(
	function* ({ originItemId, placement }: readOutputPlacementItemEventsFx.Props) {
		const events: GameEventSchema.Type[] = [];
		for (const drop of placement.drop) {
			for (const stack of drop.placement.stack) {
				const stackedItem = Option.getOrUndefined(yield* isGridRuntimeItemFx(stack.item));
				if (stackedItem === undefined) {
					return yield* Effect.die(
						new Error(
							`Output placement stacked ${stack.item.id} outside a visible grid scope.`,
						),
					);
				}
				events.push({
					type: GameEventEnumSchema.enum.ItemStacked,
					itemId: stackedItem.id,
					canonicalItemId: stackedItem.item.id,
					originItemId,
					location: stackedItem.location,
					previousQuantity: stackedItem.quantity - stack.quantity,
					quantity: stackedItem.quantity,
				});
			}
			for (const runtimeItem of drop.placement.spawn) {
				const item = Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeItem));
				if (item === undefined) {
					return yield* Effect.die(
						new Error(
							`Output placement spawned ${runtimeItem.id} outside a visible grid scope.`,
						),
					);
				}
				events.push({
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: item.id,
					canonicalItemId: item.item.id,
					originItemId,
					location: item.location,
					quantity: item.quantity,
				});
			}
		}
		return events;
	},
);
