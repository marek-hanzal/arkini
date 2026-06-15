import type { UpgradeDefinition } from "../upgrade";
import { cost } from "../dsl/cost";
import { setLootTable } from "../dsl/setLootTable";
import { speedTiers } from "../dsl/speedTiers";
import { tier } from "../dsl/tier";
import { upgrade } from "../dsl/upgrade";

export const GameUpgradeDefinitions = [
	upgrade({
		id: "upgrade:lumber-camp-1-speed",
		code: "lumber-camp-1-speed",
		name: "Lumber Camp I Speed",
		description: "Shaves a little time off first-tier lumber production.",
		sort: 10,
		tiers: speedTiers({
			itemId: "item:lumber-camp-1",
			costs: [
				cost({
					itemId: "item:coin-stack",
					quantity: 1,
				}),
				cost({
					itemId: "item:coin-stack",
					quantity: 2,
				}),
				cost({
					itemId: "item:coin-chest",
					quantity: 1,
				}),
				cost({
					itemId: "item:coin-chest",
					quantity: 2,
				}),
				cost({
					itemId: "item:coin-chest",
					quantity: 3,
				}),
			],
		}),
	}),
	upgrade({
		id: "upgrade:quarry-1-speed",
		code: "quarry-1-speed",
		name: "Quarry I Speed",
		description: "Makes the first quarry slightly less geological about deadlines.",
		sort: 20,
		tiers: speedTiers({
			itemId: "item:quarry-1",
			costs: [
				cost({
					itemId: "item:coin-stack",
					quantity: 1,
				}),
				cost({
					itemId: "item:coin-stack",
					quantity: 2,
				}),
				cost({
					itemId: "item:coin-chest",
					quantity: 1,
				}),
				cost({
					itemId: "item:coin-chest",
					quantity: 2,
				}),
				cost({
					itemId: "item:coin-chest",
					quantity: 3,
				}),
			],
		}),
	}),
	upgrade({
		id: "upgrade:lumber-camp-1-loot",
		code: "lumber-camp-1-loot",
		name: "Lumber Camp I Better Finds",
		description:
			"Upgrades the first lumber camp loot table instead of poking random percentages with a stick.",
		sort: 30,
		tiers: [
			tier({
				cost: [
					cost({
						itemId: "item:coin-stack",
						quantity: 2,
					}),
				],
				effects: [
					setLootTable({
						itemId: "item:lumber-camp-1",
						tableId: "loot:lumber-camp-1:better-1",
					}),
				],
			}),
			tier({
				cost: [
					cost({
						itemId: "item:coin-chest",
						quantity: 2,
					}),
				],
				effects: [
					setLootTable({
						itemId: "item:lumber-camp-1",
						tableId: "loot:lumber-camp-1:better-2",
					}),
				],
			}),
		],
	}),
	upgrade({
		id: "upgrade:quarry-1-loot",
		code: "quarry-1-loot",
		name: "Quarry I Better Finds",
		description:
			"Lets the first quarry find better rocks, because apparently holes need career growth.",
		sort: 40,
		tiers: [
			tier({
				cost: [
					cost({
						itemId: "item:coin-stack",
						quantity: 2,
					}),
				],
				effects: [
					setLootTable({
						itemId: "item:quarry-1",
						tableId: "loot:quarry-1:better-1",
					}),
				],
			}),
			tier({
				cost: [
					cost({
						itemId: "item:coin-chest",
						quantity: 2,
					}),
				],
				effects: [
					setLootTable({
						itemId: "item:quarry-1",
						tableId: "loot:quarry-1:better-2",
					}),
				],
			}),
		],
	}),
] satisfies readonly UpgradeDefinition[];
