import { Array, Effect, Option, pipe, Random } from "effect";
import { match } from "ts-pattern";

import { rollQuantityFx } from "~/engine/quantity/fx/rollQuantityFx";
import type { ChanceSchema } from "~/production-output/roll/schema/ChanceSchema";
import type { RollSchema } from "~/production-output/roll/schema/RollSchema";
import type { RollResultSchema } from "~/production-output/roll/schema/RollResultSchema";
import { TypeSchema } from "~/production-output/roll/schema/TypeSchema";
import type { WeightSchema } from "~/production-output/roll/schema/WeightSchema";

const resolveChanceRollFx = Effect.fn("resolveChanceRollFx")(function* ({
	roll,
}: {
	readonly roll: ChanceSchema.Type;
}) {
	const passed = (yield* Random.next) < roll.chance;
	return {
		drop: passed ? roll.drop : [],
	} satisfies RollResultSchema.Type;
});

const selectWeightedDropFx = Effect.fn("selectWeightedDropFx")(function* ({
	drop,
}: {
	readonly drop: WeightSchema.Type["drop"];
}) {
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
		Array.findFirst(({ maximumWeight }) => selectedWeight < maximumWeight),
		Option.map(({ candidate }) => candidate),
		Option.getOrElse(() => drop[drop.length - 1]),
	);
});

const resolveWeightedRollFx = Effect.fn("resolveWeightedRollFx")(function* ({
	roll,
}: {
	readonly roll: WeightSchema.Type;
}) {
	const quantity = yield* rollQuantityFx({
		quantity: roll.quantity,
	});
	const drop: RollResultSchema.Type["drop"] = [];
	for (let index = 0; index < quantity; index += 1) {
		const selected = yield* selectWeightedDropFx({
			drop: roll.drop,
		});
		drop.push(...selected.drop);
	}
	return {
		drop,
	} satisfies RollResultSchema.Type;
});

export namespace rollFx {
	export interface Props {
		roll: RollSchema.Type;
	}
}

/**
 * Dispatches one roll to the specialized resolver selected by its type.
 */
export const rollFx = Effect.fn("rollFx")(function* ({ roll }: rollFx.Props) {
	return yield* match(roll)
		.with(
			{
				type: TypeSchema.enum.Guaranteed,
			},
			(roll) =>
				Effect.succeed({
					drop: roll.drop,
				} satisfies RollResultSchema.Type),
		)
		.with(
			{
				type: TypeSchema.enum.Chance,
			},
			(roll) => {
				return resolveChanceRollFx({
					roll,
				});
			},
		)
		.with(
			{
				type: TypeSchema.enum.Weight,
			},
			(roll) => {
				return resolveWeightedRollFx({
					roll,
				});
			},
		)
		.exhaustive();
});
