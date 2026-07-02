import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import type { EffectiveLine } from "~/effects/EffectiveLine";
import { rollGameQuantityFx } from "~/loot/rollGameQuantityFx";
import { rollLootTableItemsFx } from "~/loot/rollLootTableItemsFx";
import type { LootTableRollResult } from "~/loot/LootTableRollResult";
import { RandomServiceFx } from "~/random/context/RandomServiceFx";

export namespace rollEffectiveLootPlanItemsFx {
	export interface Props {
		config: GameConfig;
		lootPlan: EffectiveLine["lootPlan"];
	}
}

const rollLootOutputFx = Effect.fn("rollLootOutputFx")(function* ({
	output,
}: {
	output: NonNullable<GameLineDefinition["output"]>;
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

export const rollEffectiveLootPlanItemsFx = Effect.fn("rollEffectiveLootPlanItemsFx")(function* ({
	lootPlan,
}: rollEffectiveLootPlanItemsFx.Props) {
	const items: LootTableRollResult["items"] = [];

	if (lootPlan.baseOutput.length > 0) {
		const rolled = yield* rollLootOutputFx({
			output: lootPlan.baseOutput,
		});
		items.push(...rolled.items);
	}

	for (const chanceItem of lootPlan.chanceItems) {
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
