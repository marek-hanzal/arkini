import type { ItemDefinition } from "../../item";
import { item } from "../../dsl/item";
import { same } from "../../dsl/same";

export const CurrencyItemDefinitions = [
	item({
		id: "item:coin",
		assetId: "asset:item-coin",
		code: "coin",
		name: "Coin",
		tier: 1,
		maxStackSize: 50,
		description: "A small metal excuse for progression.",
		tags: [
			"currency",
		],
		sort: 180,
		behavior: {
			merge: [
				same({
					id: "merge:coin-coin-pair",
					selfItemId: "item:coin",
					resultItemId: "item:coin-pair",
				}),
			],
		},
	}),
	item({
		id: "item:coin-pair",
		assetId: "asset:item-coin-pair",
		code: "coin-pair",
		name: "Coin Pair",
		tier: 2,
		maxStackSize: 40,
		description: "Two coins. Somehow this already feels like accounting.",
		tags: [
			"currency",
		],
		sort: 182,
		behavior: {
			merge: [
				same({
					id: "merge:coin-pair-stack",
					selfItemId: "item:coin-pair",
					resultItemId: "item:coin-stack",
				}),
			],
		},
	}),
	item({
		id: "item:coin-stack",
		assetId: "asset:item-coin-stack",
		code: "coin-stack",
		name: "Coin Stack",
		tier: 3,
		maxStackSize: 30,
		description: "A stack of little reasons to open the upgrades sheet.",
		tags: [
			"currency",
		],
		sort: 184,
		behavior: {
			merge: [
				same({
					id: "merge:coin-stack-chest",
					selfItemId: "item:coin-stack",
					resultItemId: "item:coin-chest",
				}),
			],
		},
	}),
	item({
		id: "item:coin-chest",
		assetId: "asset:item-coin-chest",
		code: "coin-chest",
		name: "Coin Chest",
		tier: 4,
		maxStackSize: 20,
		description: "A boxed-up upgrade fund. Finally, clutter with ambition.",
		tags: [
			"currency",
		],
		sort: 186,
	}),
] satisfies ItemDefinition[];
