import { Effect } from "effect";

import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { RangeSchema } from "~/engine/when/schema/RangeSchema";

export namespace whenRangeFx {
	export type Props = Pick<RangeSchema.Type, "max" | "min"> & {
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
