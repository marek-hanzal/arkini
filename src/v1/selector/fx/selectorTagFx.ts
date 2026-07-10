import { Effect } from "effect";

import type { BaseItemSchema } from "~/v1/item/schema/BaseItemSchema";
import type { SelectorTagSchema } from "~/v1/selector/schema/SelectorTagSchema";

export namespace selectorTagFx {
	export interface Props {
		selector: SelectorTagSchema.Type;
		item: BaseItemSchema.Type;
	}
}

/** Tests whether a canonical item has the tag selected by a tag selector. */
export const selectorTagFx = Effect.fn("selectorTagFx")(function* ({
	selector,
	item,
}: selectorTagFx.Props) {
	const result = item.tags.includes(selector.tag);

	return result;
});
