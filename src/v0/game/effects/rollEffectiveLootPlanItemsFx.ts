import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { EffectiveProducerProductLine } from "~/v0/game/effects/EffectiveProducerProductLine";
import { rollGameQuantityFx } from "~/v0/game/loot/rollGameQuantityFx";
import { rollLootTableItemsFx } from "~/v0/game/loot/rollLootTableItemsFx";
import type { LootTableRollResult } from "~/v0/game/loot/LootTableRollResult";
import { RandomServiceFx } from "~/v0/random/context/RandomServiceFx";

export namespace rollEffectiveLootPlanItemsFx {
	export interface Props {
		config: GameConfig;
		lootPlan: EffectiveProducerProductLine["lootPlan"];
	}
}

const rollLootOutputFx = Effect.fn("rollLootOutputFx")(function* ({
	output,
}: {
	output: NonNullable<GameConfig["products"][string]["output"]>;
}) {
	return yield* rollLootTableItemsFx({
		lootTable: {
			name: "Inline output",
			output,
		},
	});
});

export const rollEffectiveLootPlanItemsFx = Effect.fn("rollEffectiveLootPlanItemsFx")(function* ({
	lootPlan,
}: rollEffectiveLootPlanItemsFx.Props) {
	const random = yield* RandomServiceFx;
	const items: LootTableRollResult["items"] = [];

	if (lootPlan.baseOutput.length > 0 && random.chance(lootPlan.baseDropChance)) {
		const rolled = yield* rollLootOutputFx({
			output: lootPlan.baseOutput,
		});
		items.push(...rolled.items);
	}

	for (const appendOutput of lootPlan.appendOutputs) {
		if (!random.chance(appendOutput.chance)) continue;

		const rolled = yield* rollLootOutputFx({
			output: appendOutput.output,
		});
		items.push(...rolled.items);
	}

	for (const chanceItem of lootPlan.chanceItems) {
		if (!random.chance(chanceItem.chance)) continue;

		const quantity = yield* rollGameQuantityFx({
			quantity: chanceItem.quantity,
		});
		items.push({
			itemId: chanceItem.itemId,
			quantity: quantity.quantity,
		});
	}

	return {
		items,
	} satisfies LootTableRollResult;
});
