import { Effect } from "effect";

import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { planStartExactGridStackFx } from "~/engine/start/fx/planStartExactGridStackFx";
import type { BoardItemSchema } from "~/engine/start/schema/BoardItemSchema";

export namespace planStartBoardItemFx {
	export interface Props {
		item: BoardItemSchema.Type;
	}
}

/** Plans one exact initial board stack without fallback or location substitution. */
export const planStartBoardItemFx = Effect.fn("planStartBoardItemFx")(function* ({
	item: startItem,
}: planStartBoardItemFx.Props) {
	return yield* planStartExactGridStackFx({
		itemId: startItem.itemId,
		location: {
			space: startItem.space,
			position: {
				x: startItem.x,
				y: startItem.y,
			},
			scope: LocationScopeEnumSchema.enum.Board,
		},
		quantity: startItem.quantity ?? 1,
	});
});
