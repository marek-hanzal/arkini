import { parseGameConfig, type GameConfig } from "~/v0/game/config/GameConfigSchema";

export const createEngineTestConfig = (overrides: Partial<GameConfig> = {}) =>
	parseGameConfig({
		version: 1,
		game: {
			id: "game:test",
			title: "Test",
			board: {
				width: 2,
				height: 1,
			},
			inventory: {
				slots: 2,
			},
		},
		resources: {
			"resource:test": {
				data: "x",
			},
		},
		assets: {
			"asset:test": {
				kind: "item",
				label: "Test",
				render: "plain",
				resourceId: "resource:test",
			},
		},
		items: {
			"item:producer": {
				assetId: "asset:test",
				code: "producer",
				description: "Producer",
				maxStackSize: 1,
				name: "Producer",
				producerId: "producer:test",
				tags: [],
				tier: 0,
			},
			"item:twig": {
				assetId: "asset:test",
				code: "twig",
				description: "Twig",
				maxStackSize: 3,
				mergeIds: [
					"merge:twig-plank",
				],
				name: "Twig",
				tags: [],
				tier: 0,
			},
			"item:plank": {
				assetId: "asset:test",
				code: "plank",
				description: "Plank",
				maxStackSize: 2,
				name: "Plank",
				tags: [],
				tier: 1,
			},
			"item:key": {
				assetId: "asset:test",
				code: "key",
				description: "Key",
				maxStackSize: 3,
				name: "Key",
				tags: [],
				tier: 0,
			},
			"item:stash": {
				assetId: "asset:test",
				code: "stash",
				description: "Stash",
				maxStackSize: 1,
				name: "Stash",
				stashId: "stash:test",
				tags: [],
				tier: 0,
			},
			"item:axe": {
				assetId: "asset:test",
				code: "axe",
				description: "Axe",
				maxStackSize: 1,
				name: "Axe",
				tags: [],
				tier: 0,
			},
			"item:rock": {
				assetId: "asset:test",
				code: "rock",
				description: "Rock",
				maxStackSize: 1,
				name: "Rock",
				removeBy: [
					{
						itemId: "item:axe",
						mode: "keep",
					},
				],
				tags: [],
				tier: 0,
			},
			"item:empty-stash": {
				assetId: "asset:test",
				code: "empty-stash",
				description: "Empty stash",
				maxStackSize: 1,
				name: "Empty Stash",
				tags: [],
				tier: 0,
			},
		},
		requirements: {},
		merge: {
			"merge:twig-plank": {
				resultItemId: "item:plank",
				withItemId: "item:twig",
			},
		},
		inputs: {
			"input:shred": {
				name: "Shred input",
				inputs: [
					{
						capacity: 1,
						consume: true,
						itemId: "item:twig",
						quantity: 1,
					},
				],
			},
		},
		producers: {
			"producer:test": {
				maxQueueSize: 1,
				productIds: [
					"product:test",
					"product:shred",
				],
				requirementIds: [],
				type: "producer",
			},
		},
		products: {
			"product:test": {
				durationMs: 1000,
				name: "Test product",
				outputTableId: "loot:test",
				placement: "board_then_inventory",
				requirementIds: [],
			},
			"product:shred": {
				durationMs: 1000,
				inputRefId: "input:shred",
				name: "Shred",
				placement: "board_then_inventory",
				requirementIds: [],
			},
		},
		stashes: {
			"stash:test": {
				charges: 1,
				inputs: [
					{
						capacity: 1,
						consume: true,
						itemId: "item:key",
						quantity: 1,
					},
				],
				onDepleted: "remove",
				outputTableId: "loot:test",
				placement: "board_then_inventory",
				requirements: [],
				type: "stash",
			},
		},
		craftRecipes: {
			"craft:plank": {
				durationMs: 1000,
				inputs: [
					{
						consume: true,
						itemId: "item:twig",
						quantity: 2,
					},
				],
				requirements: [],
				resultItemId: "item:plank",
			},
		},
		lootTables: {
			"loot:test": {
				name: "Test loot",
				output: [
					{
						itemId: "item:twig",
						quantity: 2,
						type: "guaranteed",
					},
				],
			},
		},
		upgrades: {},
		startingState: {
			board: [
				{
					itemId: "item:producer",
					x: 0,
					y: 0,
				},
			],
			inventory: [],
		},
		...overrides,
	});
