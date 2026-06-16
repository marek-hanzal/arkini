import type { ItemDefinition } from "../../../item";
import { craft } from "../../../dsl/craft";
import { input } from "../../../dsl/input";
import { item } from "../../../dsl/item";

export const QuarryBlueprintItemDefinitions = [
	item({
		id: "item:blueprint-quarry",
		assetId: "asset:item-blueprint-quarry",
		code: "blueprint-quarry",
		name: "Quarry Blueprint",
		tier: 4,
		maxStackSize: 5,
		description: "Finished plan. Now feed it materials until civilization happens.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 224,
		behavior: {
			craft: craft({
				id: "craft:quarry",
				resultItemId: "item:quarry-1",
				inputs: [
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
