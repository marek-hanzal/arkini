import { Effect } from "effect";

import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { SelectorItemSchema } from "~/v1/selector/schema/SelectorItemSchema";

export namespace selectorItemFx {
	export interface Props {
		selector: SelectorItemSchema.Type;
		item: ItemSchema.Type;
	}
}

/**
 * Tests whether a canonical item has the ID selected by an item selector.
 */
export const selectorItemFx = Effect.fn("selectorItemFx")(function* ({
	selector,
	item,
}: selectorItemFx.Props) {
	const result = selector.itemId === item.id;

	return result;
});
