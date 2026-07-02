import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInitialGameSaveFx } from "~/v0/game/save/createInitialGameSaveFx";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { readRuntimeBoardViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeBoardViewFromGameSave";

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));

describe("readRuntimeBoardViewFromGameSave", () => {
	it("derives first empty cell from the runtime config board dimensions", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 2,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		expect(
			readRuntimeBoardViewFromGameSave({
				config,
				nowMs: 0,
				save,
			}).firstEmptyCell,
		).toBeUndefined();
	});

	it("shows craft target limits on blueprint-like board items", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 2,
				},
			},
			items: {
				...baseConfig.items,
				"item:plank": {
					...baseConfig.items["item:plank"],
					maxCount: 1,
				},
			},
			craftOverrides: {
				...baseConfig.craftCatalog,
				"item:craft-table": {
					...baseConfig.craftCatalog["item:craft-table"],
					inputs: [],
					resultItemId: "item:plank",
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:craft-table",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:plank",
						x: 1,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const craftItem = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		}).byId["item-instance:1"];

		expect(craftItem?.craft).toMatchObject({
			targetLimitBlocked: true,
			targetLimits: [
				{
					itemId: "item:plank",
					maxCount: 1,
					ownedQuantity: 1,
					remainingQuantity: 0,
					requiredQuantity: 1,
				},
			],
		});
	});

	it("shows producer output target limits through blueprint craft results", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 2,
				},
			},
			items: {
				...baseConfig.items,
				"item:plank": {
					...baseConfig.items["item:plank"],
					maxCount: 1,
				},
				"item:blueprint-plank": {
					assetIds: [
						"asset:test",
					],
					description: "Plank blueprint",
					maxStackSize: 1,
					storage: "both",
					name: "Plank Blueprint",
					tags: [
						"blueprint",
					],
					tier: 0,
				},
			},
			craftOverrides: {
				...baseConfig.craftCatalog,
				"item:blueprint-plank": {
					durationMs: 0,
					inputs: [],
					resultItemId: "item:plank",
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							itemId: "item:blueprint-plank",
							quantity: 1,
							type: "guaranteed",
						},
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:plank",
						x: 1,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const producer = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		}).byId["item-instance:1"];

		expect(producer?.activation?.producerLines?.[0]).toMatchObject({
			outputLimitBlocked: true,
			targetLimits: [
				{
					itemId: "item:plank",
					maxCount: 1,
					ownedQuantity: 1,
					remainingQuantity: 0,
					requiredQuantity: 1,
					sourceItemId: "item:blueprint-plank",
				},
			],
		});
	});

	it("counts owned blueprint items against inherited producer output target limits", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 2,
				},
			},
			items: {
				...baseConfig.items,
				"item:plank": {
					...baseConfig.items["item:plank"],
					maxCount: 1,
				},
				"item:blueprint-plank": {
					assetIds: [
						"asset:test",
					],
					description: "Plank blueprint",
					maxStackSize: 3,
					storage: "both",
					name: "Plank Blueprint",
					tags: [
						"blueprint",
					],
					tier: 0,
				},
			},
			craftOverrides: {
				...baseConfig.craftCatalog,
				"item:blueprint-plank": {
					durationMs: 0,
					inputs: [],
					resultItemId: "item:plank",
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							itemId: "item:blueprint-plank",
							quantity: 1,
							type: "guaranteed",
						},
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:blueprint-plank",
						x: 1,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const producer = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		}).byId["item-instance:1"];

		expect(producer?.activation?.producerLines?.[0]).toMatchObject({
			outputLimitBlocked: true,
			targetLimits: [
				{
					itemId: "item:plank",
					maxCount: 1,
					ownedQuantity: 1,
					remainingQuantity: 0,
					requiredQuantity: 1,
					sourceItemId: "item:blueprint-plank",
				},
			],
		});
	});

	it("counts inventory blueprint items against inherited producer output target limits", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:plank": {
					...baseConfig.items["item:plank"],
					maxCount: 1,
				},
				"item:blueprint-plank": {
					assetIds: [
						"asset:test",
					],
					description: "Plank blueprint",
					maxStackSize: 3,
					storage: "both",
					name: "Plank Blueprint",
					tags: [
						"blueprint",
					],
					tier: 0,
				},
			},
			craftOverrides: {
				...baseConfig.craftCatalog,
				"item:blueprint-plank": {
					durationMs: 0,
					inputs: [],
					resultItemId: "item:plank",
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							itemId: "item:blueprint-plank",
							quantity: 1,
							type: "guaranteed",
						},
					],
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
				inventory: [
					{
						itemId: "item:blueprint-plank",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const producer = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		}).byId["item-instance:1"];

		expect(producer?.activation?.producerLines?.[0]).toMatchObject({
			outputLimitBlocked: true,
			targetLimits: [
				{
					itemId: "item:plank",
					maxCount: 1,
					ownedQuantity: 1,
					remainingQuantity: 0,
					requiredQuantity: 1,
					sourceItemId: "item:blueprint-plank",
				},
			],
		});
	});

	it("counts owned product outputs across board and inventory", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 2,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "item:twig",
						quantity: 2,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		});

		expect(
			board.byId["item-instance:1"]?.activation?.producerLines?.find(
				(line) => line.lineId === "line:test",
			),
		).toMatchObject({
			outputs: [
				{
					itemId: "item:twig",
					ownedQuantity: 3,
				},
			],
		});
	});

	it("shows local product grants as gates without duration mutation", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 3,
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 2,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		});
		const line = board.byId["item-instance:1"]?.activation?.producerLines?.find(
			(line) => line.lineId === "line:test",
		);

		expect(line).toMatchObject({
			durationMs: 1000,
		});
	});

	it("marks the saved producer producer line as the default line", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerLines["item-instance:1"] = {
			defaultLineId: "line:shred",
		};

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		});

		expect(board.byId["item-instance:1"]?.activation?.producerLines).toMatchObject([
			{
				isDefault: false,
				lineId: "line:test",
			},
			{
				isDefault: true,
				lineId: "line:shred",
			},
		]);
	});

	it("does not mark a producer producer line as default until save selects one", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		});

		expect(board.byId["item-instance:1"]?.activation?.producerLines).toMatchObject([
			{
				isDefault: false,
				lineId: "line:test",
			},
			{
				isDefault: false,
				lineId: "line:shred",
			},
		]);
	});

	it("marks producer activation danger when delivery is blocked", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:1"] = {
			readyAtMs: 1000,
			delivery: {
				lastBlockedAtMs: 1000,
				nextAttemptAtMs: 2000,
			},
			id: "job:1",
			producerItemInstanceId: "item-instance:1",
			lineId: "line:test",
			startAtMs: 0,
		};

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 1500,
			save,
		});

		const activation = board.byId["item-instance:1"]?.activation;
		expect(activation).toMatchObject({
			deliveryBlocked: true,
		});
		expect(
			activation?.producerLines?.find((line) => line.lineId === "line:test"),
		).toMatchObject({
			deliveryBlocked: true,
			progress: undefined,
		});
	});

	it("shows partial craft input progress from persistent craft input state", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:craft-table": {
					assetIds: [
						"asset:test",
					],
					description: "Craft table",
					maxStackSize: 1,
					name: "Craft Table",
					storage: "both",
					tags: [],
					tier: 0,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:craft-table",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftInputs["item-instance:1"] = {
			items: {
				"item:twig": 1,
			},
		};

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		});

		expect(board.byId["item-instance:1"]?.craft).toMatchObject({
			acceptedInputItemIds: [
				"item:twig",
			],
			canAcceptInputs: true,
			delivered: {
				"item:twig": 1,
			},
			inputProgress: 0.5,
			inputs: [
				{
					available: 0,
					itemId: "item:twig",
					quantity: 2,
				},
			],
			phase: "collecting_inputs",
			progress: 0.5,
		});
	});

	it("freezes paused craft progress in the runtime view", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:craft-table": {
					assetIds: [
						"asset:test",
					],
					description: "Craft table",
					maxStackSize: 1,
					name: "Craft Table",
					storage: "both",
					tags: [],
					tier: 0,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:craft-table",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftJobs["job:craft"] = {
			id: "job:craft",
			pausedAtMs: 250,
			readyAtMs: 1000,
			recipeId: "item:craft-table",
			remainingMs: 750,
			startAtMs: 0,
			targetItemInstanceId: "item-instance:1",
		};

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 900,
			save,
		});

		expect(board.byId["item-instance:1"]?.craft).toMatchObject({
			complete: false,
			pausedAtMs: 250,
			phase: "paused",
			progress: 0.25,
			remainingMs: 750,
			timeProgress: 0.25,
		});
	});

	it("marks blocked craft delivery without exposing it as ready", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:craft-table": {
					assetIds: [
						"asset:test",
					],
					description: "Craft table",
					maxStackSize: 1,
					name: "Craft Table",
					storage: "both",
					tags: [],
					tier: 0,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:craft-table",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftJobs["job:craft"] = {
			delivery: {
				lastBlockedAtMs: 1000,
				nextAttemptAtMs: 2000,
			},
			id: "job:craft",
			readyAtMs: 1000,
			recipeId: "item:craft-table",
			startAtMs: 0,
			targetItemInstanceId: "item-instance:1",
		};

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 1500,
			save,
		});

		expect(board.byId["item-instance:1"]?.craft).toMatchObject({
			complete: false,
			deliveryBlocked: true,
			phase: "delivery_blocked",
			progress: 0,
			timeProgress: 1,
		});
	});

	it("shows craft local grants as gates without duration mutation", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 3,
				},
			},
			craftOverrides: {
				...baseConfig.craftCatalog,
				"item:craft-table": {
					...baseConfig.craftCatalog["item:craft-table"],
				},
			},
			items: {
				...baseConfig.items,
				"item:craft-table": {
					assetIds: [
						"asset:test",
					],
					description: "Craft table",
					maxStackSize: 1,
					name: "Craft Table",
					storage: "both",
					tags: [],
					tier: 0,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:craft-table",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:rock",
						x: 2,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		});

		expect(board.byId["item-instance:1"]?.craft).toMatchObject({
			durationMs: 1000,
		});
	});

	it("shows available craft input resources from board and inventory", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 2,
				},
			},
			items: {
				...baseConfig.items,
				"item:craft-table": {
					assetIds: [
						"asset:test",
					],
					description: "Craft table",
					maxStackSize: 1,
					name: "Craft Table",
					storage: "both",
					tags: [],
					tier: 0,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:craft-table",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "item:twig",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		});

		expect(board.byId["item-instance:1"]?.craft?.inputs).toMatchObject([
			{
				available: 2,
				itemId: "item:twig",
				quantity: 2,
			},
		]);
	});

	it("shows available stash input resources from board and inventory", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 2,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:stash",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:key",
						x: 1,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "item:key",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		});

		expect(board.byId["item-instance:1"]?.activation?.inputs).toMatchObject([
			{
				available: 2,
				itemId: "item:key",
				quantity: 1,
			},
		]);
	});

	it("exposes stash producer-line progress through the shared product-line view", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:stash": {
					...baseConfig.lineCatalog["line:stash"],
					durationMs: 1000,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:stash",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:stash"] = {
			id: "job:stash",
			producerItemInstanceId: "item-instance:1",
			lineId: "line:stash",
			readyAtMs: 1000,
			startAtMs: 0,
		};

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 500,
			save,
		});

		expect(board.byId["item-instance:1"]?.activation).toMatchObject({
			kind: "stash",
			producerLines: [
				{
					inProgress: true,
					isDefault: false,
					lineId: "line:stash",
					progress: 0.5,
					readyAtMs: 1000,
					startAtMs: 0,
				},
			],
		});
	});

	it("marks stash activation danger when delivery is blocked", () => {
		const config = createEngineTestConfig({
			startingState: {
				board: [
					{
						itemId: "item:stash",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:stash-blocked"] = {
			delivery: {
				lastBlockedAtMs: 1000,
				nextAttemptAtMs: 2000,
			},
			id: "job:stash-blocked",
			producerItemInstanceId: "item-instance:1",
			lineId: "line:stash",
			readyAtMs: 1000,
			startAtMs: 0,
		};

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 1500,
			save,
		});

		expect(board.byId["item-instance:1"]?.activation).toMatchObject({
			deliveryBlocked: true,
			kind: "stash",
			producerLines: [
				{
					deliveryBlocked: true,
					lineId: "line:stash",
					progress: undefined,
				},
			],
		});
	});

	it("marks craft inputs complete without auto-starting the craft", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:craft-table": {
					assetIds: [
						"asset:test",
					],
					description: "Craft table",
					maxStackSize: 1,
					name: "Craft Table",
					storage: "both",
					tags: [],
					tier: 0,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:craft-table",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftInputs["item-instance:1"] = {
			items: {
				"item:twig": 2,
			},
		};

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		});

		expect(board.byId["item-instance:1"]?.craft).toMatchObject({
			acceptedInputItemIds: [],
			canAcceptInputs: false,
			complete: false,
			inputProgress: 1,
			phase: "collecting_inputs",
			progress: 1,
		});
	});

	it("does not leak hidden stash product drops or inputs", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:stash": {
					...baseConfig.lineCatalog["line:stash"],
					visibility: "hidden",
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:stash",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		});

		expect(board.byId["item-instance:1"]?.activation).toMatchObject({
			drops: undefined,
			inputs: [],
			producerLines: [],
		});
	});

	it("shows stash drop previews with probabilities", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:stash": {
					...baseConfig.lineCatalog["line:stash"],
					output: [
						{
							itemId: "item:twig",
							quantity: {
								min: 1,
								max: 3,
							},
							type: "guaranteed",
						},
						{
							chance: 0.25,
							itemId: "item:plank",
							quantity: 1,
							type: "chance",
						},
						{
							entries: [
								{
									itemId: "item:axe",
									quantity: 1,
									weight: 1,
								},
								{
									itemId: "item:key",
									quantity: 2,
									weight: 3,
								},
							],
							rolls: 2,
							type: "weighted",
						},
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:stash",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		});

		expect(board.byId["item-instance:1"]?.activation?.drops).toMatchObject([
			{
				chanceLabel: "100%",
				itemId: "item:twig",
				quantityLabel: "1-3",
			},
			{
				chanceLabel: "25%",
				itemId: "item:plank",
				quantityLabel: "1",
			},
			{
				chanceLabel: "25%/roll",
				itemId: "item:axe",
				quantityLabel: "1",
				rollLabel: "2 rolls",
			},
			{
				chanceLabel: "75%/roll",
				itemId: "item:key",
				quantityLabel: "2",
				rollLabel: "2 rolls",
			},
		]);
	});
});
