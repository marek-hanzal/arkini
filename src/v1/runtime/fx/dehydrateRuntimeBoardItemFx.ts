import { Effect } from "effect";

import type { RuntimeBoardItemSchema } from "~/v1/runtime/schema/RuntimeBoardItemSchema";
import type { StateBoardItemSchema } from "~/v1/state/schema/StateBoardItemSchema";

export namespace dehydrateRuntimeBoardItemFx {
	export interface Props {
		item: RuntimeBoardItemSchema.Type;
	}

	export type Result = StateBoardItemSchema.Type;
}

/** Replaces one runtime board item's canonical object with its stable item ID. */
export const dehydrateRuntimeBoardItemFx = Effect.fn("dehydrateRuntimeBoardItemFx")(function* ({
	item,
}: dehydrateRuntimeBoardItemFx.Props) {
	const result = {
		id: item.id,
		itemId: item.item.id,
		quantity: item.quantity,
		x: item.x,
		y: item.y,
	};

	return result satisfies dehydrateRuntimeBoardItemFx.Result;
});
