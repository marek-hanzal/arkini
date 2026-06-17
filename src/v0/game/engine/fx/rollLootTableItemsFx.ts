import { Effect } from "effect";
import { RandomServiceFx } from "~/v0/random/context/RandomServiceFx";
import { rollGameQuantityFx } from "~/v0/game/engine/fx/rollGameQuantityFx";
import { rollWeightedLootTableEntryFx } from "~/v0/game/engine/fx/rollWeightedLootTableEntryFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { LootTableRollResult } from "~/v0/game/engine/model/LootTableRollResult";

type LootTable = GameConfig["lootTables"][string];

export namespace rollLootTableItemsFx {
	export interface Props {
		lootTable: LootTable;
	}
}

export const rollLootTableItemsFx = Effect.fn("rollLootTableItemsFx")(function* ({
	lootTable,
}: rollLootTableItemsFx.Props) {
	const random = yield* RandomServiceFx;
	const items: LootTableRollResult["items"] = [];

	for (const output of lootTable.output) {
		if (output.type === "guaranteed") {
			const quantity = yield* rollGameQuantityFx({
				quantity: output.quantity,
			});
			items.push({
				itemId: output.itemId,
				quantity: quantity.quantity,
			});
			continue;
		}

		if (output.type === "chance") {
			if (!random.chance(output.chance)) {
				continue;
			}

			const quantity = yield* rollGameQuantityFx({
				quantity: output.quantity,
			});
			items.push({
				itemId: output.itemId,
				quantity: quantity.quantity,
			});
			continue;
		}

		const rolls = yield* rollGameQuantityFx({
			quantity: output.rolls,
		});

		for (let rollIndex = 0; rollIndex < rolls.quantity; rollIndex += 1) {
			const entry = yield* rollWeightedLootTableEntryFx({
				entries: output.entries,
			});
			const quantity = yield* rollGameQuantityFx({
				quantity: entry.quantity,
			});
			items.push({
				itemId: entry.itemId,
				quantity: quantity.quantity,
			});
		}
	}

	return {
		items,
	} satisfies LootTableRollResult;
});
