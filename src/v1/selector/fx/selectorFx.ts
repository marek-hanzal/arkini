import { Effect } from "effect";

import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import { matchesSelector } from "~/v1/selector/read/matchesSelector";
import type { SelectorSchema } from "~/v1/selector/schema/SelectorSchema";

export namespace selectorFx {
	export interface Props {
		selector: SelectorSchema.Type;
		item: ItemSchema.Type;
	}
}

/**
 * Exposes canonical selector matching through an Effect boundary for runtime pipelines.
 */
export const selectorFx = Effect.fn("selectorFx")(function* (props: selectorFx.Props) {
	return matchesSelector(props);
});
