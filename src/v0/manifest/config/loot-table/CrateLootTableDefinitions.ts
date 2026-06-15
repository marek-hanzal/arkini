import type { LootTableDefinition } from "../../lootTable";
import { chance } from "../../dsl/chance";
import { drop } from "../../dsl/drop";
import { lootTable } from "../../dsl/lootTable";
import { outputs } from "../../dsl/outputs";
import { weighted } from "../../dsl/weighted";

export const CrateLootTableDefinitions = [
	lootTable({
		id: "loot:crate-1",
		name: "Common Crate",
		output: outputs({
			entries: [
				weighted({
					entries: [
						drop({
							itemId: "item:twig",
							weight: 35,
						}),
						drop({
							itemId: "item:pebble",
							weight: 35,
						}),
						drop({
							itemId: "item:water",
							weight: 15,
						}),
						drop({
							itemId: "item:seed",
							weight: 12,
						}),
						drop({
							itemId: "item:coin",
							weight: 8,
						}),
					],
				}),
				chance({
					itemId: "item:twig",
					probability: 0.18,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:crate-2",
		name: "Sturdy Crate",
		output: outputs({
			entries: [
				weighted({
					entries: [
						drop({
							itemId: "item:branch",
							weight: 35,
						}),
						drop({
							itemId: "item:stone",
							weight: 35,
						}),
						drop({
							itemId: "item:water",
							weight: 15,
						}),
						drop({
							itemId: "item:crate-1",
							weight: 12,
						}),
						drop({
							itemId: "item:coin-pair",
							weight: 8,
						}),
					],
				}),
				chance({
					itemId: "item:pebble",
					probability: 0.22,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:crate-3",
		name: "Rare Crate",
		output: outputs({
			entries: [
				weighted({
					entries: [
						drop({
							itemId: "item:log",
							weight: 30,
						}),
						drop({
							itemId: "item:crystal",
							weight: 30,
						}),
						drop({
							itemId: "item:crate-2",
							weight: 20,
						}),
						drop({
							itemId: "item:water",
							weight: 16,
						}),
						drop({
							itemId: "item:coin-stack",
							weight: 8,
						}),
					],
				}),
				chance({
					itemId: "item:branch",
					probability: 0.24,
				}),
				chance({
					itemId: "item:epic-key",
					probability: 0.1,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:crate-4",
		name: "Epic Crate",
		output: outputs({
			entries: [
				weighted({
					entries: [
						drop({
							itemId: "item:wood-bundle",
							weight: 25,
						}),
						drop({
							itemId: "item:beam",
							weight: 15,
						}),
						drop({
							itemId: "item:crystal",
							weight: 25,
						}),
						drop({
							itemId: "item:gem",
							weight: 15,
						}),
						drop({
							itemId: "item:water",
							weight: 16,
						}),
						drop({
							itemId: "item:coin-stack",
							weight: 8,
						}),
					],
				}),
				chance({
					itemId: "item:crate-3",
					probability: 0.2,
				}),
			],
		}),
	}),
] satisfies LootTableDefinition[];
