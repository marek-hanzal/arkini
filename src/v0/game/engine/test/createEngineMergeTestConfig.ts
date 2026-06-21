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
		},
		merge: {
			...config.merge,
			"merge:water-twig-sprout": {
				resultItemId: "item:sprout",
				secret: true,
				withItemId: "item:twig",
			},
		},
	});
};
