import type { ItemDefinition } from "../../../item";
import { craft } from "../../../dsl/craft";
import { input } from "../../../dsl/input";
import { item } from "../../../dsl/item";

export const TownhallBlueprintItemDefinitions = [
	item({
		id: "item:blueprint-townhall",
		assetId: "asset:item-blueprint-townhall",
		code: "blueprint-townhall",
		name: "Town Hall Blueprint",
		tier: 4,
		maxStackSize: 5,
		description: "Finished plan. Now feed it materials until civilization happens.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 244,
		behavior: {
			craft: craft({
				id: "craft:townhall",
				resultItemId: "item:townhall-1",
				inputs: [
					input({
						itemId: "item:beam",
						quantity: 1,
					}),
					input({
						itemId: "item:stone-block",
						quantity: 2,
					}),
					input({
						itemId: "item:gem",
						quantity: 1,
					}),
				],
			}),
		},
	}),
] satisfies ItemDefinition[];
