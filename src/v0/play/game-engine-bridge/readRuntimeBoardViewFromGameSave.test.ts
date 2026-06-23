import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInitialGameSaveFx } from "~/v0/game/save/createInitialGameSaveFx";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { readRuntimeBoardViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeBoardViewFromGameSave";

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));

describe("readRuntimeBoardViewFromGameSave", () => {
	it("marks producer product lines blocked until stored requirements are stocked", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			requirements: {
				...baseConfig.requirements,
				"requirement:producer-axe": {
					capacity: 1,
					itemId: "item:axe",
					quantity: 1,
					type: "stored",
				},
			},
			producers: {
				...baseConfig.producers,
				"producer:test": {
					...baseConfig.producers["producer:test"],
					requirementIds: [
						"requirement:producer-axe",
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const missingBoard = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		});
		const missingLine = missingBoard.byId["item-instance:1"]?.activation?.productLines?.find(
			(line) => line.productId === "product:test",
		);

		expect(missingLine).toMatchObject({
			missingRequirementItemIds: [
				"item:axe",
			],
			requirementsReady: false,
		});

		save.storedRequirements["item-instance:1"] = {
			items: {
				"item:axe": 1,
			},
		};
		const stockedBoard = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		});
		const stockedLine = stockedBoard.byId["item-instance:1"]?.activation?.productLines?.find(
			(line) => line.productId === "product:test",
		);

		expect(stockedLine).toMatchObject({
			missingRequirementItemIds: [],
			requirementsReady: true,
		});
	});

	it("shows proximity-adjusted producer product duration", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 3,
				},
			},
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig": {
					distance: 2,
					durationFactor: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
			},
			producers: {
				...baseConfig.producers,
				"producer:test": {
					...baseConfig.producers["producer:test"],
					requirementIds: [
						"requirement:near-twig",
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
		const line = board.byId["item-instance:1"]?.activation?.productLines?.find(
			(line) => line.productId === "product:test",
		);

		expect(line).toMatchObject({
			durationMs: 2000,
			requirements: [
				{
					durationMultiplier: 2,
					matchedDistance: 2,
					satisfied: true,
					type: "proximity",
				},
			],
		});
	});

	it("shows active producer product hindrances in the runtime view", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 3,
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					hinderedBy: [
						{
							distance: 2,
							durationFactor: 0.5,
							itemIds: [
								"item:twig",
							],
							type: "proximity",
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
						itemId: "item:twig",
						x: 1,
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
		const line = board.byId["item-instance:1"]?.activation?.productLines?.find(
			(line) => line.productId === "product:test",
		);

		expect(line).toMatchObject({
			durationMs: 3000,
			hindrances: [
				{
					durationMultiplier: 3,
					matches: [
						{
							distance: 1,
						},
						{
							distance: 2,
						},
					],
					type: "proximity",
				},
			],
		});
	});

	it("marks the saved producer product line as the default line", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerLines["item-instance:1"] = {
			defaultProductId: "product:shred",
		};

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		});

		expect(board.byId["item-instance:1"]?.activation?.productLines).toMatchObject([
			{
				isDefault: false,
				productId: "product:test",
			},
			{
				isDefault: true,
				productId: "product:shred",
			},
		]);
	});

	it("does not mark a producer product line as default until save selects one", () => {
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

		expect(board.byId["item-instance:1"]?.activation?.productLines).toMatchObject([
			{
				isDefault: false,
				productId: "product:test",
			},
			{
				isDefault: false,
				productId: "product:shred",
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
			completesAtMs: 1000,
			delivery: {
				items: [
					{
						itemId: "item:twig",
						quantity: 1,
					},
				],
				lastBlockedAtMs: 1000,
				retryAtMs: 2000,
			},
			id: "job:1",
			outputTableId: "loot:test",
			placement: "board_then_inventory",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			startedAtMs: 0,
		};

		const board = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 1500,
			save,
		});

		expect(board.byId["item-instance:1"]?.activation).toMatchObject({
			deliveryBlocked: true,
		});
	});

	it("shows partial craft input progress from persistent craft input state", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:craft-table": {
					assetId: "asset:test",
					code: "craft-table",
					craftRecipeId: "craft:plank",
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
					assetId: "asset:test",
					code: "craft-table",
					craftRecipeId: "craft:plank",
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

	it("marks craft inputs complete without auto-starting the craft", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:craft-table": {
					assetId: "asset:test",
					code: "craft-table",
					craftRecipeId: "craft:plank",
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
});
