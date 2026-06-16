import type { ItemDefinition } from "../../../item";
import { craft } from "../../../dsl/craft";
import { input } from "../../../dsl/input";
import { item } from "../../../dsl/item";

export const TownhallBlueprintUpgradeItemDefinitions = [
	item({
		id: "item:blueprint-townhall-2",
		assetId: "asset:item-blueprint-townhall",
		code: "blueprint-townhall-2",
		name: "Town Hall 2 Blueprint",
		tier: 4,
		maxStackSize: 4,
		description:
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 246,
		behavior: {
			label: "2",
			craft: craft({
				id: "craft:townhall-2",
				resultItemId: "item:townhall-2",
				inputs: [
					input({
						itemId: "item:townhall-1",
						quantity: 2,
					}),
					input({
						itemId: "item:beam",
						quantity: 2,
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
		id: "item:blueprint-townhall-3",
		assetId: "asset:item-blueprint-townhall",
		code: "blueprint-townhall-3",
		name: "Town Hall 3 Blueprint",
		tier: 4,
		maxStackSize: 4,
		description:
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 247,
		behavior: {
			label: "3",
			craft: craft({
				id: "craft:townhall-3",
				resultItemId: "item:townhall-3",
				inputs: [
					input({
						itemId: "item:townhall-2",
						quantity: 2,
					}),
					input({
						itemId: "item:beam",
						quantity: 2,
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
		id: "item:blueprint-townhall-4",
		assetId: "asset:item-blueprint-townhall",
		code: "blueprint-townhall-4",
		name: "Town Hall 4 Blueprint",
		tier: 4,
		maxStackSize: 4,
		description:
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 248,
		behavior: {
			label: "4",
			craft: craft({
				id: "craft:townhall-4",
				resultItemId: "item:townhall-4",
				inputs: [
					input({
						itemId: "item:townhall-3",
						quantity: 2,
					}),
					input({
						itemId: "item:beam",
						quantity: 2,
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
		id: "item:blueprint-townhall-5",
		assetId: "asset:item-blueprint-townhall",
		code: "blueprint-townhall-5",
		name: "Town Hall 5 Blueprint",
		tier: 4,
		maxStackSize: 4,
		description:
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 249,
		behavior: {
			label: "5",
			craft: craft({
				id: "craft:townhall-5",
				resultItemId: "item:townhall-5",
				inputs: [
					input({
						itemId: "item:townhall-4",
						quantity: 2,
					}),
					input({
						itemId: "item:beam",
						quantity: 2,
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
