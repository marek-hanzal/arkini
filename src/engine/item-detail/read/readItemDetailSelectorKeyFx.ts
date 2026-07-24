import { Effect } from "effect";
import { match } from "ts-pattern";

import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";
import { SelectorEnumSchema } from "~/engine/selector/schema/SelectorEnumSchema";

/** Reads the stable aggregation identity of one Item Detail selector. */
export const readItemDetailSelectorKeyFx = Effect.fn("readItemDetailSelectorKeyFx")(function* (
	selector: SelectorSchema.Type,
) {
	return match(selector)
		.with(
			{
				type: SelectorEnumSchema.enum.Item,
			},
			({ itemId }) => `item:${itemId}`,
		)
		.with(
			{
				type: SelectorEnumSchema.enum.Tag,
			},
			({ tag }) => `tag:${tag}`,
		)
		.exhaustive();
});
