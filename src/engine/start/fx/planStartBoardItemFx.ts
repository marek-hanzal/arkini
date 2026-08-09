import { Effect } from "effect";

import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import type { PlacementPlanSchema } from "~/engine/placement/schema/PlacementPlanSchema";
import { planSpawnPlacementFx } from "~/engine/placement/fx/planSpawnPlacementFx";
import { readPlacementPlanQuantityFx } from "~/engine/placement/fx/readPlacementPlanQuantityFx";
import type { BoardItemSchema } from "~/engine/start/schema/BoardItemSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { StartSlotUnavailableError } from "~/engine/start/error/StartSlotUnavailableError";

export namespace planStartBoardItemFx {
	export interface Props {
		item: BoardItemSchema.Type;
	}
}

/**
 * Plans one exact initial board item without fallback or location substitution.
 */
export const planStartBoardItemFx = Effect.fn("planStartBoardItemFx")(function* ({
	item: startItem,
}: planStartBoardItemFx.Props) {
	const item = yield* resolveItemFx({
		itemId: startItem.itemId,
	});
	const quantity = startItem.quantity ?? 1;
	const spawn = yield* planSpawnPlacementFx({
		item,
		locations: [
			{
				space: startItem.space,
				position: {
					x: startItem.x,
					y: startItem.y,
				},
				scope: LocationScopeEnumSchema.enum.Board,
			},
		],
		quantity,
	});
	const plan = {
		remove: [],
		spawn,
		stack: [],
	} satisfies PlacementPlanSchema.Type;
	const placedQuantity = yield* readPlacementPlanQuantityFx({
		plan,
	});
	if (placedQuantity !== quantity) {
		return yield* Effect.fail(
			new StartSlotUnavailableError({
				itemId: startItem.itemId,
				quantity,
				remainingQuantity: quantity - placedQuantity,
				scope: LocationScopeEnumSchema.enum.Board,
			}),
		);
	}

	return plan;
});
