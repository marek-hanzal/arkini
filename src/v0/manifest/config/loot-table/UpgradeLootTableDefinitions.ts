import type { LootTableDefinition } from "../../lootTable";
import { chance } from "../../dsl/chance";
import { guaranteed } from "../../dsl/guaranteed";
import { lootTable } from "../../dsl/lootTable";
import { outputs } from "../../dsl/outputs";

export const UpgradeLootTableDefinitions = [
	lootTable({
		id: "loot:lumber-camp-1:better-1",
		name: "Lumber Camp I Better Finds I",
		output: outputs({
			entries: [
				guaranteed({
					itemId: "item:twig",
					quantity: 2,
				}),
				chance({
					itemId: "item:branch",
					probability: 0.55,
				}),
				chance({
					itemId: "item:coin",
					probability: 0.1,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:lumber-camp-1:better-2",
		name: "Lumber Camp I Better Finds II",
		output: outputs({
			entries: [
				guaranteed({
					itemId: "item:branch",
				}),
				chance({
					itemId: "item:twig",
					probability: 0.85,
					quantity: {
						min: 1,
						max: 2,
					},
				}),
				chance({
					itemId: "item:log",
					probability: 0.24,
				}),
				chance({
					itemId: "item:coin-pair",
					probability: 0.08,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:quarry-1:better-1",
		name: "Quarry I Better Finds I",
		output: outputs({
			entries: [
				guaranteed({
					itemId: "item:pebble",
					quantity: 2,
				}),
				chance({
					itemId: "item:stone",
					probability: 0.5,
				}),
				chance({
					itemId: "item:coin",
					probability: 0.1,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:quarry-1:better-2",
		name: "Quarry I Better Finds II",
		output: outputs({
			entries: [
				guaranteed({
					itemId: "item:stone",
				}),
				chance({
					itemId: "item:pebble",
					probability: 0.85,
					quantity: {
						min: 1,
						max: 2,
					},
				}),
				chance({
					itemId: "item:ore",
					probability: 0.18,
				}),
				chance({
					itemId: "item:coin-pair",
					probability: 0.08,
				}),
			],
		}),
	}),
] satisfies LootTableDefinition[];
