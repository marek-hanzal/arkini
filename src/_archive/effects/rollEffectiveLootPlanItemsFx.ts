import { Effect } from "effect";
import type { EffectiveLine, EffectiveLineOutputSet } from "~/effects/EffectiveLine";
import { readEffectiveLootPlanOutputSets } from "~/effects/readEffectiveOutputEntries";
import { rollGameQuantityFx } from "~/loot/rollGameQuantityFx";
import { rollLootTableItemsFx } from "~/loot/rollLootTableItemsFx";
import type { LootTableRollResult } from "~/loot/LootTableRollResult";
import { RandomServiceFx } from "~/random/context/RandomServiceFx";

export namespace rollEffectiveLootPlanItemsFx {
	export interface Props {
		config?: unknown;
		lootPlan: EffectiveLine["lootPlan"];
	}
}

type LootOutputEntries = EffectiveLineOutputSet["baseOutput"];

const rollLootOutputFx = Effect.fn("rollLootOutputFx")(function* ({
	output,
}: {
	output: LootOutputEntries;
}) {
	return yield* rollLootTableItemsFx({
		lootTable: {
			name: "Inline output",
			output,
		},
	});
});

const readChanceRollCountFx = Effect.fn("readChanceRollCountFx")(function* ({
	chance,
}: {
	chance: number;
}) {
	if (chance <= 0) return 0;

	const random = yield* RandomServiceFx;
	const guaranteedRolls = Math.floor(chance);
	const remainder = chance - guaranteedRolls;

	return guaranteedRolls + (random.chance(remainder) ? 1 : 0);
});

const chooseOutputSetFx = Effect.fn("chooseOutputSetFx")(function* ({
	outputSets,
}: {
	outputSets: readonly EffectiveLineOutputSet[];
}) {
	if (outputSets.length === 0) return undefined;

	const random = yield* RandomServiceFx;
	let remainingWeight = outputSets.reduce((total, outputSet) => total + outputSet.weight, 0);

	for (const outputSet of outputSets) {
		const chance = outputSet.weight / remainingWeight;
		if (random.chance(chance)) return outputSet;
		remainingWeight -= outputSet.weight;
	}

	return outputSets[outputSets.length - 1];
});

export const rollEffectiveLootPlanItemsFx = Effect.fn("rollEffectiveLootPlanItemsFx")(function* ({
	lootPlan,
}: rollEffectiveLootPlanItemsFx.Props) {
	const items: LootTableRollResult["items"] = [];
	const outputSet = yield* chooseOutputSetFx({
		outputSets: readEffectiveLootPlanOutputSets(lootPlan),
	});
	if (!outputSet)
		return {
			items,
		} satisfies LootTableRollResult;

	if (outputSet.baseOutput.length > 0) {
		const rolled = yield* rollLootOutputFx({
			output: outputSet.baseOutput,
		});
		items.push(...rolled.items);
	}

	for (const chanceItem of outputSet.chanceItems) {
		const rollCount = yield* readChanceRollCountFx({
			chance: chanceItem.chance,
		});

		for (let rollIndex = 0; rollIndex < rollCount; rollIndex += 1) {
			const quantity = yield* rollGameQuantityFx({
				quantity: chanceItem.quantity,
			});
			items.push({
				itemId: chanceItem.itemId,
				quantity: quantity.quantity,
			});
		}
	}

	return {
		items,
	} satisfies LootTableRollResult;
});
