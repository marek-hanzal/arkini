import type { ItemDefinition } from "../../../item";
import { item } from "../../../dsl/item";

export const KeyItemDefinitions = [
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
] satisfies ItemDefinition[];
