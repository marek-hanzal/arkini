import { Effect } from "effect";

import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import type { WhenExistsSchema } from "~/v1/when/schema/WhenExistsSchema";

export namespace whenExistsFx {
	export interface Props extends WhenExistsSchema.Type {
		quantity: NonNegativeIntegerSchema.Type;
	}
}

/**
 * Tests whether a query result contains any positive item quantity.
 */
export const whenExistsFx = Effect.fn("whenExistsFx")(function* ({ quantity }: whenExistsFx.Props) {
	return quantity > 0;
});
