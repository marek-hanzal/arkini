import { describe, expect, it } from "vitest";
import { createEngineCraftTableTestConfig } from "~/v0/game/engine/test/createEngineCraftTableTestConfig";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import {
	findBoardItem,
	readOnlyRecordValue,
	runAction,
	runActionEither,
	runInitialSave,
} from "~/v0/game/engine/applyGameActionFx.testSupport";

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

	it("swaps a board producer with a running producer job", () => {
		const baseConfig = createEngineTestConfig();
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
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
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
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
		});
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
		).toBeDefined();
		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
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
					x: 1,
					y: 0,
				},
				type: "item.created",
			},
			{
				to: {
					kind: "inventory",
					nextQuantity: 1,
					previousQuantity: 0,
					quantity: 1,
					slotIndex: 0,
				},
				type: "item.created",
			},
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
