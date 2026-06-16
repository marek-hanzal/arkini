import type { ItemDefinition } from "../../../item";
import { clickProducer } from "../../../dsl/clickProducer";
import { imprint } from "../../../dsl/imprint";
import { item } from "../../../dsl/item";

export const TownhallItemDefinitions = [
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
] satisfies ItemDefinition[];
