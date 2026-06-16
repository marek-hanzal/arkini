import type { ItemDefinition } from "../../../item";
import { craft } from "../../../dsl/craft";
import { input } from "../../../dsl/input";
import { item } from "../../../dsl/item";

export const QuarryBlueprintUpgradeItemDefinitions = [
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
] satisfies ItemDefinition[];
