import type { ItemDefinition } from "../../../item";
import { item } from "../../../dsl/item";

export const UtilityMaterialItemDefinitions = [
	item({
		id: "item:water",
		assetId: "asset:item-water",
		code: "water",
		name: "Water",
		tier: 1,
		maxStackSize: 50,
		description: "Liquid logistics. Somehow still your problem.",
		tags: [
			"material",
			"water",
		],
		sort: 100,
	}),
	item({
		id: "item:coal",
		assetId: "asset:item-coal",
		code: "coal",
		name: "Coal",
		tier: 2,
		maxStackSize: 40,
		description: "Black fuel for machines that apparently need motivation.",
		tags: [
			"material",
			"fuel",
		],
		sort: 105,
	}),
	item({
		id: "item:sausage",
		assetId: "asset:item-sausage",
		code: "sausage",
		name: "Sausage",
		tier: 1,
		maxStackSize: 30,
		description: "Producer fuel, because workers are tragically organic.",
		tags: [
			"material",
			"food",
		],
		sort: 106,
	}),
	item({
		id: "item:beer",
		assetId: "asset:item-beer",
		code: "beer",
		name: "Beer",
		tier: 1,
		maxStackSize: 30,
		description: "Liquid morale. The economy is clearly fine.",
		tags: [
			"material",
			"drink",
		],
		sort: 107,
	}),
] satisfies ItemDefinition[];
