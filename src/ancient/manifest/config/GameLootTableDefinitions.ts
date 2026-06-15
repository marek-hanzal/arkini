import type { LootTableDefinition } from "../lootTable";
import { chance } from "../utils/chance";
import { drop } from "../utils/drop";
import { guaranteed } from "../utils/guaranteed";
import { lootTable } from "../utils/lootTable";
import { outputs } from "../utils/outputs";
import { weighted } from "../utils/weighted";

export const GameLootTableDefinitions = [
	lootTable({
		id: "loot:tree",
		name: "Tree",
		output: outputs({
			entries: [
				guaranteed({
					itemId: "item:twig",
					quantity: 2,
				}),
				chance({
					itemId: "item:branch",
					probability: 0.35,
				}),
				chance({
					itemId: "item:coin",
					probability: 0.08,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:townhall-1",
		name: "Town Hall I",
		output: outputs({
			entries: [
				weighted({
					entries: [
						drop({
							itemId: "item:blueprint-scrap",
							weight: 90,
						}),
						drop({
							itemId: "item:crate-1",
							weight: 10,
						}),
					],
				}),
				chance({
					itemId: "item:water",
					probability: 0.32,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:townhall-2",
		name: "Town Hall II",
		output: outputs({
			entries: [
				weighted({
					entries: [
						drop({
							itemId: "item:blueprint-scrap",
							weight: 60,
						}),
						drop({
							itemId: "item:crate-1",
							weight: 28,
						}),
						drop({
							itemId: "item:crate-2",
							weight: 12,
						}),
						drop({
							itemId: "item:blueprint-lumber-camp-2",
							weight: 6,
						}),
						drop({
							itemId: "item:blueprint-quarry-2",
							weight: 6,
						}),
					],
				}),
				chance({
					itemId: "item:water",
					probability: 0.4,
					quantity: {
						min: 1,
						max: 2,
					},
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:townhall-3",
		name: "Town Hall III",
		output: outputs({
			entries: [
				weighted({
					entries: [
						drop({
							itemId: "item:blueprint-scrap",
							weight: 40,
						}),
						drop({
							itemId: "item:crate-1",
							weight: 18,
						}),
						drop({
							itemId: "item:crate-2",
							weight: 30,
						}),
						drop({
							itemId: "item:crate-3",
							weight: 12,
						}),
						drop({
							itemId: "item:blueprint-lumber-camp-3",
							weight: 5,
						}),
						drop({
							itemId: "item:blueprint-quarry-3",
							weight: 5,
						}),
					],
				}),
				chance({
					itemId: "item:water",
					probability: 0.55,
					quantity: {
						min: 1,
						max: 2,
					},
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:townhall-4",
		name: "Town Hall IV",
		output: outputs({
			entries: [
				weighted({
					entries: [
						drop({
							itemId: "item:blueprint-scrap",
							weight: 36,
						}),
						drop({
							itemId: "item:crate-2",
							weight: 34,
						}),
						drop({
							itemId: "item:crate-3",
							weight: 22,
						}),
						drop({
							itemId: "item:crate-4",
							weight: 8,
						}),
						drop({
							itemId: "item:blueprint-lumber-camp-4",
							weight: 4,
						}),
						drop({
							itemId: "item:blueprint-quarry-4",
							weight: 4,
						}),
					],
				}),
				chance({
					itemId: "item:water",
					probability: 0.62,
					quantity: {
						min: 1,
						max: 2,
					},
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:townhall-5",
		name: "Town Hall V",
		output: outputs({
			entries: [
				weighted({
					entries: [
						drop({
							itemId: "item:blueprint-scrap",
							weight: 30,
						}),
						drop({
							itemId: "item:crate-2",
							weight: 28,
						}),
						drop({
							itemId: "item:crate-3",
							weight: 30,
						}),
						drop({
							itemId: "item:crate-4",
							weight: 12,
						}),
						drop({
							itemId: "item:blueprint-lumber-camp-5",
							weight: 3,
						}),
						drop({
							itemId: "item:blueprint-quarry-5",
							weight: 3,
						}),
					],
				}),
				chance({
					itemId: "item:water",
					probability: 0.72,
					quantity: {
						min: 1,
						max: 3,
					},
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:lumber-camp-1",
		name: "Lumber Camp I",
		output: outputs({
			entries: [
				guaranteed({
					itemId: "item:twig",
					quantity: 2,
				}),
				chance({
					itemId: "item:branch",
					probability: 0.35,
				}),
				chance({
					itemId: "item:coin",
					probability: 0.08,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:lumber-camp-2",
		name: "Lumber Camp II",
		output: outputs({
			entries: [
				guaranteed({
					itemId: "item:branch",
				}),
				chance({
					itemId: "item:twig",
					probability: 0.5,
					quantity: {
						min: 1,
						max: 2,
					},
				}),
				chance({
					itemId: "item:log",
					probability: 0.35,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:lumber-camp-3",
		name: "Lumber Camp III",
		output: outputs({
			entries: [
				guaranteed({
					itemId: "item:branch",
					quantity: 2,
				}),
				chance({
					itemId: "item:log",
					probability: 0.7,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:lumber-camp-4",
		name: "Lumber Camp IV",
		output: outputs({
			entries: [
				guaranteed({
					itemId: "item:log",
					quantity: 1,
				}),
				chance({
					itemId: "item:branch",
					probability: 0.75,
					quantity: {
						min: 1,
						max: 2,
					},
				}),
				chance({
					itemId: "item:wood-bundle",
					probability: 0.3,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:lumber-camp-5",
		name: "Lumber Camp V",
		output: outputs({
			entries: [
				guaranteed({
					itemId: "item:log",
					quantity: 2,
				}),
				chance({
					itemId: "item:wood-bundle",
					probability: 0.55,
				}),
				chance({
					itemId: "item:beam",
					probability: 0.18,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:quarry-1",
		name: "Quarry I",
		output: outputs({
			entries: [
				guaranteed({
					itemId: "item:pebble",
					quantity: 2,
				}),
				chance({
					itemId: "item:stone",
					probability: 0.32,
				}),
				chance({
					itemId: "item:coin",
					probability: 0.08,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:quarry-2",
		name: "Quarry II",
		output: outputs({
			entries: [
				guaranteed({
					itemId: "item:stone",
				}),
				chance({
					itemId: "item:pebble",
					probability: 0.5,
					quantity: {
						min: 1,
						max: 2,
					},
				}),
				chance({
					itemId: "item:crystal",
					probability: 0.28,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:quarry-3",
		name: "Quarry III",
		output: outputs({
			entries: [
				guaranteed({
					itemId: "item:stone",
					quantity: 2,
				}),
				chance({
					itemId: "item:crystal",
					probability: 0.72,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:quarry-4",
		name: "Quarry IV",
		output: outputs({
			entries: [
				guaranteed({
					itemId: "item:stone",
					quantity: 2,
				}),
				chance({
					itemId: "item:ore",
					probability: 0.48,
				}),
				chance({
					itemId: "item:crystal",
					probability: 0.28,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:quarry-5",
		name: "Quarry V",
		output: outputs({
			entries: [
				guaranteed({
					itemId: "item:stone",
					quantity: 2,
				}),
				chance({
					itemId: "item:ore",
					probability: 0.7,
				}),
				chance({
					itemId: "item:crystal",
					probability: 0.42,
				}),
				chance({
					itemId: "item:gem",
					probability: 0.12,
				}),
			],
		}),
	}),
	lootTable({
		id: "loot:coal-mine-1",
		name: "Coal Mine I",
		output: outputs({
			entries: [
				guaranteed({
					itemId: "item:coal",
				}),
				chance({
					itemId: "item:coin",
					probability: 0.12,
				}),
			],
		}),
	}),
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
] satisfies readonly LootTableDefinition[];
