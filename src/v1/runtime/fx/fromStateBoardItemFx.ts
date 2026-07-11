import { Effect } from "effect";

import type { GameSchema } from "~/v1/schema/GameSchema";
import type { RuntimeBoardItemSchema } from "~/v1/runtime/schema/RuntimeBoardItemSchema";
import type { StateBoardItemSchema } from "~/v1/state/schema/StateBoardItemSchema";
import { resolveRuntimeItemFx } from "./resolveRuntimeItemFx";

export namespace fromStateBoardItemFx {
	export interface Props {
		game: GameSchema.Type;
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
	game,
	state,
}: fromStateBoardItemFx.Props) {
	const item = yield* resolveRuntimeItemFx({
		game,
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
