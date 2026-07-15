import { match } from "ts-pattern";

import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { SelectorSchema } from "~/v1/selector/schema/SelectorSchema";

export namespace matchesSelector {
	export interface Props {
		selector: SelectorSchema.Type;
		item: ItemSchema.Type;
	}
}

/** Tests one canonical item against one selector without introducing an Effect boundary. */
export const matchesSelector = ({ selector, item }: matchesSelector.Props) => {
	return match(selector)
		.with(
			{
				type: "item",
			},
			({ itemId }) => itemId === item.id,
		)
		.with(
			{
				type: "tag",
			},
			({ tag }) => item.tags.includes(tag),
		)
		.exhaustive();
};
