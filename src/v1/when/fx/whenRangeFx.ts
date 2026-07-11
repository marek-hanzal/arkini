import { Effect } from "effect";

import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import type { WhenRangeSchema } from "~/v1/when/schema/WhenRangeSchema";

export namespace whenRangeFx {
	export type Props = Pick<WhenRangeSchema.Type, "max" | "min"> & {
		quantity: NonNegativeIntegerSchema.Type;
	};
}

/**
 * Tests whether a query result is inside one inclusive quantity range.
 */
export const whenRangeFx = Effect.fn("whenRangeFx")(function* ({
	max,
	min,
	quantity,
}: whenRangeFx.Props) {
	return quantity >= min && quantity <= max;
});
