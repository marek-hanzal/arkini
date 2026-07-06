import { describe, expect, it } from "vitest";
import { createEngineCraftTableTestConfig } from "~/engine/test/createEngineCraftTableTestConfig";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import {
	findBoardItem,
	readOnlyRecordValue,
	runAction,
	runActionEither,
	runInitialSave,
} from "~/engine/applyGameActionFx.testSupport";

describe("applyGameActionFx BoardInventory", () => {
	it("moves a board item inside the runtime save", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.move",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result.save.board.items["item-instance:1"]).toMatchObject({
			x: 1,
			y: 0,
		});
	});

	it("moves a board item with a running craft job", () => {
		const config = createEngineCraftTableTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			recipeId: "item:craft-table",
			startAtMs: 0,
			targetItemInstanceId: "item-instance:1",
		};

		const result = runAction({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.move",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result.save.board.items["item-instance:1"]).toMatchObject({
			x: 1,
			y: 0,
		});
		expect(readOnlyRecordValue(result.save.craftJobs)).toMatchObject({
			targetItemInstanceId: "item-instance:1",
		});
	});

	it("swaps a board item with a running craft job", () => {
		const config = createEngineCraftTableTestConfig({
			boardItemCount: 2,
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			recipeId: "item:craft-table",
			startAtMs: 0,
			targetItemInstanceId: "item-instance:1",
		};

		const result = runAction({
			action: {
				sourceBoardItemId: "item-instance:1",
				targetBoardItemId: "item-instance:2",
				type: "board.items.swap",
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result.save.board.items["item-instance:1"]).toMatchObject({
			x: 1,
			y: 0,
		});
		expect(result.save.board.items["item-instance:2"]).toMatchObject({
			x: 0,
			y: 0,
		});
		expect(readOnlyRecordValue(result.save.craftJobs)).toMatchObject({
			targetItemInstanceId: "item-instance:1",
		});
	});

	it("rejects same-id board swaps when the board item is missing", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				sourceBoardItemId: "item-instance:missing",
				targetBoardItemId: "item-instance:missing",
				type: "board.items.swap",
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "invalid_actor",
			},
		});
	});

	it("swaps a board producer with a running producer job", () => {
		const config = createEngineTestConfig({
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:rock",
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
		const started = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 100,
			save,
		});

		const result = runAction({
			action: {
				sourceBoardItemId: "item-instance:1",
				targetBoardItemId: "item-instance:2",
				type: "board.items.swap",
			},
			config,
			nowMs: 200,
			save: started.save,
		});

		expect(result.save.board.items["item-instance:1"]).toMatchObject({
			itemId: "item:producer",
			x: 1,
			y: 0,
		});
		expect(result.save.board.items["item-instance:2"]).toMatchObject({
			itemId: "item:rock",
			x: 0,
			y: 0,
		});
		expect(readOnlyRecordValue(result.save.producerJobs)).toMatchObject({
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
		});
	});

	it("stacks matching board items instead of swapping them", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 3,
				},
				title: "Test",
			},
			startingState: {
				board: [
					{
						itemId: "item:twig",
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
		save.board.items["item-instance:1"] = {
			...save.board.items["item-instance:1"],
			quantity: 2,
		};
		save.board.items["item-instance:2"] = {
			...save.board.items["item-instance:2"],
			quantity: 2,
		};

		const result = runAction({
			action: {
				sourceRef: {
					itemInstanceId: "item-instance:1",
					kind: "board",
					quantity: 2,
				},
				targetItemInstanceId: "item-instance:2",
				type: "item.stack",
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result.save.board.items["item-instance:1"]).toMatchObject({
			quantity: 1,
			x: 0,
			y: 0,
		});
		expect(result.save.board.items["item-instance:2"]).toMatchObject({
			quantity: 3,
			x: 1,
			y: 0,
		});
		expect(result.events).toMatchObject([
			{
				from: {
					itemInstanceId: "item-instance:1",
					nextQuantity: 1,
					previousQuantity: 2,
					quantity: 1,
				},
				reason: "board-stack",
				type: "item.consumed",
			},
			{
				reason: "board-stack",
				to: {
					itemInstanceId: "item-instance:2",
				},
				type: "item.created",
			},
		]);
	});

	it("removes the source board item when stacking consumes the whole source", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 3,
				},
				title: "Test",
			},
			startingState: {
				board: [
					{
						itemId: "item:twig",
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

		const result = runAction({
			action: {
				sourceRef: {
					itemInstanceId: "item-instance:1",
					kind: "board",
					quantity: 1,
				},
				targetItemInstanceId: "item-instance:2",
				type: "item.stack",
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result.save.board.items["item-instance:1"]).toBeUndefined();
		expect(result.save.board.items["item-instance:2"]).toMatchObject({
			quantity: 2,
			x: 1,
			y: 0,
		});
	});

	it("stacks inventory items into matching board stacks", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 2,
				},
				title: "Test",
			},
			startingState: {
				board: [
					{
						itemId: "item:twig",
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
		save.board.items["item-instance:1"] = {
			...save.board.items["item-instance:1"],
			quantity: 2,
		};
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 2,
		};

		const result = runAction({
			action: {
				sourceRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				targetItemInstanceId: "item-instance:1",
				type: "item.stack",
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result.save.board.items["item-instance:1"]).toMatchObject({
			quantity: 3,
		});
		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
	});

	it("stores only the craft input capacity from an excessive board stack", () => {
		const config = createEngineCraftTableTestConfig({
			noRecipeInputs: false,
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			quantity: 5,
			x: 1,
			y: 0,
		};

		const result = runAction({
			action: {
				inputRef: {
					itemInstanceId: "item-instance:2",
					kind: "board",
					quantity: 5,
				},
				targetItemInstanceId: "item-instance:1",
				type: "craft.input.store",
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result.save.board.items["item-instance:2"]).toMatchObject({
			quantity: 3,
		});
		expect(result.events).toContainEqual(
			expect.objectContaining({
				from: expect.objectContaining({
					nextQuantity: 3,
					previousQuantity: 5,
					quantity: 2,
				}),
				reason: "craft-input-store",
				type: "item.consumed",
			}),
		);
	});

	it("stores only the producer input capacity from an excessive board stack", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			quantity: 5,
			x: 1,
			y: 0,
		};

		const result = runAction({
			action: {
				inputRef: {
					itemInstanceId: "item-instance:2",
					kind: "board",
					quantity: 5,
				},
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "producer.input.store",
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result.save.board.items["item-instance:2"]).toMatchObject({
			quantity: 4,
		});
		expect(result.save.producerInputs["item-instance:1"]?.lineInputs["line:shred"]).toEqual({
			items: {
				"item:twig": 1,
			},
		});
		expect(result.events).toContainEqual(
			expect.objectContaining({
				from: expect.objectContaining({
					nextQuantity: 4,
					previousQuantity: 5,
					quantity: 1,
				}),
				reason: "producer-input-store",
				type: "item.consumed",
			}),
		);
	});

	it("places one inventory item on a board cell", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 2,
		};

		const result = runAction({
			action: {
				slotIndex: 0,
				type: "inventory.item.place",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toBeDefined();
		expect(result.events).toMatchObject([
			{
				reason: "inventory-placement",
				type: "item.consumed",
			},
			{
				reason: "inventory-placement",
				type: "item.created",
			},
		]);
	});

	it("places the final inventory stack item on the board", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const result = runAction({
			action: {
				slotIndex: 0,
				type: "inventory.item.place",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result.save.inventory.slots[0]).toBeNull();
		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toBeDefined();
	});

	it("places the final inventory stack item into an existing board stack when the board is full", () => {
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
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			...save.board.items["item-instance:2"],
			quantity: 2,
		};

		const result = runAction({
			action: {
				placementMode: "nearest_by_manhattan",
				slotIndex: 0,
				type: "inventory.item.place",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result.save.inventory.slots[0]).toBeNull();
		expect(result.save.board.items["item-instance:2"]).toMatchObject({
			itemId: "item:twig",
			quantity: 3,
			x: 1,
			y: 0,
		});
	});

	it("places the final inventory instance item on the board", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			createdAtMs: 1,
			id: "item-instance:stored",
			itemId: "item:plank",
			kind: "instance",
		};

		const result = runAction({
			action: {
				slotIndex: 0,
				type: "inventory.item.place",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result.save.inventory.slots[0]).toBeNull();
		expect(result.save.board.items["item-instance:stored"]).toEqual({
			createdAtMs: 1,
			id: "item-instance:stored",
			itemId: "item:plank",
			x: 1,
			y: 0,
		});
	});

	it("rejects placing inventory-only items on the board", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					storage: "inventory",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const result = runActionEither({
			action: {
				slotIndex: 0,
				type: "inventory.item.place",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "storage_restricted",
			},
		});
	});

	it("places an inventory stack around a seeded board cell", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 2,
		};

		const result = runAction({
			action: {
				placementMode: "nearest_by_manhattan",
				quantity: 2,
				slotIndex: 0,
				type: "inventory.item.place",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 10,
			save,
		});

		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toMatchObject({
			quantity: 2,
		});
		expect(result.save.inventory.slots[0]).toBeNull();
		expect(result.events).toMatchObject([
			{
				from: {
					nextQuantity: 0,
					previousQuantity: 2,
					quantity: 2,
					slotIndex: 0,
				},
				reason: "inventory-placement",
				type: "item.consumed",
			},
			{
				to: {
					kind: "board",
					quantity: 2,
					x: 1,
					y: 0,
				},
				type: "item.created",
			},
		]);
	});

	it("fills board stack cells before spilling an inventory stack remainder", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 3,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 7,
		};

		const result = runAction({
			action: {
				quantity: 7,
				slotIndex: 0,
				type: "inventory.item.place",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 10,
			save,
		});

		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toMatchObject({
			quantity: 3,
		});
		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 2,
				y: 0,
			}),
		).toMatchObject({
			quantity: 3,
		});
		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(
			result.events.filter((event) => event.type === "item.created").map((event) => event.to),
		).toEqual([
			expect.objectContaining({
				kind: "board",
				quantity: 3,
				x: 1,
				y: 0,
			}),
			expect.objectContaining({
				kind: "board",
				quantity: 3,
				x: 2,
				y: 0,
			}),
			expect.objectContaining({
				kind: "inventory",
				quantity: 1,
				slotIndex: 0,
			}),
		]);
	});

	it("places seeded inventory items around an occupied seed cell", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const result = runAction({
			action: {
				placementMode: "nearest_by_manhattan",
				slotIndex: 0,
				type: "inventory.item.place",
				x: 0,
				y: 0,
			},
			config,
			nowMs: 10,
			save,
		});

		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toBeDefined();
		expect(result.save.inventory.slots[0]).toBeNull();
	});

	it("rejects nearest inventory placement when no board cell can receive the item", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 1,
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

		const result = runActionEither({
			action: {
				placementMode: "nearest_by_manhattan",
				slotIndex: 0,
				type: "inventory.item.place",
				x: 0,
				y: 0,
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "board:full",
			},
		});
		expect(save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
	});

	it("stashes a stateful stackable board item as an inventory instance", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:craft-stack": {
					assetIds: [
						"asset:test",
					],
					description: "Stackable craft target",
					maxStackSize: 3,
					name: "Craft Stack",
					storage: "both",
					tags: [],
					tier: 0,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:craft-stack",
						x: 0,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "item:craft-stack",
						quantity: 2,
					},
				],
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

		const stashed = runAction({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.stash",
			},
			config,
			nowMs: 10,
			save,
		});

		expect(stashed.save.board.items["item-instance:1"]).toBeUndefined();
		expect(stashed.save.inventory.slots).toEqual([
			{
				itemId: "item:craft-stack",
				quantity: 2,
			},
			{
				id: "item-instance:1",
				itemId: "item:craft-stack",
				kind: "instance",
			},
		]);
		expect(stashed.save.craftInputs["item-instance:1"]).toEqual({
			items: {
				"item:twig": 1,
			},
		});

		const placed = runAction({
			action: {
				slotIndex: 1,
				type: "inventory.item.place",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 20,
			save: stashed.save,
		});

		expect(placed.save.inventory.slots[1]).toBeNull();
		expect(placed.save.board.items["item-instance:1"]).toEqual({
			id: "item-instance:1",
			itemId: "item:craft-stack",
			x: 1,
			y: 0,
		});
		expect(placed.save.craftInputs["item-instance:1"]).toEqual({
			items: {
				"item:twig": 1,
			},
		});
	});

	it("rejects stashing a board item with a running job", () => {
		const config = createEngineCraftTableTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			recipeId: "item:craft-table",
			startAtMs: 0,
			targetItemInstanceId: "item-instance:1",
		};

		const result = runActionEither({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.stash",
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "item_busy",
			},
		});
	});

	it("rejects stashing board-only items into inventory", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:producer": {
					...baseConfig.items["item:producer"],
					storage: "board",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.stash",
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "storage_restricted",
			},
		});
	});

	it("stashes a board item into inventory", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.stash",
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result.save.board.items["item-instance:1"]).toBeUndefined();
		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:producer",
			quantity: 1,
		});
		expect(result.events).toMatchObject([
			{
				reason: "board-stash",
				type: "item.consumed",
			},
			{
				reason: "board-stash",
				type: "item.created",
			},
		]);
	});
});
