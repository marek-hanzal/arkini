import { Effect } from "effect";
import type { Quantity } from "~/v0/manifest/activation/Quantity";
import { RandomServiceFx } from "~/v0/random/context/RandomServiceFx";

export namespace resolveActivationQuantityFx {
	export interface Props {
		quantity: Quantity;
	}
}

export const resolveActivationQuantityFx = Effect.fn("resolveActivationQuantityFx")(function* ({
	quantity,
}: resolveActivationQuantityFx.Props) {
	if (typeof quantity === "number") return quantity;
	const random = yield* RandomServiceFx;
	return random.integerInclusive(quantity.min, quantity.max);
});
