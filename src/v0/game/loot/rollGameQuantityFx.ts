import { Effect } from "effect";
import { RandomServiceFx } from "~/v0/random/context/RandomServiceFx";
import type { GameQuantity } from "~/v0/game/engine/model/GameQuantity";
import type { GameQuantityRollResult } from "~/v0/game/engine/model/GameQuantityRollResult";

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
