import { Effect } from "effect";
import type { GameLootOutput } from "~/loot/GameLootOutput";
import { rollLootTableItemsFx } from "~/loot/rollLootTableItemsFx";
import type { LootTableRollResult } from "~/loot/LootTableRollResult";
import { RandomServiceFx } from "~/random/context/RandomServiceFx";

export interface GameLootOutputSet {
	entries: readonly GameLootOutput[];
	weight?: number;
}

export namespace rollLootOutputSetsFx {
	export interface Props {
		name: string;
		outputSets: readonly GameLootOutputSet[];
	}
}

const readOutputSetWeight = (outputSet: GameLootOutputSet) => outputSet.weight ?? 1;

const chooseLootOutputSetFx = Effect.fn("chooseLootOutputSetFx")(function* ({
	outputSets,
}: {
	outputSets: readonly GameLootOutputSet[];
}) {
	if (outputSets.length === 0) return undefined;

	const random = yield* RandomServiceFx;
	let remainingWeight = outputSets.reduce(
		(total, outputSet) => total + readOutputSetWeight(outputSet),
		0,
	);

	for (const outputSet of outputSets) {
		const weight = readOutputSetWeight(outputSet);
		const chance = weight / remainingWeight;
		if (random.chance(chance)) return outputSet;
		remainingWeight -= weight;
	}

	return outputSets[outputSets.length - 1];
});

export const rollLootOutputSetsFx = Effect.fn("rollLootOutputSetsFx")(function* ({
	name,
	outputSets,
}: rollLootOutputSetsFx.Props) {
	const outputSet = yield* chooseLootOutputSetFx({
		outputSets,
	});
	if (!outputSet) {
		return {
			items: [],
		} satisfies LootTableRollResult;
	}

	return yield* rollLootTableItemsFx({
		lootTable: {
			name,
			output: outputSet.entries,
		},
	});
});
