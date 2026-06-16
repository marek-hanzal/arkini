import type { ItemDefinition } from "../../../item";
import { combo } from "../../../dsl/combo";
import { same } from "../../../dsl/same";
import { item } from "../../../dsl/item";

export const StoneItemDefinitions = [
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
] satisfies ItemDefinition[];
