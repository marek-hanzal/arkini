import type { ItemDefinition } from "../../../item";
import { clickProducer } from "../../../dsl/clickProducer";
import { imprint } from "../../../dsl/imprint";
import { item } from "../../../dsl/item";

export const QuarryItemDefinitions = [
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
] satisfies ItemDefinition[];
