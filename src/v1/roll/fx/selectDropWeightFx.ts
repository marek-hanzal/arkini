import { Effect, Random } from "effect";

import type { DropWeightSchema } from "~/v1/roll/schema/DropWeightSchema";

export namespace selectDropWeightFx {
	export interface Props {
		drop: readonly [
			DropWeightSchema.Type,
			DropWeightSchema.Type,
			...DropWeightSchema.Type[],
		];
	}
}

/**
 * Selects exactly one drop candidate according to its relative weight.
 */
export const selectDropWeightFx = Effect.fn("selectDropWeightFx")(function* ({
	drop,
}: selectDropWeightFx.Props) {
	const totalWeight = drop.reduce((total, candidate) => {
		return total + candidate.weight;
	}, 0);
	const selectedWeight = yield* Random.nextRange(0, totalWeight);
	let accumulatedWeight = 0;

	for (const candidate of drop) {
		accumulatedWeight += candidate.weight;
		if (selectedWeight < accumulatedWeight) {
			return candidate;
		}
	}

	return drop[drop.length - 1];
});
