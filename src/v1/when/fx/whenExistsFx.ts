import { Effect } from "effect";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";

export namespace whenExistsFx {
	export interface Props {
		quantity: NonNegativeIntegerSchema.Type;
	}
}

/**
 * Tests whether a query result contains any positive item quantity.
 */
export const whenExistsFx = Effect.fn("whenExistsFx")(function* ({ quantity }: whenExistsFx.Props) {
	return quantity > 0;
});
