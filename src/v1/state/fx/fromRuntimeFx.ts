import { Effect } from "effect";

import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { StateSchema } from "~/v1/state/schema/StateSchema";
import { fromRuntimeBoardItemFx } from "./fromRuntimeBoardItemFx";
import { fromRuntimeInventoryItemFx } from "./fromRuntimeInventoryItemFx";

export namespace fromRuntimeFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Builds serializable state from the core runtime using canonical item IDs.
 *
 * Counterpart: `fromStateFx` in `~/v1/runtime/fx/fromStateFx` builds the
 * runtime from this state.
 */
export const fromRuntimeFx = Effect.fn("fromRuntimeFx")(function* ({
	runtime,
}: fromRuntimeFx.Props) {
	const boardItems = yield* Effect.forEach(runtime.board.items, (item) => {
		return fromRuntimeBoardItemFx({
			item,
		});
	});
	const inventorySlots = yield* Effect.forEach(runtime.inventory.slots, (item) => {
		if (item === null) {
			return Effect.succeed(null);
		}

		return fromRuntimeInventoryItemFx({
			item,
		});
	});
	const result = {
		board: {
			items: boardItems,
		},
		inventory: {
			slots: inventorySlots,
		},
	};

	return result satisfies StateSchema.Type;
});
