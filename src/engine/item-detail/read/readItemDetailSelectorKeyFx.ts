import { Effect } from "effect";

import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

/** Reads the stable aggregation identity of one Item Detail selector. */
export const readItemDetailSelectorKeyFx = Effect.fn("readItemDetailSelectorKeyFx")(function* (
	selector: SelectorSchema.Type,
) {
	return `item:${selector.itemId}`;
});
