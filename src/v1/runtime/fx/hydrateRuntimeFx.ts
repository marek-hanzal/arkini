import { Effect } from "effect";

import type { GameSchema } from "~/v1/schema/GameSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { StateSchema } from "~/v1/state/schema/StateSchema";
import { hydrateRuntimeBoardItemFx } from "./hydrateRuntimeBoardItemFx";
import { hydrateRuntimeInventoryItemFx } from "./hydrateRuntimeInventoryItemFx";

export namespace hydrateRuntimeFx {
	export interface Props {
		game: GameSchema.Type;
		state: StateSchema.Type;
	}
}

/**
 * Hydrates serializable state into the core runtime with canonical item references.
 */
export const hydrateRuntimeFx = Effect.fn("hydrateRuntimeFx")(function* ({
	game,
	state,
}: hydrateRuntimeFx.Props) {
	const boardItems = yield* Effect.forEach(state.board.items, (state) => {
		return hydrateRuntimeBoardItemFx({
			game,
			state,
		});
	});
	const inventorySlots = yield* Effect.forEach(state.inventory.slots, (state) => {
		if (state === null) {
			return Effect.succeed(null);
		}

		return hydrateRuntimeInventoryItemFx({
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
