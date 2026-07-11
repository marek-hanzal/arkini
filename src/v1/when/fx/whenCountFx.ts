import { Effect } from "effect";

import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import type { WhenCountSchema } from "~/v1/when/schema/WhenCountSchema";

export namespace whenCountFx {
	export interface Props {
		quantity: NonNegativeIntegerSchema.Type;
		when: WhenCountSchema.Type;
	}
}

/**
 * Tests whether a query result has one exact total quantity.
 */
export const whenCountFx = Effect.fn("whenCountFx")(function* ({
	quantity,
	when,
}: whenCountFx.Props) {
	return quantity === when.count;
});
