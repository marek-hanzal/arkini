import { Array, Effect, Option, pipe, Random } from "effect";

import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { RollSetSchema } from "~/outcome/schema/RollSetSchema";
import { resolveOutcomeRulesEnabledFx } from "./resolveOutcomeRulesEnabledFx";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";

export namespace selectRollSetFx {
	export interface Props {
		readonly set: OutcomeTableSchema.Type["set"];
		readonly origin: BoardLocationSchema.Type;
	}
}

/**
 * Filters unavailable sets before selecting one by its relative weight.
 *
 * Every canonical set has one explicit positive relative weight.
 */
export const selectRollSetFx = Effect.fn("selectRollSetFx")(function* ({
	set,
	origin,
}: selectRollSetFx.Props) {
	const available: RollSetSchema.Type[] = [];
	for (const candidate of set) {
		if (
			yield* resolveOutcomeRulesEnabledFx({
				origin,
				rules: candidate.rules,
			})
		)
			available.push(candidate);
	}
	if (available.length === 0) return undefined;
	if (available.length === 1) {
		return available[0];
	}

	const [totalWeight, weightedSet] = Array.mapAccum(
		available,
		0,
		(accumulatedWeight, candidate) => {
			const maximumWeight = accumulatedWeight + candidate.weight;

			return [
				maximumWeight,
				{
					candidate,
					maximumWeight,
				},
			] as const;
		},
	);
	const selectedWeight = yield* Random.nextBetween(0, totalWeight);

	return pipe(
		weightedSet,
		Array.findFirst(({ maximumWeight }) => {
			return selectedWeight < maximumWeight;
		}),
		Option.map(({ candidate }) => candidate),
		Option.getOrElse(() => available[available.length - 1]),
	);
});
