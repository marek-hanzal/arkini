import type { ItemDefinition } from "../../../item";
import { craft } from "../../../dsl/craft";
import { input } from "../../../dsl/input";
import { item } from "../../../dsl/item";

export const LumberCampBlueprintItemDefinitions = [
	item({
		id: "item:blueprint-lumber-camp",
		assetId: "asset:item-blueprint-lumber-camp",
		code: "blueprint-lumber-camp",
		name: "Lumber Camp Blueprint",
		tier: 4,
		maxStackSize: 5,
		description: "Finished plan. Now feed it materials until civilization happens.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 204,
		behavior: {
			craft: craft({
				id: "craft:lumber-camp",
				resultItemId: "item:lumber-camp-1",
				inputs: [
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
