import type { GameConfig } from "~/config/GameConfigTypes";
import { createGameplayItemSource } from "~/config/validation/createGameplaySoftLockSource";

const createStartingBoardGameplaySources = (config: GameConfig) =>
	config.startingState.board.map((entry, index) =>
		createGameplayItemSource({
			label: `starting board slot ${index}`,
			path: [
				"startingState",
				"board",
				index,
				"itemId",
			],
			requirements: [],
			sourceId: `starting:board:${index}:${entry.itemId}`,
			targetId: entry.itemId,
		}),
	);

const createStartingInventoryGameplaySources = (config: GameConfig) =>
	config.startingState.inventory.map((entry, index) =>
		createGameplayItemSource({
			label: `starting inventory stack ${index}`,
			path: [
				"startingState",
				"inventory",
				index,
				"itemId",
			],
			requirements: [],
			sourceId: `starting:inventory:${index}:${entry.itemId}`,
			targetId: entry.itemId,
		}),
	);

export const createStartingGameplaySources = (config: GameConfig) => [
	...createStartingBoardGameplaySources(config),
	...createStartingInventoryGameplaySources(config),
];
