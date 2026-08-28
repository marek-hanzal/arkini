import { Array, Effect, Option, pipe, Random } from "effect";

import type { OutputSchema } from "~/engine/output/schema/OutputSchema";

export namespace selectRollSetFx {
	export interface Props {
		set: OutputSchema.Type["set"];
	}
}

/**
 * Selects exactly one roll set according to its relative configured weight.
 *
 * Every canonical set has one explicit positive relative weight.
 */
export const selectRollSetFx = Effect.fn("selectRollSetFx")(function* ({
	set,
}: selectRollSetFx.Props) {
	if (set.length === 1) {
		return set[0];
	}

	const [totalWeight, weightedSet] = Array.mapAccum(set, 0, (accumulatedWeight, candidate) => {
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
		weightedSet,
		Array.findFirst(({ maximumWeight }) => {
			return selectedWeight < maximumWeight;
		}),
		Option.map(({ candidate }) => candidate),
		Option.getOrElse(() => set[set.length - 1]),
	);
});
