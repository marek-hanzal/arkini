import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";

export const createEngineMergeTestConfig = () => {
	const config = createEngineTestConfig();

	return createEngineTestConfig({
		items: {
			...config.items,
			"item:water": {
				assetIds: [
					"asset:test",
				],
				description: "Water",
				maxStackSize: 3,
				mergeIds: [
					"merge:water-twig-sprout",
				],
				name: "Water",
				storage: "both",
				tags: [],
				tier: 0,
			},
			"item:sprout": {
				assetIds: [
					"asset:test",
				],
				description: "Sprout",
				maxStackSize: 3,
				name: "Sprout",
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
