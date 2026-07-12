import { Effect } from "effect";

import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { SelectorTagSchema } from "~/v1/selector/schema/SelectorTagSchema";

export namespace selectorTagFx {
	export interface Props {
		selector: SelectorTagSchema.Type;
		item: ItemSchema.Type;
	}
}

/**
 * Tests whether a canonical item has the tag selected by a tag selector.
 */
export const selectorTagFx = Effect.fn("selectorTagFx")(function* ({
	selector,
	item,
}: selectorTagFx.Props) {
	const result = item.tags.includes(selector.tag);

	return result;
});
