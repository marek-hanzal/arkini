import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";

export interface CreateEngineCraftTableTestConfigProps {
	readonly boardItemCount?: number;
	readonly noRecipeInputs?: boolean;
}

export const createEngineCraftTableTestConfig = ({
	boardItemCount = 1,
	noRecipeInputs = true,
}: CreateEngineCraftTableTestConfigProps = {}) => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		game: {
			...baseConfig.game,
			board: {
				height: baseConfig.game.board.height,
				width: Math.max(baseConfig.game.board.width, boardItemCount),
			},
		},
		items: {
			...baseConfig.items,
			"item:craft-table": {
				assetIds: [
					"asset:test",
				],
				craft: {
					durationMs: 1_000,
					inputs: noRecipeInputs
						? []
						: [
								{
									consume: true,
									itemId: "item:twig",
									quantity: 2,
								},
							],
					resultItemId: "item:plank",
				},
				description: "Craft table",
				maxStackSize: 1,
				name: "Craft Table",
				storage: "both",
				tags: [],
				tier: 0,
			},
		},
		startingState: {
			board: Array.from(
				{
					length: boardItemCount,
				},
				(_, index) => ({
					itemId: "item:craft-table",
					x: index,
					y: 0,
				}),
			),
			inventory: [],
		},
	});
};
