import { Effect, type Layer } from "effect";

import { useGameFx } from "~test/support/useGameFx";
import type { GameLayerFx } from "~test/support/GameLayerFx";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

export const configInput = {
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:drop-item",
		title: "Drop item",
		board: {
			width: 3,
			height: 2,
		},
	},
	start: {
		currentSpace: 0,
	},
	items: {
		water: {
			maxQueueSize: 1,
			lines: [],

			uid: "water",
			id: "water",

			title: "Water",
			description: "Water",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:water",
				],
			},
		},
		stone: {
			maxQueueSize: 1,
			lines: [],

			uid: "stone",
			id: "stone",

			title: "Stone",
			description: "Stone",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:stone",
				],
			},
		},
	},
} as const;

export const config = GameConfigSchema.parse(configInput);

export const mergeConfig = GameConfigSchema.parse({
	...configInput,
	meta: {
		...configInput.meta,
		id: "game:drop-item-merge",
	},
	items: {
		...configInput.items,
		water: {
			...configInput.items.water,
			merge: [
				{
					target: {
						type: "item",
						itemId: "stone",
					},
					action: "consume",
					effect: "keep",
				},
			],
		},
	},
});

export const removeMergeConfig = GameConfigSchema.parse({
	...configInput,
	meta: {
		...configInput.meta,
		id: "game:drop-item-remove-merge",
	},
	items: {
		...configInput.items,
		water: {
			...configInput.items.water,
			merge: [
				{
					target: {
						type: "item",
						itemId: "stone",
					},
					action: "consume",
					effect: "remove",
				},
			],
		},
	},
});

export const replaceMergeConfig = GameConfigSchema.parse({
	...configInput,
	meta: {
		...configInput.meta,
		id: "game:drop-item-replace-merge",
	},
	items: {
		...configInput.items,
		water: {
			...configInput.items.water,
			merge: [
				{
					target: {
						type: "item",
						itemId: "stone",
					},
					action: "consume",
					effect: "replace",
					result: "mud",
				},
			],
		},
		mud: {
			...configInput.items.stone,
			uid: "mud",
			id: "mud",
			title: "Mud",
			description: "Mud",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:mud",
				],
			},
		},
	},
});

export const sourceLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

export const emptyLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 2,
		y: 1,
	},
};

export const occupiedLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 1,
		y: 0,
	},
};

export const run = <A, E>(
	effect: Effect.Effect<A, E, Layer.Success<ReturnType<typeof GameLayerFx>>>,
	gameConfig: GameConfigSchema.Type = config,
) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config: gameConfig,
			}),
		),
	);
