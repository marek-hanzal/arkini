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

	it("marks the saved producer product line as the default line", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerLines["item-instance:1"] = {
			defaultProductId: "product:shred",
			disabledProductIds: [],
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

	it("marks the first producer product line as the default line", () => {
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
				isDefault: true,
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
					sort: 8,
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
			phase: "collecting_inputs",
			progress: 0.5,
		});
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
					sort: 8,
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
