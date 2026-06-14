import type { AssetDefinition } from "./asset";
import type { ItemDefinition } from "./item";
import type { LootTableDefinition } from "./lootTable";
import type { ItemId, ResourceId } from "./manifestId";
import type { ResourceDefinition } from "./resource";
import type { UpgradeDefinition } from "./upgrade";
import { asset } from "./utils/asset";
import { blueprintAsset } from "./utils/blueprintAsset";
import { chance } from "./utils/chance";
import { clickProducer } from "./utils/clickProducer";
import { clickStash } from "./utils/clickStash";
import { combo } from "./utils/combo";
import { cost } from "./utils/cost";
import { craft } from "./utils/craft";
import { drop } from "./utils/drop";
import { guaranteed } from "./utils/guaranteed";
import { imprint } from "./utils/imprint";
import { input } from "./utils/input";
import { item } from "./utils/item";
import { lootTable } from "./utils/lootTable";
import { outputs } from "./utils/outputs";
import { producerInput } from "./utils/producerInput";
import { same } from "./utils/same";
import { setLootTable } from "./utils/setLootTable";
import { speedTiers } from "./utils/speedTiers";
import { tier } from "./utils/tier";
import { upgrade } from "./utils/upgrade";
import { weighted } from "./utils/weighted";

// One config owns the gameplay shape. Items are not passive rows anymore:
// optional item behavior defines merges, producers, and build recipes in the
// same place as the visual identity. Data first, glue code second. Miracles.
export const GameConfig = {
	game: {
		id: "arkini",
		title: "Arkini",
		board: {
			width: 7,
			height: 9,
		},
		inventory: {
			slots: 35,
		},
	},
	assets: [
		asset({
			id: "asset:item-seed",
			label: "Seed",
			fileName: "item-seed",
			sort: 10,
		}),
		asset({
			id: "asset:item-sprout",
			label: "Sprout",
			fileName: "item-sprout",
			sort: 20,
		}),
		asset({
			id: "asset:item-leaf",
			label: "Leaf",
			fileName: "item-leaf",
			sort: 30,
		}),
		asset({
			id: "asset:item-bush",
			label: "Bush",
			fileName: "item-bush",
			sort: 34,
		}),
		asset({
			id: "asset:item-sapling",
			label: "Sapling",
			fileName: "item-sapling",
			sort: 38,
		}),
		asset({
			id: "asset:item-tree",
			label: "Tree",
			fileName: "item-tree",
			sort: 39,
		}),
		asset({
			id: "asset:item-twig",
			label: "Twig",
			fileName: "item-twig",
			sort: 40,
		}),
		asset({
			id: "asset:item-branch",
			label: "Branch",
			fileName: "item-branch",
			sort: 50,
		}),
		asset({
			id: "asset:item-log",
			label: "Log",
			fileName: "item-log",
			sort: 60,
		}),
		asset({
			id: "asset:item-wood-bundle",
			label: "Wood Bundle",
			fileName: "item-wood-bundle",
			sort: 64,
		}),
		asset({
			id: "asset:item-plank",
			label: "Plank",
			fileName: "item-plank",
			sort: 66,
		}),
		asset({
			id: "asset:item-beam",
			label: "Beam",
			fileName: "item-beam",
			sort: 68,
		}),
		asset({
			id: "asset:item-pebble",
			label: "Pebble",
			fileName: "item-pebble",
			sort: 70,
		}),
		asset({
			id: "asset:item-stone",
			label: "Stone",
			fileName: "item-stone",
			sort: 80,
		}),
		asset({
			id: "asset:item-stone-block",
			label: "Stone Block",
			fileName: "item-stone-block",
			sort: 82,
		}),
		asset({
			id: "asset:item-ore",
			label: "Ore",
			fileName: "item-ore",
			sort: 84,
		}),
		asset({
			id: "asset:item-crystal",
			label: "Crystal",
			fileName: "item-crystal",
			sort: 90,
		}),
		asset({
			id: "asset:item-gem",
			label: "Gem",
			fileName: "item-gem",
			sort: 94,
		}),
		asset({
			id: "asset:item-water",
			label: "Water",
			fileName: "item-water",
			sort: 100,
		}),
		asset({
			id: "asset:item-coin",
			label: "Coin",
			fileName: "item-coin",
			sort: 101,
		}),
		asset({
			id: "asset:item-coin-pair",
			label: "Coin Pair",
			fileName: "item-coin-pair",
			sort: 102,
		}),
		asset({
			id: "asset:item-coin-stack",
			label: "Coin Stack",
			fileName: "item-coin-stack",
			sort: 103,
		}),
		asset({
			id: "asset:item-coin-chest",
			label: "Coin Chest",
			fileName: "item-coin-chest",
			sort: 104,
		}),
		asset({
			id: "asset:item-blueprint-scrap",
			label: "Blueprint Scrap",
			fileName: "item-blueprint-scrap",
			sort: 106,
		}),
		asset({
			id: "asset:item-blueprint-fragment",
			label: "Blueprint Fragment",
			fileName: "item-blueprint-fragment",
			sort: 108,
		}),
		asset({
			id: "asset:item-blueprint-draft",
			label: "Blueprint Draft",
			fileName: "item-blueprint-draft",
			sort: 110,
		}),
		asset({
			id: "asset:item-blueprint",
			label: "Finished Blueprint",
			fileName: "item-blueprint",
			sort: 112,
		}),
		blueprintAsset({
			id: "asset:item-blueprint-lumber-camp",
			label: "Lumber Camp Blueprint",
			overlayAssetId: "asset:item-lumber-camp",
			sort: 116,
		}),
		blueprintAsset({
			id: "asset:item-blueprint-quarry",
			label: "Quarry Blueprint",
			overlayAssetId: "asset:item-quarry",
			sort: 120,
		}),
		blueprintAsset({
			id: "asset:item-blueprint-townhall",
			label: "Town Hall Blueprint",
			overlayAssetId: "asset:item-townhall",
			sort: 124,
		}),
		asset({
			id: "asset:item-townhall",
			label: "Town Hall",
			fileName: "item-townhall",
			sort: 125,
		}),
		asset({
			id: "asset:item-lumber-camp",
			label: "Lumber Camp",
			fileName: "item-lumber-camp",
			sort: 130,
		}),
		asset({
			id: "asset:item-coal",
			label: "Coal",
			fileName: "item-coal",
			sort: 132,
		}),
		asset({
			id: "asset:item-sausage",
			label: "Sausage",
			fileName: "item-sausage",
			sort: 134,
		}),
		asset({
			id: "asset:item-beer",
			label: "Beer",
			fileName: "item-beer",
			sort: 136,
		}),
		asset({
			id: "asset:item-coal-mine",
			label: "Coal Mine",
			fileName: "item-coal-mine",
			sort: 138,
		}),
		asset({
			id: "asset:item-quarry",
			label: "Quarry",
			fileName: "item-quarry",
			sort: 140,
		}),
		asset({
			id: "asset:item-crate",
			label: "Common Crate",
			fileName: "item-crate",
			sort: 150,
		}),
		asset({
			id: "asset:item-crate-sturdy",
			label: "Sturdy Crate",
			fileName: "item-crate-sturdy",
			sort: 160,
		}),
		asset({
			id: "asset:item-crate-rare",
			label: "Rare Crate",
			fileName: "item-crate-rare",
			sort: 170,
		}),
		asset({
			id: "asset:item-crate-epic",
			label: "Epic Crate",
			fileName: "item-crate-epic",
			sort: 180,
		}),
		asset({
			id: "asset:item-epic-key",
			label: "Epic Key",
			fileName: "item-epic-key",
			sort: 182,
		}),
	],
	resources: [] as readonly ResourceDefinition[],
	lootTables: [
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
	],
	upgrades: [
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
	],
	items: [
		item({
			id: "item:seed",
			assetId: "asset:item-seed",
			code: "seed",
			name: "Seed",
			tier: 1,
			maxStackSize: 50,
			description: "Tiny start of something suspiciously grindy.",
			tags: [
				"material",
				"plant",
			],
			sort: 10,
			behavior: {
				merge: [
					same({
						id: "merge:seed-seed-sprout",
						selfItemId: "item:seed",
						resultItemId: "item:sprout",
					}),
				],
				craft: craft({
					id: "craft:seed-water-sprout",
					resultItemId: "item:sprout",
					inputs: [
						input({
							itemId: "item:water",
							quantity: 1,
						}),
					],
					durationMs: 10000,
				}),
			},
		}),
		item({
			id: "item:sprout",
			assetId: "asset:item-sprout",
			code: "sprout",
			name: "Sprout",
			tier: 2,
			maxStackSize: 50,
			description: "A plant pretending it has a future.",
			tags: [
				"material",
				"plant",
			],
			sort: 20,
			behavior: {
				merge: [
					same({
						id: "merge:sprout-sprout-leaf",
						selfItemId: "item:sprout",
						resultItemId: "item:leaf",
					}),
				],
				craft: craft({
					id: "craft:sprout-water-sapling",
					resultItemId: "item:sapling",
					inputs: [
						input({
							itemId: "item:water",
							quantity: 1,
						}),
					],
					durationMs: 15000,
				}),
			},
		}),
		item({
			id: "item:leaf",
			assetId: "asset:item-leaf",
			code: "leaf",
			name: "Leaf",
			tier: 3,
			maxStackSize: 50,
			description: "Photosynthesis with storage problems.",
			tags: [
				"material",
				"plant",
			],
			sort: 30,
			behavior: {
				merge: [
					same({
						id: "merge:leaf-leaf-bush",
						selfItemId: "item:leaf",
						resultItemId: "item:bush",
					}),
				],
			},
		}),
		item({
			id: "item:bush",
			assetId: "asset:item-bush",
			code: "bush",
			name: "Bush",
			tier: 4,
			maxStackSize: 25,
			description: "A leaf committee with roots.",
			tags: [
				"material",
				"plant",
			],
			sort: 34,
			behavior: {
				merge: [
					same({
						id: "merge:bush-bush-sapling",
						selfItemId: "item:bush",
						resultItemId: "item:sapling",
					}),
				],
			},
		}),
		item({
			id: "item:sapling",
			assetId: "asset:item-sapling",
			code: "sapling",
			name: "Sapling",
			tier: 5,
			maxStackSize: 15,
			description: "Future tree, current storage problem.",
			tags: [
				"material",
				"plant",
			],
			sort: 38,
			behavior: {
				craft: craft({
					id: "craft:sapling-water-tree",
					resultItemId: "item:tree",
					inputs: [
						input({
							itemId: "item:water",
							quantity: 2,
						}),
					],
					durationMs: 30000,
				}),
			},
		}),
		item({
			id: "item:tree",
			assetId: "asset:item-tree",
			code: "tree",
			name: "Tree",
			tier: 6,
			maxStackSize: 1,
			description: "A tiny forest economy waiting to happen.",
			tags: [
				"producer",
				"plant",
				"wood",
			],
			sort: 39,
			behavior: {
				producer: clickProducer({
					cooldownMs: 6200,
					outputTableId: "loot:tree",
				}),
			},
		}),
		item({
			id: "item:twig",
			assetId: "asset:item-twig",
			code: "twig",
			name: "Twig",
			tier: 1,
			maxStackSize: 50,
			description: "Nature's disposable stick.",
			tags: [
				"material",
				"wood",
			],
			sort: 40,
			behavior: {
				merge: [
					same({
						id: "merge:twig-twig-branch",
						selfItemId: "item:twig",
						resultItemId: "item:branch",
					}),
					combo({
						id: "merge:twig-water-sprout",
						withItemId: "item:water",
						resultItemId: "item:sprout",
						secret: true,
					}),
				],
			},
		}),
		item({
			id: "item:branch",
			assetId: "asset:item-branch",
			code: "branch",
			name: "Branch",
			tier: 2,
			maxStackSize: 50,
			description: "Bigger stick. Humanity is saved.",
			tags: [
				"material",
				"wood",
			],
			sort: 50,
			behavior: {
				merge: [
					same({
						id: "merge:branch-branch-log",
						selfItemId: "item:branch",
						resultItemId: "item:log",
					}),
				],
			},
		}),
		item({
			id: "item:log",
			assetId: "asset:item-log",
			code: "log",
			name: "Log",
			tier: 3,
			maxStackSize: 50,
			description: "A tree with fewer opinions.",
			tags: [
				"material",
				"wood",
			],
			sort: 60,
			behavior: {
				merge: [
					same({
						id: "merge:log-log-wood-bundle",
						selfItemId: "item:log",
						resultItemId: "item:wood-bundle",
					}),
				],
			},
		}),
		item({
			id: "item:wood-bundle",
			assetId: "asset:item-wood-bundle",
			code: "wood-bundle",
			name: "Wood Bundle",
			tier: 4,
			maxStackSize: 25,
			description: "Several logs tied together, because one headache was not enough.",
			tags: [
				"material",
				"wood",
			],
			sort: 64,
			behavior: {
				merge: [
					same({
						id: "merge:wood-bundle-wood-bundle-plank",
						selfItemId: "item:wood-bundle",
						resultItemId: "item:plank",
					}),
				],
			},
		}),
		item({
			id: "item:plank",
			assetId: "asset:item-plank",
			code: "plank",
			name: "Plank",
			tier: 5,
			maxStackSize: 20,
			description: "Wood with straight edges. Humanity briefly improves.",
			tags: [
				"material",
				"wood",
			],
			sort: 66,
			behavior: {
				merge: [
					same({
						id: "merge:plank-plank-beam",
						selfItemId: "item:plank",
						resultItemId: "item:beam",
					}),
				],
			},
		}),
		item({
			id: "item:beam",
			assetId: "asset:item-beam",
			code: "beam",
			name: "Beam",
			tier: 5,
			maxStackSize: 15,
			description: "Wood that finally looks employable.",
			tags: [
				"material",
				"wood",
			],
			sort: 68,
		}),
		item({
			id: "item:pebble",
			assetId: "asset:item-pebble",
			code: "pebble",
			name: "Pebble",
			tier: 1,
			maxStackSize: 50,
			description: "Small rock. Big destiny. Apparently.",
			tags: [
				"material",
				"stone",
			],
			sort: 70,
			behavior: {
				merge: [
					same({
						id: "merge:pebble-pebble-stone",
						selfItemId: "item:pebble",
						resultItemId: "item:stone",
					}),
				],
			},
		}),
		item({
			id: "item:stone",
			assetId: "asset:item-stone",
			code: "stone",
			name: "Stone",
			tier: 2,
			maxStackSize: 50,
			description: "Rock with self-esteem.",
			tags: [
				"material",
				"stone",
			],
			sort: 80,
			behavior: {
				merge: [
					same({
						id: "merge:stone-stone-stone-block",
						selfItemId: "item:stone",
						resultItemId: "item:stone-block",
					}),
					combo({
						id: "merge:stone-water-crystal",
						withItemId: "item:water",
						resultItemId: "item:crystal",
						secret: true,
					}),
				],
			},
		}),
		item({
			id: "item:stone-block",
			assetId: "asset:item-stone-block",
			code: "stone-block",
			name: "Stone Block",
			tier: 3,
			maxStackSize: 30,
			description: "Stone that finally agreed to geometry.",
			tags: [
				"material",
				"stone",
			],
			sort: 82,
			behavior: {
				merge: [
					same({
						id: "merge:stone-block-stone-block-ore",
						selfItemId: "item:stone-block",
						resultItemId: "item:ore",
					}),
				],
			},
		}),
		item({
			id: "item:ore",
			assetId: "asset:item-ore",
			code: "ore",
			name: "Ore",
			tier: 3,
			maxStackSize: 40,
			description: "Stone with ambition and questionable impurities.",
			tags: [
				"material",
				"stone",
			],
			sort: 84,
			behavior: {
				merge: [
					same({
						id: "merge:ore-ore-crystal",
						selfItemId: "item:ore",
						resultItemId: "item:crystal",
					}),
				],
			},
		}),
		item({
			id: "item:crystal",
			assetId: "asset:item-crystal",
			code: "crystal",
			name: "Crystal",
			tier: 4,
			maxStackSize: 25,
			description: "Shiny enough to justify bad decisions.",
			tags: [
				"material",
				"stone",
				"rare",
			],
			sort: 90,
			behavior: {
				merge: [
					same({
						id: "merge:crystal-crystal-gem",
						selfItemId: "item:crystal",
						resultItemId: "item:gem",
					}),
				],
			},
		}),
		item({
			id: "item:gem",
			assetId: "asset:item-gem",
			code: "gem",
			name: "Gem",
			tier: 5,
			maxStackSize: 15,
			description: "A crystal with marketing budget.",
			tags: [
				"material",
				"stone",
				"rare",
			],
			sort: 94,
		}),
		item({
			id: "item:water",
			assetId: "asset:item-water",
			code: "water",
			name: "Water",
			tier: 1,
			maxStackSize: 50,
			description: "Liquid logistics. Somehow still your problem.",
			tags: [
				"material",
				"water",
			],
			sort: 100,
		}),
		item({
			id: "item:coal",
			assetId: "asset:item-coal",
			code: "coal",
			name: "Coal",
			tier: 2,
			maxStackSize: 40,
			description: "Black fuel for machines that apparently need motivation.",
			tags: [
				"material",
				"fuel",
			],
			sort: 105,
		}),
		item({
			id: "item:sausage",
			assetId: "asset:item-sausage",
			code: "sausage",
			name: "Sausage",
			tier: 1,
			maxStackSize: 30,
			description: "Producer fuel, because workers are tragically organic.",
			tags: [
				"material",
				"food",
			],
			sort: 106,
		}),
		item({
			id: "item:beer",
			assetId: "asset:item-beer",
			code: "beer",
			name: "Beer",
			tier: 1,
			maxStackSize: 30,
			description: "Liquid morale. The economy is clearly fine.",
			tags: [
				"material",
				"drink",
			],
			sort: 107,
		}),
		item({
			id: "item:coin",
			assetId: "asset:item-coin",
			code: "coin",
			name: "Coin",
			tier: 1,
			maxStackSize: 50,
			description: "A small metal excuse for progression.",
			tags: [
				"currency",
			],
			sort: 180,
			behavior: {
				merge: [
					same({
						id: "merge:coin-coin-pair",
						selfItemId: "item:coin",
						resultItemId: "item:coin-pair",
					}),
				],
			},
		}),
		item({
			id: "item:coin-pair",
			assetId: "asset:item-coin-pair",
			code: "coin-pair",
			name: "Coin Pair",
			tier: 2,
			maxStackSize: 40,
			description: "Two coins. Somehow this already feels like accounting.",
			tags: [
				"currency",
			],
			sort: 182,
			behavior: {
				merge: [
					same({
						id: "merge:coin-pair-stack",
						selfItemId: "item:coin-pair",
						resultItemId: "item:coin-stack",
					}),
				],
			},
		}),
		item({
			id: "item:coin-stack",
			assetId: "asset:item-coin-stack",
			code: "coin-stack",
			name: "Coin Stack",
			tier: 3,
			maxStackSize: 30,
			description: "A stack of little reasons to open the upgrades sheet.",
			tags: [
				"currency",
			],
			sort: 184,
			behavior: {
				merge: [
					same({
						id: "merge:coin-stack-chest",
						selfItemId: "item:coin-stack",
						resultItemId: "item:coin-chest",
					}),
				],
			},
		}),
		item({
			id: "item:coin-chest",
			assetId: "asset:item-coin-chest",
			code: "coin-chest",
			name: "Coin Chest",
			tier: 4,
			maxStackSize: 20,
			description: "A boxed-up upgrade fund. Finally, clutter with ambition.",
			tags: [
				"currency",
			],
			sort: 186,
		}),
		item({
			id: "item:blueprint-scrap",
			assetId: "asset:item-blueprint-scrap",
			code: "blueprint-scrap",
			name: "Blueprint Scrap",
			tier: 1,
			maxStackSize: 20,
			description: "A torn blank construction note. Inspiring, in the way paperwork can be.",
			tags: [
				"blueprint",
				"fragment",
			],
			sort: 200,
			behavior: {
				merge: [
					same({
						id: "merge:blueprint-scrap-fragment",
						selfItemId: "item:blueprint-scrap",
						resultItemId: "item:blueprint-fragment",
					}),
				],
			},
		}),
		item({
			id: "item:blueprint-fragment",
			assetId: "asset:item-blueprint-fragment",
			code: "blueprint-fragment",
			name: "Blueprint Fragment",
			tier: 2,
			maxStackSize: 15,
			description: "A bigger blank plan piece. Still technically a mess, but taller.",
			tags: [
				"blueprint",
				"fragment",
			],
			sort: 201,
			behavior: {
				merge: [
					same({
						id: "merge:blueprint-fragment-draft",
						selfItemId: "item:blueprint-fragment",
						resultItemId: "item:blueprint-draft",
					}),
				],
			},
		}),
		item({
			id: "item:blueprint-draft",
			assetId: "asset:item-blueprint-draft",
			code: "blueprint-draft",
			name: "Blueprint Draft",
			tier: 3,
			maxStackSize: 10,
			description: "A nearly usable blank plan. Construction bureaucracy is blooming.",
			tags: [
				"blueprint",
				"fragment",
			],
			sort: 202,
			behavior: {
				merge: [
					same({
						id: "merge:blueprint-draft-final",
						selfItemId: "item:blueprint-draft",
						resultItemId: "item:blueprint",
					}),
				],
			},
		}),
		item({
			id: "item:blueprint",
			assetId: "asset:item-blueprint",
			code: "blueprint",
			name: "Blank Blueprint",
			tier: 4,
			maxStackSize: 5,
			description:
				"A finished blank plan. Drag a known build target onto it to burn in the idea without sacrificing the original.",
			tags: [
				"blueprint",
				"blank",
			],
			sort: 203,
		}),
		item({
			id: "item:blueprint-lumber-camp",
			assetId: "asset:item-blueprint-lumber-camp",
			code: "blueprint-lumber-camp",
			name: "Lumber Camp Blueprint",
			tier: 4,
			maxStackSize: 5,
			description: "Finished plan. Now feed it materials until civilization happens.",
			tags: [
				"blueprint",
				"craft-target",
			],
			sort: 204,
			behavior: {
				craft: craft({
					id: "craft:lumber-camp",
					resultItemId: "item:lumber-camp-1",
					inputs: [
						input({
							itemId: "item:plank",
							quantity: 1,
						}),
						input({
							itemId: "item:stone-block",
							quantity: 1,
						}),
					],
				}),
			},
		}),
		item({
			id: "item:blueprint-quarry",
			assetId: "asset:item-blueprint-quarry",
			code: "blueprint-quarry",
			name: "Quarry Blueprint",
			tier: 4,
			maxStackSize: 5,
			description: "Finished plan. Now feed it materials until civilization happens.",
			tags: [
				"blueprint",
				"craft-target",
			],
			sort: 224,
			behavior: {
				craft: craft({
					id: "craft:quarry",
					resultItemId: "item:quarry-1",
					inputs: [
						input({
							itemId: "item:beam",
							quantity: 1,
						}),
						input({
							itemId: "item:stone-block",
							quantity: 2,
						}),
					],
				}),
			},
		}),
		item({
			id: "item:blueprint-townhall",
			assetId: "asset:item-blueprint-townhall",
			code: "blueprint-townhall",
			name: "Town Hall Blueprint",
			tier: 4,
			maxStackSize: 5,
			description: "Finished plan. Now feed it materials until civilization happens.",
			tags: [
				"blueprint",
				"craft-target",
			],
			sort: 244,
			behavior: {
				craft: craft({
					id: "craft:townhall",
					resultItemId: "item:townhall-1",
					inputs: [
						input({
							itemId: "item:beam",
							quantity: 1,
						}),
						input({
							itemId: "item:stone-block",
							quantity: 2,
						}),
						input({
							itemId: "item:gem",
							quantity: 1,
						}),
					],
				}),
			},
		}),
		item({
			id: "item:blueprint-lumber-camp-2",
			assetId: "asset:item-blueprint-lumber-camp",
			code: "blueprint-lumber-camp-2",
			name: "Lumber Camp 2 Blueprint",
			tier: 4,
			maxStackSize: 4,
			description:
				"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			tags: [
				"blueprint",
				"craft-target",
			],
			sort: 206,
			behavior: {
				label: "2",
				craft: craft({
					id: "craft:lumber-camp-2",
					resultItemId: "item:lumber-camp-2",
					inputs: [
						input({
							itemId: "item:lumber-camp-1",
							quantity: 2,
						}),
						input({
							itemId: "item:plank",
							quantity: 1,
						}),
						input({
							itemId: "item:stone-block",
							quantity: 1,
						}),
					],
				}),
			},
		}),
		item({
			id: "item:blueprint-lumber-camp-3",
			assetId: "asset:item-blueprint-lumber-camp",
			code: "blueprint-lumber-camp-3",
			name: "Lumber Camp 3 Blueprint",
			tier: 4,
			maxStackSize: 4,
			description:
				"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			tags: [
				"blueprint",
				"craft-target",
			],
			sort: 207,
			behavior: {
				label: "3",
				craft: craft({
					id: "craft:lumber-camp-3",
					resultItemId: "item:lumber-camp-3",
					inputs: [
						input({
							itemId: "item:lumber-camp-2",
							quantity: 2,
						}),
						input({
							itemId: "item:plank",
							quantity: 1,
						}),
						input({
							itemId: "item:stone-block",
							quantity: 1,
						}),
					],
				}),
			},
		}),
		item({
			id: "item:blueprint-lumber-camp-4",
			assetId: "asset:item-blueprint-lumber-camp",
			code: "blueprint-lumber-camp-4",
			name: "Lumber Camp 4 Blueprint",
			tier: 4,
			maxStackSize: 4,
			description:
				"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			tags: [
				"blueprint",
				"craft-target",
			],
			sort: 208,
			behavior: {
				label: "4",
				craft: craft({
					id: "craft:lumber-camp-4",
					resultItemId: "item:lumber-camp-4",
					inputs: [
						input({
							itemId: "item:lumber-camp-3",
							quantity: 2,
						}),
						input({
							itemId: "item:plank",
							quantity: 1,
						}),
						input({
							itemId: "item:stone-block",
							quantity: 1,
						}),
					],
				}),
			},
		}),
		item({
			id: "item:blueprint-lumber-camp-5",
			assetId: "asset:item-blueprint-lumber-camp",
			code: "blueprint-lumber-camp-5",
			name: "Lumber Camp 5 Blueprint",
			tier: 4,
			maxStackSize: 4,
			description:
				"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			tags: [
				"blueprint",
				"craft-target",
			],
			sort: 209,
			behavior: {
				label: "5",
				craft: craft({
					id: "craft:lumber-camp-5",
					resultItemId: "item:lumber-camp-5",
					inputs: [
						input({
							itemId: "item:lumber-camp-4",
							quantity: 2,
						}),
						input({
							itemId: "item:plank",
							quantity: 1,
						}),
						input({
							itemId: "item:stone-block",
							quantity: 1,
						}),
					],
				}),
			},
		}),
		item({
			id: "item:blueprint-quarry-2",
			assetId: "asset:item-blueprint-quarry",
			code: "blueprint-quarry-2",
			name: "Quarry 2 Blueprint",
			tier: 4,
			maxStackSize: 4,
			description:
				"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			tags: [
				"blueprint",
				"craft-target",
			],
			sort: 226,
			behavior: {
				label: "2",
				craft: craft({
					id: "craft:quarry-2",
					resultItemId: "item:quarry-2",
					inputs: [
						input({
							itemId: "item:quarry-1",
							quantity: 2,
						}),
						input({
							itemId: "item:beam",
							quantity: 1,
						}),
						input({
							itemId: "item:stone-block",
							quantity: 2,
						}),
					],
				}),
			},
		}),
		item({
			id: "item:blueprint-quarry-3",
			assetId: "asset:item-blueprint-quarry",
			code: "blueprint-quarry-3",
			name: "Quarry 3 Blueprint",
			tier: 4,
			maxStackSize: 4,
			description:
				"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			tags: [
				"blueprint",
				"craft-target",
			],
			sort: 227,
			behavior: {
				label: "3",
				craft: craft({
					id: "craft:quarry-3",
					resultItemId: "item:quarry-3",
					inputs: [
						input({
							itemId: "item:quarry-2",
							quantity: 2,
						}),
						input({
							itemId: "item:beam",
							quantity: 1,
						}),
						input({
							itemId: "item:stone-block",
							quantity: 2,
						}),
					],
				}),
			},
		}),
		item({
			id: "item:blueprint-quarry-4",
			assetId: "asset:item-blueprint-quarry",
			code: "blueprint-quarry-4",
			name: "Quarry 4 Blueprint",
			tier: 4,
			maxStackSize: 4,
			description:
				"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			tags: [
				"blueprint",
				"craft-target",
			],
			sort: 228,
			behavior: {
				label: "4",
				craft: craft({
					id: "craft:quarry-4",
					resultItemId: "item:quarry-4",
					inputs: [
						input({
							itemId: "item:quarry-3",
							quantity: 2,
						}),
						input({
							itemId: "item:beam",
							quantity: 1,
						}),
						input({
							itemId: "item:stone-block",
							quantity: 2,
						}),
					],
				}),
			},
		}),
		item({
			id: "item:blueprint-quarry-5",
			assetId: "asset:item-blueprint-quarry",
			code: "blueprint-quarry-5",
			name: "Quarry 5 Blueprint",
			tier: 4,
			maxStackSize: 4,
			description:
				"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			tags: [
				"blueprint",
				"craft-target",
			],
			sort: 229,
			behavior: {
				label: "5",
				craft: craft({
					id: "craft:quarry-5",
					resultItemId: "item:quarry-5",
					inputs: [
						input({
							itemId: "item:quarry-4",
							quantity: 2,
						}),
						input({
							itemId: "item:beam",
							quantity: 1,
						}),
						input({
							itemId: "item:stone-block",
							quantity: 2,
						}),
					],
				}),
			},
		}),
		item({
			id: "item:blueprint-townhall-2",
			assetId: "asset:item-blueprint-townhall",
			code: "blueprint-townhall-2",
			name: "Town Hall 2 Blueprint",
			tier: 4,
			maxStackSize: 4,
			description:
				"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			tags: [
				"blueprint",
				"craft-target",
			],
			sort: 246,
			behavior: {
				label: "2",
				craft: craft({
					id: "craft:townhall-2",
					resultItemId: "item:townhall-2",
					inputs: [
						input({
							itemId: "item:townhall-1",
							quantity: 2,
						}),
						input({
							itemId: "item:beam",
							quantity: 2,
						}),
						input({
							itemId: "item:stone-block",
							quantity: 2,
						}),
					],
				}),
			},
		}),
		item({
			id: "item:blueprint-townhall-3",
			assetId: "asset:item-blueprint-townhall",
			code: "blueprint-townhall-3",
			name: "Town Hall 3 Blueprint",
			tier: 4,
			maxStackSize: 4,
			description:
				"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			tags: [
				"blueprint",
				"craft-target",
			],
			sort: 247,
			behavior: {
				label: "3",
				craft: craft({
					id: "craft:townhall-3",
					resultItemId: "item:townhall-3",
					inputs: [
						input({
							itemId: "item:townhall-2",
							quantity: 2,
						}),
						input({
							itemId: "item:beam",
							quantity: 2,
						}),
						input({
							itemId: "item:stone-block",
							quantity: 2,
						}),
					],
				}),
			},
		}),
		item({
			id: "item:blueprint-townhall-4",
			assetId: "asset:item-blueprint-townhall",
			code: "blueprint-townhall-4",
			name: "Town Hall 4 Blueprint",
			tier: 4,
			maxStackSize: 4,
			description:
				"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			tags: [
				"blueprint",
				"craft-target",
			],
			sort: 248,
			behavior: {
				label: "4",
				craft: craft({
					id: "craft:townhall-4",
					resultItemId: "item:townhall-4",
					inputs: [
						input({
							itemId: "item:townhall-3",
							quantity: 2,
						}),
						input({
							itemId: "item:beam",
							quantity: 2,
						}),
						input({
							itemId: "item:stone-block",
							quantity: 2,
						}),
					],
				}),
			},
		}),
		item({
			id: "item:blueprint-townhall-5",
			assetId: "asset:item-blueprint-townhall",
			code: "blueprint-townhall-5",
			name: "Town Hall 5 Blueprint",
			tier: 4,
			maxStackSize: 4,
			description:
				"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			tags: [
				"blueprint",
				"craft-target",
			],
			sort: 249,
			behavior: {
				label: "5",
				craft: craft({
					id: "craft:townhall-5",
					resultItemId: "item:townhall-5",
					inputs: [
						input({
							itemId: "item:townhall-4",
							quantity: 2,
						}),
						input({
							itemId: "item:beam",
							quantity: 2,
						}),
						input({
							itemId: "item:stone-block",
							quantity: 2,
						}),
					],
				}),
			},
		}),
		item({
			id: "item:townhall-1",
			assetId: "asset:item-townhall",
			code: "townhall-1",
			name: "Town Hall I",
			tier: 1,
			maxStackSize: 1,
			description: "A tiny bureaucracy that spits out progress.",
			tags: [
				"producer",
				"building",
				"townhall",
			],
			sort: 300,
			behavior: {
				merge: [
					imprint({
						id: "merge:townhall-1-blueprint",
						withItemId: "item:blueprint",
						resultItemId: "item:blueprint-townhall",
					}),
				],
				label: "1",
				producer: clickProducer({
					cooldownMs: 3500,
					outputTableId: "loot:townhall-1",
				}),
			},
		}),
		item({
			id: "item:townhall-2",
			assetId: "asset:item-townhall",
			code: "townhall-2",
			name: "Town Hall II",
			tier: 2,
			maxStackSize: 1,
			description: "Same bureaucracy, slightly shinier clipboard.",
			tags: [
				"producer",
				"building",
				"townhall",
			],
			sort: 310,
			behavior: {
				merge: [
					imprint({
						id: "merge:townhall-2-blueprint",
						withItemId: "item:blueprint",
						resultItemId: "item:blueprint-townhall-2",
					}),
				],
				label: "2",
				producer: clickProducer({
					cooldownMs: 3000,
					outputTableId: "loot:townhall-2",
				}),
			},
		}),
		item({
			id: "item:townhall-3",
			assetId: "asset:item-townhall",
			code: "townhall-3",
			name: "Town Hall III",
			tier: 3,
			maxStackSize: 1,
			description: "Municipal paperwork with actual momentum.",
			tags: [
				"producer",
				"building",
				"townhall",
			],
			sort: 320,
			behavior: {
				merge: [
					imprint({
						id: "merge:townhall-3-blueprint",
						withItemId: "item:blueprint",
						resultItemId: "item:blueprint-townhall-3",
					}),
				],
				label: "3",
				producer: clickProducer({
					cooldownMs: 2500,
					outputTableId: "loot:townhall-3",
				}),
			},
		}),
		item({
			id: "item:townhall-4",
			assetId: "asset:item-townhall",
			code: "townhall-4",
			name: "Town Hall IV",
			tier: 4,
			maxStackSize: 1,
			description: "Bureaucracy with sparkles. Humanity had options.",
			tags: [
				"producer",
				"building",
				"townhall",
			],
			sort: 324,
			behavior: {
				merge: [
					imprint({
						id: "merge:townhall-4-blueprint",
						withItemId: "item:blueprint",
						resultItemId: "item:blueprint-townhall-4",
					}),
				],
				label: "4",
				producer: clickProducer({
					cooldownMs: 2200,
					outputTableId: "loot:townhall-4",
				}),
			},
		}),
		item({
			id: "item:townhall-5",
			assetId: "asset:item-townhall",
			code: "townhall-5",
			name: "Town Hall V",
			tier: 5,
			maxStackSize: 1,
			description: "A municipal beast with alarming confidence.",
			tags: [
				"producer",
				"building",
				"townhall",
			],
			sort: 328,
			behavior: {
				merge: [
					imprint({
						id: "merge:townhall-5-blueprint",
						withItemId: "item:blueprint",
						resultItemId: "item:blueprint-townhall-5",
					}),
				],
				label: "5",
				producer: clickProducer({
					cooldownMs: 1900,
					outputTableId: "loot:townhall-5",
				}),
			},
		}),
		item({
			id: "item:lumber-camp-1",
			assetId: "asset:item-lumber-camp",
			code: "lumber-camp-1",
			name: "Lumber Camp I",
			tier: 1,
			maxStackSize: 1,
			description: "A polite machine for turning time into sticks.",
			tags: [
				"producer",
				"building",
				"wood",
			],
			sort: 330,
			behavior: {
				merge: [
					imprint({
						id: "merge:lumber-camp-1-blueprint",
						withItemId: "item:blueprint",
						resultItemId: "item:blueprint-lumber-camp",
					}),
				],
				label: "1",
				producer: clickProducer({
					cooldownMs: 5000,
					outputTableId: "loot:lumber-camp-1",
				}),
			},
		}),
		item({
			id: "item:lumber-camp-2",
			assetId: "asset:item-lumber-camp",
			code: "lumber-camp-2",
			name: "Lumber Camp II",
			tier: 2,
			maxStackSize: 1,
			description: "Still wood, but now with ambition.",
			tags: [
				"producer",
				"building",
				"wood",
			],
			sort: 340,
			behavior: {
				merge: [
					imprint({
						id: "merge:lumber-camp-2-blueprint",
						withItemId: "item:blueprint",
						resultItemId: "item:blueprint-lumber-camp-2",
					}),
				],
				label: "2",
				producer: clickProducer({
					cooldownMs: 4500,
					outputTableId: "loot:lumber-camp-2",
				}),
			},
		}),
		item({
			id: "item:lumber-camp-3",
			assetId: "asset:item-lumber-camp",
			code: "lumber-camp-3",
			name: "Lumber Camp III",
			tier: 3,
			maxStackSize: 1,
			description: "A compact shrine to deforestation.",
			tags: [
				"producer",
				"building",
				"wood",
			],
			sort: 350,
			behavior: {
				merge: [
					imprint({
						id: "merge:lumber-camp-3-blueprint",
						withItemId: "item:blueprint",
						resultItemId: "item:blueprint-lumber-camp-3",
					}),
				],
				label: "3",
				producer: clickProducer({
					cooldownMs: 4000,
					outputTableId: "loot:lumber-camp-3",
				}),
			},
		}),
		item({
			id: "item:lumber-camp-4",
			assetId: "asset:item-lumber-camp",
			code: "lumber-camp-4",
			name: "Lumber Camp IV",
			tier: 4,
			maxStackSize: 1,
			description: "Deforestation, now with workflows.",
			tags: [
				"producer",
				"building",
				"wood",
			],
			sort: 354,
			behavior: {
				merge: [
					imprint({
						id: "merge:lumber-camp-4-blueprint",
						withItemId: "item:blueprint",
						resultItemId: "item:blueprint-lumber-camp-4",
					}),
				],
				label: "4",
				producer: clickProducer({
					cooldownMs: 3600,
					outputTableId: "loot:lumber-camp-4",
				}),
			},
		}),
		item({
			id: "item:lumber-camp-5",
			assetId: "asset:item-lumber-camp",
			code: "lumber-camp-5",
			name: "Lumber Camp V",
			tier: 5,
			maxStackSize: 1,
			description: "At this point the forest has filed a complaint.",
			tags: [
				"producer",
				"building",
				"wood",
			],
			sort: 358,
			behavior: {
				merge: [
					imprint({
						id: "merge:lumber-camp-5-blueprint",
						withItemId: "item:blueprint",
						resultItemId: "item:blueprint-lumber-camp-5",
					}),
				],
				label: "5",
				producer: clickProducer({
					cooldownMs: 3200,
					outputTableId: "loot:lumber-camp-5",
				}),
			},
		}),
		item({
			id: "item:quarry-1",
			assetId: "asset:item-quarry",
			code: "quarry-1",
			name: "Quarry I",
			tier: 1,
			maxStackSize: 1,
			description: "A hole in the ground with a business model.",
			tags: [
				"producer",
				"building",
				"stone",
			],
			sort: 360,
			behavior: {
				merge: [
					imprint({
						id: "merge:quarry-1-blueprint",
						withItemId: "item:blueprint",
						resultItemId: "item:blueprint-quarry",
					}),
				],
				label: "1",
				producer: clickProducer({
					cooldownMs: 5500,
					outputTableId: "loot:quarry-1",
				}),
			},
		}),
		item({
			id: "item:quarry-2",
			assetId: "asset:item-quarry",
			code: "quarry-2",
			name: "Quarry II",
			tier: 2,
			maxStackSize: 1,
			description: "A deeper hole, because progress is weird.",
			tags: [
				"producer",
				"building",
				"stone",
			],
			sort: 370,
			behavior: {
				merge: [
					imprint({
						id: "merge:quarry-2-blueprint",
						withItemId: "item:blueprint",
						resultItemId: "item:blueprint-quarry-2",
					}),
				],
				label: "2",
				producer: clickProducer({
					cooldownMs: 5000,
					outputTableId: "loot:quarry-2",
				}),
			},
		}),
		item({
			id: "item:quarry-3",
			assetId: "asset:item-quarry",
			code: "quarry-3",
			name: "Quarry III",
			tier: 3,
			maxStackSize: 1,
			description: "Rocks leaving the earth at startup velocity.",
			tags: [
				"producer",
				"building",
				"stone",
			],
			sort: 380,
			behavior: {
				merge: [
					imprint({
						id: "merge:quarry-3-blueprint",
						withItemId: "item:blueprint",
						resultItemId: "item:blueprint-quarry-3",
					}),
				],
				label: "3",
				producer: clickProducer({
					cooldownMs: 4500,
					outputTableId: "loot:quarry-3",
				}),
			},
		}),
		item({
			id: "item:quarry-4",
			assetId: "asset:item-quarry",
			code: "quarry-4",
			name: "Quarry IV",
			tier: 4,
			maxStackSize: 1,
			description: "A sophisticated hole. Still a hole.",
			tags: [
				"producer",
				"building",
				"stone",
			],
			sort: 384,
			behavior: {
				merge: [
					imprint({
						id: "merge:quarry-4-blueprint",
						withItemId: "item:blueprint",
						resultItemId: "item:blueprint-quarry-4",
					}),
				],
				label: "4",
				producer: clickProducer({
					cooldownMs: 4100,
					outputTableId: "loot:quarry-4",
				}),
			},
		}),
		item({
			id: "item:quarry-5",
			assetId: "asset:item-quarry",
			code: "quarry-5",
			name: "Quarry V",
			tier: 5,
			maxStackSize: 1,
			description: "Rocks surrender before the tap lands.",
			tags: [
				"producer",
				"building",
				"stone",
			],
			sort: 388,
			behavior: {
				merge: [
					imprint({
						id: "merge:quarry-5-blueprint",
						withItemId: "item:blueprint",
						resultItemId: "item:blueprint-quarry-5",
					}),
				],
				label: "5",
				producer: clickProducer({
					cooldownMs: 3700,
					outputTableId: "loot:quarry-5",
				}),
			},
		}),
		item({
			id: "item:coal-mine-1",
			assetId: "asset:item-coal-mine",
			code: "coal-mine-1",
			name: "Coal Mine I",
			tier: 1,
			maxStackSize: 1,
			description:
				"Produces coal only after it receives sausage and beer. Labor relations remain advanced nonsense.",
			tags: [
				"producer",
				"building",
				"fuel",
			],
			sort: 392,
			behavior: {
				label: "1",
				producer: clickProducer({
					cooldownMs: 5200,
					outputTableId: "loot:coal-mine-1",
					inputs: [
						producerInput({
							itemId: "item:sausage",
							quantity: 1,
							capacity: 4,
						}),
						producerInput({
							itemId: "item:beer",
							quantity: 1,
							capacity: 4,
						}),
					],
				}),
			},
		}),
		item({
			id: "item:crate-1",
			assetId: "asset:item-crate",
			code: "crate-1",
			name: "Common Crate",
			tier: 1,
			maxStackSize: 1,
			description: "A finite producer with suspicious contents.",
			tags: [
				"producer",
				"container",
			],
			sort: 400,
			behavior: {
				merge: [
					same({
						id: "merge:crate-1-crate-2",
						selfItemId: "item:crate-1",
						resultItemId: "item:crate-2",
					}),
				],
				stash: clickStash({
					charges: 3,
					outputTableId: "loot:crate-1",
				}),
			},
		}),
		item({
			id: "item:crate-2",
			assetId: "asset:item-crate-sturdy",
			code: "crate-2",
			name: "Sturdy Crate",
			tier: 2,
			maxStackSize: 1,
			description: "Same box, fewer disappointments.",
			tags: [
				"producer",
				"container",
			],
			sort: 410,
			behavior: {
				merge: [
					same({
						id: "merge:crate-2-crate-3",
						selfItemId: "item:crate-2",
						resultItemId: "item:crate-3",
					}),
				],
				stash: clickStash({
					charges: 4,
					outputTableId: "loot:crate-2",
				}),
			},
		}),
		item({
			id: "item:crate-3",
			assetId: "asset:item-crate-rare",
			code: "crate-3",
			name: "Rare Crate",
			tier: 3,
			maxStackSize: 1,
			description: "A tiny treasure economy in a box.",
			tags: [
				"producer",
				"container",
				"rare",
			],
			sort: 420,
			behavior: {
				merge: [
					same({
						id: "merge:crate-3-crate-4",
						selfItemId: "item:crate-3",
						resultItemId: "item:crate-4",
					}),
				],
				stash: clickStash({
					charges: 5,
					outputTableId: "loot:crate-3",
				}),
			},
		}),
		item({
			id: "item:epic-key",
			assetId: "asset:item-epic-key",
			code: "epic-key",
			name: "Epic Key",
			tier: 4,
			maxStackSize: 1,
			description: "A diamond-studded key that opens the Epic Crate.",
			tags: [
				"key",
				"rare",
			],
			sort: 425,
			behavior: {},
		}),
		item({
			id: "item:crate-4",
			assetId: "asset:item-crate-epic",
			code: "crate-4",
			name: "Epic Crate",
			tier: 4,
			maxStackSize: 1,
			description: "Purple box. The economy is doomed.",
			tags: [
				"producer",
				"container",
				"rare",
			],
			sort: 430,
			behavior: {
				stash: clickStash({
					charges: 6,
					outputTableId: "loot:crate-4",
					onDepleted: "remove",
					inputs: [
						producerInput({
							itemId: "item:epic-key",
							quantity: 1,
							capacity: 1,
						}),
					],
				}),
			},
		}),
	],
	startingState: {
		resources: [] as readonly {
			resourceId: ResourceId;
			quantity: number;
		}[],
		inventory: [
			{
				itemId: "item:blueprint-scrap",
				quantity: 10,
			},
			{
				itemId: "item:twig",
				quantity: 8,
			},
			{
				itemId: "item:pebble",
				quantity: 8,
			},
			{
				itemId: "item:water",
				quantity: 4,
			},
			{
				itemId: "item:sausage",
				quantity: 3,
			},
			{
				itemId: "item:beer",
				quantity: 3,
			},
			{
				itemId: "item:coin-stack",
				quantity: 1,
			},
		],
		board: [
			{
				itemId: "item:townhall-1",
				x: 3,
				y: 4,
			},
			{
				itemId: "item:lumber-camp-1",
				x: 1,
				y: 4,
			},
			{
				itemId: "item:quarry-1",
				x: 5,
				y: 4,
			},
			{
				itemId: "item:coal-mine-1",
				x: 3,
				y: 6,
			},
		],
	},
} satisfies GameConfig.Shape;
export type GameConfig = typeof GameConfig;
export namespace GameConfig {
	export interface Shape {
		game: {
			id: "arkini";
			title: "Arkini";
			board: {
				width: 7;
				height: 9;
			};
			inventory: {
				slots: number;
			};
		};
		assets: readonly AssetDefinition[];
		resources: readonly ResourceDefinition[];
		lootTables: readonly LootTableDefinition[];
		upgrades: readonly UpgradeDefinition[];
		items: readonly ItemDefinition[];
		startingState: {
			resources: readonly {
				resourceId: ResourceId;
				quantity: number;
			}[];
			inventory: readonly {
				itemId: ItemId;
				quantity: number;
			}[];
			board: readonly {
				itemId: ItemId;
				x: number;
				y: number;
			}[];
		};
	}
}
