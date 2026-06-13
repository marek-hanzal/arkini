import { Effect } from "effect";
import type { Quantity } from "~/manifest/data/producer";

export namespace resolveQuantityFx {
	export interface Props {
		quantity: Quantity;
	}
}

export const resolveQuantityFx = Effect.fn("resolveQuantityFx")(function* ({
	quantity,
}: resolveQuantityFx.Props) {
	return typeof quantity === "number"
		? quantity
		: quantity.min + Math.floor(Math.random() * (quantity.max - quantity.min + 1));
});
