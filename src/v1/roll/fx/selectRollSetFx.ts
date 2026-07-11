import { Effect, Random } from "effect";

import type { RollSetSchema } from "~/v1/roll/schema/RollSetSchema";

export namespace selectRollSetFx {
	export interface Props {
		set: readonly [
			RollSetSchema.Type,
			...RollSetSchema.Type[],
		];
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

	const totalWeight = set.reduce((total, candidate) => {
		return total + (candidate.weight ?? 1);
	}, 0);
	const selectedWeight = yield* Random.nextRange(0, totalWeight);
	let accumulatedWeight = 0;

	for (const candidate of set) {
		accumulatedWeight += candidate.weight ?? 1;
		if (selectedWeight < accumulatedWeight) {
			return candidate;
		}
	}

	return set[set.length - 1];
});
