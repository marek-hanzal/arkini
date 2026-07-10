import { Effect } from "effect";

import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { StateSchema } from "~/v1/state/schema/StateSchema";
import { dehydrateRuntimeBoardItemFx } from "./dehydrateRuntimeBoardItemFx";
import { dehydrateRuntimeInventoryItemFx } from "./dehydrateRuntimeInventoryItemFx";

export namespace dehydrateRuntimeFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}

	export type Result = StateSchema.Type;
}

/** Dehydrates the core runtime into serializable state containing canonical item IDs. */
export const dehydrateRuntimeFx = Effect.fn("dehydrateRuntimeFx")(function* ({
	runtime,
}: dehydrateRuntimeFx.Props) {
	const boardItems = yield* Effect.forEach(runtime.board.items, (item) => {
		return dehydrateRuntimeBoardItemFx({
			item,
		});
	});
	const inventorySlots = yield* Effect.forEach(runtime.inventory.slots, (item) => {
		if (item === null) {
			return Effect.succeed(null);
		}

		return dehydrateRuntimeInventoryItemFx({
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

	return result satisfies dehydrateRuntimeFx.Result;
});
