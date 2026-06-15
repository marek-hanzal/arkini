import type { ItemDefinition } from "../../item";
import { clickProducer } from "../../dsl/clickProducer";
import { combo } from "../../dsl/combo";
import { craft } from "../../dsl/craft";
import { input } from "../../dsl/input";
import { item } from "../../dsl/item";
import { same } from "../../dsl/same";

export const NaturalItemDefinitions = [
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
] satisfies ItemDefinition[];
