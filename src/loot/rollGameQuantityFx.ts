import { Effect } from "effect";
import { RandomServiceFx } from "~/random/context/RandomServiceFx";
import type { GameQuantity } from "~/loot/GameQuantity";
import type { GameQuantityRollResult } from "~/loot/GameQuantityRollResult";

export namespace rollGameQuantityFx {
	export interface Props {
		quantity: GameQuantity | undefined;
	}
}

export const rollGameQuantityFx = Effect.fn("rollGameQuantityFx")(function* ({
	quantity,
}: rollGameQuantityFx.Props) {
	if (!quantity) {
		return {
			quantity: 1,
		} satisfies GameQuantityRollResult;
	}

	if (typeof quantity === "number") {
		return {
			quantity,
		} satisfies GameQuantityRollResult;
	}

	const random = yield* RandomServiceFx;

	return {
		quantity: random.integerInclusive(quantity.min, quantity.max),
	} satisfies GameQuantityRollResult;
});
