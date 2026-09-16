import { Array, Effect, Option, pipe, Random } from "effect";
import { match } from "ts-pattern";

import { rollQuantityFx } from "~/production-output/fx/rollQuantityFx";
import type { ChanceRollSchema } from "~/production-output/schema/ChanceRollSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { resolveDropRulesEnabledFx } from "~/production-output/fx/resolveDropRulesEnabledFx";
import type { RollSchema } from "~/production-output/schema/RollSchema";
import type { RollResultSchema } from "~/production-output/schema/RollResultSchema";
import { RollTypeSchema } from "~/production-output/schema/RollTypeSchema";
import type { WeightedDropSchema } from "~/production-output/schema/WeightedDropSchema";
import type { WeightedRollSchema } from "~/production-output/schema/WeightedRollSchema";

const resolveChanceRollFx = Effect.fn("resolveChanceRollFx")(function* ({
	roll,
}: {
	readonly roll: ChanceRollSchema.Type;
}) {
	const passed = (yield* Random.next) < roll.chance;
	return {
		drop: passed ? roll.drop : [],
	} satisfies RollResultSchema.Type;
});

const selectWeightedDropFx = Effect.fn("selectWeightedDropFx")(function* ({
	drop,
}: {
	readonly drop: readonly [
		WeightedDropSchema.Type,
		...WeightedDropSchema.Type[],
	];
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
	origin,
	roll,
}: {
	readonly origin: GridLocationSchema.Type;
	readonly roll: WeightedRollSchema.Type;
}) {
	const available: WeightedDropSchema.Type[] = [];
	for (const candidate of roll.drop) {
		if (
			yield* resolveDropRulesEnabledFx({
				origin,
				rules: candidate.rules,
			})
		) {
			available.push(candidate);
		}
	}
	if (available.length === 0) {
		return {
			drop: [],
		} satisfies RollResultSchema.Type;
	}
	const candidates = available as [
		WeightedDropSchema.Type,
		...WeightedDropSchema.Type[],
	];
	const quantity = yield* rollQuantityFx({
		quantity: roll.quantity,
	});
	const drop: RollResultSchema.Type["drop"] = [];
	for (let index = 0; index < quantity; index += 1) {
		const selected = yield* selectWeightedDropFx({
			drop: candidates,
		});
		drop.push(...selected.drop);
	}
	return {
		drop,
	} satisfies RollResultSchema.Type;
});

interface Props {
	readonly origin: GridLocationSchema.Type;
	readonly roll: RollSchema.Type;
}

/**
 * Dispatches one roll to the specialized resolver selected by its type.
 */
export const rollFx = Effect.fn("rollFx")(function* ({ origin, roll }: Props) {
	return yield* match(roll)
		.with(
			{
				type: RollTypeSchema.enum.Guaranteed,
			},
			(roll) =>
				Effect.succeed({
					drop: roll.drop,
				} satisfies RollResultSchema.Type),
		)
		.with(
			{
				type: RollTypeSchema.enum.Chance,
			},
			(roll) => {
				return resolveChanceRollFx({
					roll,
				});
			},
		)
		.with(
			{
				type: RollTypeSchema.enum.Weight,
			},
			(roll) => {
				return resolveWeightedRollFx({
					origin,
					roll,
				});
			},
		)
		.exhaustive();
});
