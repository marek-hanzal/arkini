import type { ItemDefinition } from "../../../item";
import { same } from "../../../dsl/same";
import { item } from "../../../dsl/item";

export const WoodItemDefinitions = [
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
] satisfies ItemDefinition[];
