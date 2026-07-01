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
				label: "Test",
				render: "plain",
				resourceId: "resource:test",
			},
		},
		items: {
			"item:producer": {
				assetIds: [
					"asset:test",
				],
				description: "Producer",
				maxStackSize: 1,
				name: "Producer",
				tags: [],
				tier: 0,
			},
			"item:twig": {
				assetIds: [
					"asset:test",
				],
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
				assetIds: [
					"asset:test",
				],
				description: "Plank",
				maxStackSize: 2,
				name: "Plank",
				tags: [],
				tier: 1,
			},
			"item:craft-table": {
				assetIds: [
					"asset:test",
				],
				description: "Craft table",
				maxStackSize: 1,
				name: "Craft Table",
				tags: [],
				tier: 0,
			},
			"item:key": {
				assetIds: [
					"asset:test",
				],
				description: "Key",
				maxStackSize: 3,
				name: "Key",
				tags: [],
				tier: 0,
			},
			"item:stash": {
				assetIds: [
					"asset:test",
				],
				description: "Stash",
				maxStackSize: 1,
				name: "Stash",
				tags: [],
				tier: 0,
			},
			"item:axe": {
				assetIds: [
					"asset:test",
				],
				description: "Axe",
				maxStackSize: 1,
				name: "Axe",
				tags: [],
				tier: 0,
			},
			"item:rock": {
				assetIds: [
					"asset:test",
				],
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
				assetIds: [
					"asset:test",
				],
				description: "Empty stash",
				maxStackSize: 1,
				name: "Empty Stash",
				tags: [],
				tier: 0,
			},
		},
		effects: {},
		merge: {
			"merge:twig-plank": {
				resultItemId: "item:plank",
				withItemId: "item:twig",
			},
		},
		producers: {
			"item:producer": {
				maxQueueSize: 1,
				productIds: [
					"product:test",
					"product:shred",
				],
			},
		},
		products: {
			"product:test": {
				durationMs: 1000,
				name: "Test product",
				output: [
					{
						itemId: "item:twig",
						quantity: 2,
						type: "guaranteed",
					},
				],
				placement: "board_then_inventory",
			},
			"product:stash": {
				chargeCost: 1,
				durationMs: 0,
				inputs: [
					{
						capacity: 1,
						consume: true,
						itemId: "item:key",
						quantity: 1,
					},
				],
				name: "Open stash",
				output: [
					{
						itemId: "item:twig",
						quantity: 2,
						type: "guaranteed",
					},
				],
				placement: "board_then_inventory",
			},
			"product:shred": {
				durationMs: 1000,
				inputs: [
					{
						capacity: 1,
						consume: true,
						itemId: "item:twig",
						quantity: 1,
					},
				],
				name: "Shred",
				placement: "board_then_inventory",
			},
		},
		stashes: {
			"item:stash": {
				charges: 1,
				maxQueueSize: 1,
				onChargesDepleted: "remove",
				productIds: [
					"product:stash",
				],
			},
		},
		craftRecipes: {
			"item:craft-table": {
				durationMs: 1000,
				inputs: [
					{
						consume: true,
						itemId: "item:twig",
						quantity: 2,
					},
				],
				resultItemId: "item:plank",
			},
		},
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
