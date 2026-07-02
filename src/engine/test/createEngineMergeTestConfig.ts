import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";

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
				merges: [
					{
						resultItemId: "item:sprout",
						secret: true,
						withItemId: "item:twig",
					},
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
	});
};
