import { Effect } from "effect";

import type { GameSchema } from "~/v1/schema/GameSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { StateSchema } from "~/v1/state/schema/StateSchema";
import { fromStateBoardItemFx } from "./fromStateBoardItemFx";
import { fromStateInventoryItemFx } from "./fromStateInventoryItemFx";

export namespace fromStateFx {
	export interface Props {
		game: GameSchema.Type;
		state: StateSchema.Type;
	}
}

/**
 * Builds the core runtime from serializable state and canonical game items.
 *
 * Counterpart: `fromRuntimeFx` in `~/v1/state/fx/fromRuntimeFx` builds
 * serializable state from this runtime.
 */
export const fromStateFx = Effect.fn("fromStateFx")(function* ({ game, state }: fromStateFx.Props) {
	const boardItems = yield* Effect.forEach(state.board.items, (state) => {
		return fromStateBoardItemFx({
			game,
			state,
		});
	});
	const inventorySlots = yield* Effect.forEach(state.inventory.slots, (state) => {
		if (state === null) {
			return Effect.succeed(null);
		}

		return fromStateInventoryItemFx({
			game,
			state,
		});
	});
	const result = {
		game,
		board: {
			items: boardItems,
		},
		inventory: {
			slots: inventorySlots,
		},
	};

	return result satisfies RuntimeSchema.Type;
});
