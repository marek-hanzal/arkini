import type { ItemDefinition } from "../../item";
import { clickStash } from "../../dsl/clickStash";
import { item } from "../../dsl/item";
import { producerInput } from "../../dsl/producerInput";
import { same } from "../../dsl/same";

export const CrateItemDefinitions = [
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
] satisfies ItemDefinition[];
