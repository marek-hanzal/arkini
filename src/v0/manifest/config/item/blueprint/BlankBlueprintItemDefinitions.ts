import type { ItemDefinition } from "../../../item";
import { same } from "../../../dsl/same";
import { item } from "../../../dsl/item";

export const BlankBlueprintItemDefinitions = [
	item({
		id: "item:blueprint-scrap",
		assetId: "asset:item-blueprint-scrap",
		code: "blueprint-scrap",
		name: "Blueprint Scrap",
		tier: 1,
		maxStackSize: 20,
		description: "A torn blank construction note. Inspiring, in the way paperwork can be.",
		tags: [
			"blueprint",
			"fragment",
		],
		sort: 200,
		behavior: {
			merge: [
				same({
					id: "merge:blueprint-scrap-fragment",
					selfItemId: "item:blueprint-scrap",
					resultItemId: "item:blueprint-fragment",
				}),
			],
		},
	}),
	item({
		id: "item:blueprint-fragment",
		assetId: "asset:item-blueprint-fragment",
		code: "blueprint-fragment",
		name: "Blueprint Fragment",
		tier: 2,
		maxStackSize: 15,
		description: "A bigger blank plan piece. Still technically a mess, but taller.",
		tags: [
			"blueprint",
			"fragment",
		],
		sort: 201,
		behavior: {
			merge: [
				same({
					id: "merge:blueprint-fragment-draft",
					selfItemId: "item:blueprint-fragment",
					resultItemId: "item:blueprint-draft",
				}),
			],
		},
	}),
	item({
		id: "item:blueprint-draft",
		assetId: "asset:item-blueprint-draft",
		code: "blueprint-draft",
		name: "Blueprint Draft",
		tier: 3,
		maxStackSize: 10,
		description: "A nearly usable blank plan. Construction bureaucracy is blooming.",
		tags: [
			"blueprint",
			"fragment",
		],
		sort: 202,
		behavior: {
			merge: [
				same({
					id: "merge:blueprint-draft-final",
					selfItemId: "item:blueprint-draft",
					resultItemId: "item:blueprint",
				}),
			],
		},
	}),
	item({
		id: "item:blueprint",
		assetId: "asset:item-blueprint",
		code: "blueprint",
		name: "Blank Blueprint",
		tier: 4,
		maxStackSize: 5,
		description:
			"A finished blank plan. Drag a known build target onto it to burn in the idea without sacrificing the original.",
		tags: [
			"blueprint",
			"blank",
		],
		sort: 203,
	}),
] satisfies ItemDefinition[];
