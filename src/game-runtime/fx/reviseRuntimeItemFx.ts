import { Effect } from "effect";

import { createRevisionFx } from "~/item-revision/fx/createRevisionFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

interface ReviseRuntimeItemProps<Item extends RuntimeItemSchema.Type> {
	item: Item;
}

/**
 * Assigns a fresh revision to one already mutated runtime item value.
 */
export const reviseRuntimeItemFx = Effect.fn("reviseRuntimeItemFx")(function* <
	Item extends RuntimeItemSchema.Type,
>({ item }: ReviseRuntimeItemProps<Item>) {
	const revision = yield* createRevisionFx();
	return {
		...item,
		revision,
	} as Item;
});
