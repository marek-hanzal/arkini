import type { ItemDefinition } from "../../../item";
import { clickProducer } from "../../../dsl/clickProducer";
import { craft } from "../../../dsl/craft";
import { input } from "../../../dsl/input";
import { same } from "../../../dsl/same";
import { item } from "../../../dsl/item";

export const PlantItemDefinitions = [
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
] satisfies ItemDefinition[];
