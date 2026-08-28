import { Effect } from "effect";

import { useGameFx } from "~/engine/game/fx/useGameFx";

import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";

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
		inventory: {
			width: 2,
			height: 1,
		},
		toolbarSize: 1,
	},
	start: {
		currentSpace: 0,
	},
	items: {
		water: {
			uid: "water",
			id: "water",
			type: "simple",
			title: "Water",
			description: "Water",
			asset: {
				default: [
					"asset:water",
				],
			},
			scope: "any",
			maxStackSize: 10,
		},
		stone: {
			uid: "stone",
			id: "stone",
			type: "simple",
			title: "Stone",
			description: "Stone",
			asset: {
				default: [
					"asset:stone",
				],
			},
			scope: "any",
			maxStackSize: 10,
		},
		backpack: {
			uid: "backpack",
			id: "backpack",
			type: "inventory",
			title: "Backpack",
			description: "Backpack",
			asset: {
				default: [
					"asset:backpack",
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
			asset: {
				default: [
					"asset:mud",
				],
			},
		},
	},
});

export const invalidMergeResultScopeConfig = GameConfigSchema.parse({
	...replaceMergeConfig,
	meta: {
		...replaceMergeConfig.meta,
		id: "game:drop-item-invalid-merge-result-scope",
	},
	items: {
		...replaceMergeConfig.items,
		mud: {
			...replaceMergeConfig.items.mud,
			scope: "inventory",
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

export const inventoryOpenerLocation = {
	scope: "toolbar" as const,
	position: {
		x: 0,
		y: 0,
	},
};

export const spawnInventoryOpenerFx = () =>
	spawnItemFx({
		id: "runtime:backpack",
		itemId: "backpack",
		location: inventoryOpenerLocation,
		quantity: 1,
	});

export const run = <A, E, R>(
	effect: Effect.Effect<A, E, R>,
	gameConfig: GameConfigSchema.Type = config,
) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config: gameConfig,
			}),
		) as Effect.Effect<A, E, never>,
	);
