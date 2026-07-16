import { Effect } from "effect";

import { createRevisionFx } from "~/engine/revision/fx/createRevisionFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

export namespace reviseRuntimeItemFx {
	export interface Props<Item extends RuntimeItemSchema.Type> {
		item: Item;
	}
}

/**
 * Assigns a fresh revision to one already mutated runtime item value.
 */
export const reviseRuntimeItemFx = <Item extends RuntimeItemSchema.Type>({
	item,
}: reviseRuntimeItemFx.Props<Item>) => {
	return createRevisionFx().pipe(
		Effect.map((revision) => {
			return {
				...item,
				revision,
			} as Item;
		}),
		Effect.withSpan("reviseRuntimeItemFx"),
	);
};
