import { Array, Effect, Option, pipe, Random } from "effect";

import type { WeightSchema } from "~/engine/roll/schema/WeightSchema";

export namespace selectDropWeightFx {
	export interface Props {
		drop: WeightSchema.Type["drop"];
	}
}

/**
 * Selects exactly one drop candidate according to its relative weight.
 */
export const selectDropWeightFx = Effect.fn("selectDropWeightFx")(function* ({
	drop,
}: selectDropWeightFx.Props) {
	const [totalWeight, weightedDrop] = Array.mapAccum(drop, 0, (accumulatedWeight, candidate) => {
		const maximumWeight = accumulatedWeight + candidate.weight;

		return [
			maximumWeight,
			{
				candidate,
				maximumWeight,
			},
		] as const;
	});
	const selectedWeight = yield* Random.nextBetween(0, totalWeight);

	return pipe(
		weightedDrop,
		Array.findFirst(({ maximumWeight }) => {
			return selectedWeight < maximumWeight;
		}),
		Option.map(({ candidate }) => candidate),
		Option.getOrElse(() => drop[drop.length - 1]),
	);
});
