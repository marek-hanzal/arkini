import { Array, Effect, Option, pipe, Random } from "effect";

import type { RollWeightSchema } from "~/v1/roll/schema/RollWeightSchema";

export namespace selectDropWeightFx {
	export interface Props {
		drop: RollWeightSchema.Type["drop"];
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
	const selectedWeight = yield* Random.nextRange(0, totalWeight);

	return pipe(
		weightedDrop,
		Array.findFirst(({ maximumWeight }) => {
			return selectedWeight < maximumWeight;
		}),
		Option.map(({ candidate }) => candidate),
		Option.getOrElse(() => drop[drop.length - 1]),
	);
});
