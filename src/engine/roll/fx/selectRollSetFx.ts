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
 * A set without an explicit weight participates with the default weight one.
 */
export const selectRollSetFx = Effect.fn("selectRollSetFx")(function* ({
	set,
}: selectRollSetFx.Props) {
	if (set.length === 1) {
		return set[0];
	}

	const [totalWeight, weightedSet] = Array.mapAccum(set, 0, (accumulatedWeight, candidate) => {
		const maximumWeight = accumulatedWeight + (candidate.weight ?? 1);

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
		weightedSet,
		Array.findFirst(({ maximumWeight }) => {
			return selectedWeight < maximumWeight;
		}),
		Option.map(({ candidate }) => candidate),
		Option.getOrElse(() => set[set.length - 1]),
	);
});
