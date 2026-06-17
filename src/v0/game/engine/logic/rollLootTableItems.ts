import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { nextGameRandom } from "~/v0/game/engine/logic/nextGameRandom";
import { rollGameQuantity } from "~/v0/game/engine/logic/rollGameQuantity";

type LootTable = GameConfig["lootTables"][string];

type WeightedEntry = Extract<
	LootTable["output"][number],
	{
		type: "weighted";
	}
>["entries"][number];

export interface LootTableItemRoll {
	itemId: string;
	quantity: number;
}

export interface LootTableRollResult {
	items: LootTableItemRoll[];
	seed: number;
}

export const rollLootTableItems = (lootTable: LootTable, seed: number): LootTableRollResult => {
	let nextSeed = seed;
	const items: LootTableItemRoll[] = [];

	for (const output of lootTable.output) {
		if (output.type === "guaranteed") {
			const quantity = rollGameQuantity(output.quantity, nextSeed);
			nextSeed = quantity.seed;
			items.push({
				itemId: output.itemId,
				quantity: quantity.quantity,
			});
			continue;
		}

		if (output.type === "chance") {
			const random = nextGameRandom(nextSeed);
			nextSeed = random.seed;

			if (random.value > output.chance) {
				continue;
			}

			const quantity = rollGameQuantity(output.quantity, nextSeed);
			nextSeed = quantity.seed;
			items.push({
				itemId: output.itemId,
				quantity: quantity.quantity,
			});
			continue;
		}

		const rolls = rollGameQuantity(output.rolls, nextSeed);
		nextSeed = rolls.seed;

		for (let rollIndex = 0; rollIndex < rolls.quantity; rollIndex += 1) {
			const entry = rollWeightedEntry(output.entries, nextSeed);
			nextSeed = entry.seed;
			const quantity = rollGameQuantity(entry.entry.quantity, nextSeed);
			nextSeed = quantity.seed;
			items.push({
				itemId: entry.entry.itemId,
				quantity: quantity.quantity,
			});
		}
	}

	return {
		items,
		seed: nextSeed,
	};
};

const rollWeightedEntry = (
	entries: readonly WeightedEntry[],
	seed: number,
): {
	entry: WeightedEntry;
	seed: number;
} => {
	const totalWeight = entries.reduce((total, entry) => total + entry.weight, 0);
	const random = nextGameRandom(seed);
	let cursor = random.value * totalWeight;

	for (const entry of entries) {
		cursor -= entry.weight;

		if (cursor <= 0) {
			return {
				entry,
				seed: random.seed,
			};
		}
	}

	return {
		entry: entries[entries.length - 1] as WeightedEntry,
		seed: random.seed,
	};
};
