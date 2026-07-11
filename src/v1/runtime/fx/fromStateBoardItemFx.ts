import { Effect } from "effect";

import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
import type { RuntimeBoardItemSchema } from "~/v1/runtime/schema/RuntimeBoardItemSchema";
import type { StateBoardItemSchema } from "~/v1/state/schema/StateBoardItemSchema";

export namespace fromStateBoardItemFx {
	export interface Props {
		state: StateBoardItemSchema.Type;
	}
}

/**
 * Builds one runtime board item from its persisted state representation.
 *
 * Counterpart: `fromRuntimeBoardItemFx` in
 * `~/v1/state/fx/fromRuntimeBoardItemFx` builds state from this runtime item.
 */
export const fromStateBoardItemFx = Effect.fn("fromStateBoardItemFx")(function* ({
	state,
}: fromStateBoardItemFx.Props) {
	const item = yield* resolveItemFx({
		itemId: state.itemId,
	});
	const result = {
		id: state.id,
		item,
		quantity: state.quantity,
		x: state.x,
		y: state.y,
	};

	return result satisfies RuntimeBoardItemSchema.Type;
});
