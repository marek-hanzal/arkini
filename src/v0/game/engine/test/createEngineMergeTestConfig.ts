import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";

export const createEngineMergeTestConfig = () => {
	const config = createEngineTestConfig();

	return createEngineTestConfig({
		items: {
			...config.items,
			"item:water": {
				assetId: "asset:test",
				code: "water",
				description: "Water",
				maxStackSize: 3,
				mergeIds: [
					"merge:water-twig-sprout",
				],
				name: "Water",
				sort: 8,
				storage: "both",
				tags: [],
				tier: 0,
			},
			"item:sprout": {
				assetId: "asset:test",
				code: "sprout",
				description: "Sprout",
				maxStackSize: 3,
				name: "Sprout",
				sort: 9,
				storage: "both",
				tags: [],
				tier: 1,
			},
			"item:blueprint": {
				assetId: "asset:test",
				code: "blueprint",
				description: "Blueprint",
				maxStackSize: 3,
				name: "Blueprint",
				sort: 10,
				storage: "both",
				tags: [],
				tier: 0,
			},
			"item:lumber-camp-1": {
				assetId: "asset:test",
				code: "lumber-camp-1",
				description: "Lumber Camp I",
				maxStackSize: 1,
				mergeIds: [
					"merge:lumber-camp-blueprint-imprint",
				],
				name: "Lumber Camp I",
				sort: 11,
				storage: "both",
				tags: [],
				tier: 1,
			},
			"item:blueprint-lumber-camp": {
				assetId: "asset:test",
				code: "blueprint-lumber-camp",
				description: "Lumber Camp Blueprint",
				maxStackSize: 1,
				name: "Lumber Camp Blueprint",
				sort: 12,
				storage: "both",
				tags: [],
				tier: 1,
			},
		},
		merge: {
			...config.merge,
			"merge:lumber-camp-blueprint-imprint": {
				consumeSource: false,
				resultItemId: "item:blueprint-lumber-camp",
				secret: true,
				withItemId: "item:blueprint",
			},
			"merge:water-twig-sprout": {
				resultItemId: "item:sprout",
				secret: true,
				withItemId: "item:twig",
			},
		},
	});
};
