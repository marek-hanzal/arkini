import type { ItemDefinition } from "../../../item";
import { clickProducer } from "../../../dsl/clickProducer";
import { imprint } from "../../../dsl/imprint";
import { item } from "../../../dsl/item";

export const LumberCampItemDefinitions = [
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
] satisfies ItemDefinition[];
