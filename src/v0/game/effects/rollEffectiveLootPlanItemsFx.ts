import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { EffectiveProducerProductLine } from "~/v0/game/effects/EffectiveProducerProductLine";
import { rollGameQuantityFx } from "~/v0/game/loot/rollGameQuantityFx";
import { rollLootTableItemsFx } from "~/v0/game/loot/rollLootTableItemsFx";
import type { LootTableRollResult } from "~/v0/game/loot/LootTableRollResult";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import { RandomServiceFx } from "~/v0/random/context/RandomServiceFx";

export namespace rollEffectiveLootPlanItemsFx {
	export interface Props {
		config: GameConfig;
		lootPlan: EffectiveProducerProductLine["lootPlan"];
	}
}

const rollLootTableByIdFx = Effect.fn("rollLootTableByIdFx")(function* ({
	config,
	lootTableId,
}: {
	config: GameConfig;
	lootTableId: string;
}) {
	const lootTable = config.lootTables[lootTableId];
	if (!lootTable) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing loot table "${lootTableId}".`),
		);
	}

	return yield* rollLootTableItemsFx({
		lootTable,
	});
});

export const rollEffectiveLootPlanItemsFx = Effect.fn("rollEffectiveLootPlanItemsFx")(function* ({
	config,
	lootPlan,
}: rollEffectiveLootPlanItemsFx.Props) {
	const random = yield* RandomServiceFx;
	const items: LootTableRollResult["items"] = [];

	if (lootPlan.lootTableIds.length > 0 && random.chance(lootPlan.baseDropChance)) {
		for (const lootTableId of lootPlan.lootTableIds) {
			const rolled = yield* rollLootTableByIdFx({
				config,
				lootTableId,
			});
			items.push(...rolled.items);
		}
	}

	for (const appendTable of lootPlan.appendTables) {
		if (!random.chance(appendTable.chance)) continue;

		const rolled = yield* rollLootTableByIdFx({
			config,
			lootTableId: appendTable.lootTableId,
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
