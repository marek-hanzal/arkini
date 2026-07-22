import { Effect } from "effect";

import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import type { PlacementPlanSchema } from "~/engine/placement/schema/PlacementPlanSchema";
import { planSpawnPlacementFx } from "~/engine/placement/fx/planSpawnPlacementFx";
import type { BoardItemSchema } from "~/engine/start/schema/BoardItemSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

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
		quantity: 1,
	});

	return {
		remove: [],
		spawn,
		stack: [],
	} satisfies PlacementPlanSchema.Type;
});
