import type { ItemDefinition } from "../../../item";
import { craft } from "../../../dsl/craft";
import { input } from "../../../dsl/input";
import { item } from "../../../dsl/item";

export const LumberCampBlueprintUpgradeItemDefinitions = [
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
] satisfies ItemDefinition[];
