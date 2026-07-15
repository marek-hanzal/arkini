import { Effect } from "effect";

import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
import type { PlacementPlanSchema } from "~/v1/placement/schema/PlacementPlanSchema";
import { planSpawnPlacementFx } from "~/v1/placement/fx/planSpawnPlacementFx";
import type { BoardItemSchema } from "~/v1/start/schema/BoardItemSchema";

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
				scope: "board",
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
