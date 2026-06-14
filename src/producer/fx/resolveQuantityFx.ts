import { Effect } from "effect";
import type { Quantity } from "~/manifest/producer";
import { RandomServiceFx } from "~/random/context/RandomServiceFx";

export namespace resolveQuantityFx {
	export interface Props {
		quantity: Quantity;
	}
}

export const resolveQuantityFx = Effect.fn("resolveQuantityFx")(function* ({
	quantity,
}: resolveQuantityFx.Props) {
	if (typeof quantity === "number") return quantity;
	const random = yield* RandomServiceFx;
	return random.integerInclusive(quantity.min, quantity.max);
});
