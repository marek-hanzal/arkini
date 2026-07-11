import { Effect } from "effect";

import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import type { WhenRangeSchema } from "~/v1/when/schema/WhenRangeSchema";

export namespace whenRangeFx {
	export interface Props {
		quantity: NonNegativeIntegerSchema.Type;
		when: WhenRangeSchema.Type;
	}
}

/**
 * Tests whether a query result is inside one inclusive quantity range.
 */
export const whenRangeFx = Effect.fn("whenRangeFx")(function* ({
	quantity,
	when,
}: whenRangeFx.Props) {
	return quantity >= when.min && quantity <= when.max;
});
