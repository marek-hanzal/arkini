import { Effect } from "effect";

import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { WhenCountSchema } from "~/engine/when/schema/WhenCountSchema";

export namespace whenCountFx {
	export type Props = Pick<WhenCountSchema.Type, "count"> & {
		quantity: NonNegativeIntegerSchema.Type;
	};
}

/**
 * Tests whether a query result has one exact total quantity.
 */
export const whenCountFx = Effect.fn("whenCountFx")(function* ({
	count,
	quantity,
}: whenCountFx.Props) {
	return quantity === count;
});
