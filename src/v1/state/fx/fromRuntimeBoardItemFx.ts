import { Effect } from "effect";

import type { RuntimeBoardItemSchema } from "~/v1/runtime/schema/RuntimeBoardItemSchema";
import type { StateBoardItemSchema } from "~/v1/state/schema/StateBoardItemSchema";

export namespace fromRuntimeBoardItemFx {
	export interface Props {
		item: RuntimeBoardItemSchema.Type;
	}
}

/**
 * Builds one persisted board item from its runtime representation.
 *
 * Counterpart: `fromStateBoardItemFx` in
 * `~/v1/runtime/fx/fromStateBoardItemFx` builds runtime from this state item.
 */
export const fromRuntimeBoardItemFx = Effect.fn("fromRuntimeBoardItemFx")(function* ({
	item,
}: fromRuntimeBoardItemFx.Props) {
	const result = {
		id: item.id,
		itemId: item.item.id,
		quantity: item.quantity,
		x: item.x,
		y: item.y,
	};

	return result satisfies StateBoardItemSchema.Type;
});
