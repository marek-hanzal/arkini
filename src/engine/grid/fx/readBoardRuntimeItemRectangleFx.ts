import { Effect } from "effect";

import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";

import { readBoardItemRectangleFx } from "./readBoardItemRectangleFx";

/** Projects one hydrated Board runtime item to its authoritative occupied rectangle. */
export const readBoardRuntimeItemRectangleFx = Effect.fn("readBoardRuntimeItemRectangleFx")(
	function* ({ item }: { readonly item: BoardRuntimeItemSchema.Type }) {
		return yield* readBoardItemRectangleFx({
			anchor: item.location,
			item: item.item,
		});
	},
);
