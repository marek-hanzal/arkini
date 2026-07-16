import { describe, expect, it } from "vitest";
import { createEngineCraftTableTestConfig } from "~/engine/test/createEngineCraftTableTestConfig";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { runAction, runActionEither, runInitialSave } from "~/engine/applyGameActionFx.testSupport";

describe("applyGameActionFx remove", () => {
	it("removes a tile with a kept tool", () => {
		const config = createEngineTestConfig({
			startingState: {
				board: [
					{
						itemId: "item:rock",
						x: 0,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "item:axe",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				targetItemInstanceId: "item-instance:1",
				toolRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				type: "tile.remove",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items).toEqual({});
		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:axe",
			quantity: 1,
		});
		expect(result.events).toEqual([
			{
				itemId: "item:rock",
				itemInstanceId: "item-instance:1",
				reason: "tile-remove",
				atMs: 100,
				type: "item.removed",
			},
		]);
	});

	it("rejects removing a tile with a running craft job", () => {
		const baseConfig = createEngineCraftTableTestConfig();
		const config = createEngineCraftTableTestConfig();
		config.items["item:craft-table"] = {
			...baseConfig.items["item:craft-table"],
			removeBy: [
				{
					itemId: "item:axe",
					mode: "keep",
				},
			],
		};
		config.startingState.inventory = [
			{
				itemId: "item:axe",
				quantity: 1,
			},
		];
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = runAction({
			action: {
				recipeId: "item:craft-table",
				targetItemInstanceId: "item-instance:1",
				type: "craft.start",
			},
			config,
			nowMs: 100,
			save,
		});

		const result = runActionEither({
			action: {
				targetItemInstanceId: "item-instance:1",
				toolRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				type: "tile.remove",
			},
			config,
			nowMs: 200,
			save: started.save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "invalid_actor",
			});
		}
		expect(started.save.board.items["item-instance:1"]).toMatchObject({
			itemId: "item:craft-table",
		});
		expect(Object.values(started.save.craftJobs)).toHaveLength(1);
	});

	it("removes producer input state owned by a removed board item", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:producer": {
					...baseConfig.items["item:producer"],
					removeBy: [
						{
							itemId: "item:axe",
							mode: "keep",
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
						itemId: "item:axe",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerInputs["item-instance:1"] = {
			lineInputs: {
				"line:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runAction({
			action: {
				targetItemInstanceId: "item-instance:1",
				toolRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				type: "tile.remove",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items).toEqual({});
		expect(result.save.producerInputs).toEqual({});
	});

	it("consumes a single-use removal tool and places configured removal loot", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:pickaxe": {
					assetIds: [
						"asset:test",
					],
					description: "Pickaxe",
					maxStackSize: 3,
					name: "Pickaxe",
					storage: "both",
					tags: [],
					tier: 0,
				},
				"item:rock": {
					...baseConfig.items["item:rock"],
					removeBy: [
						{
							itemId: "item:pickaxe",
							mode: "consume",
							output: [
								{
									entries: [
										{
											itemId: "item:stone",
											quantity: {
												max: 4,
												min: 1,
											},
											type: "guaranteed",
										},
									],
								},
							],
						},
					],
				},
				"item:stone": {
					assetIds: [
						"asset:test",
					],
					description: "Stone",
					maxStackSize: 10,
					name: "Stone",
					storage: "both",
					tags: [],
					tier: 0,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:rock",
						x: 0,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "item:pickaxe",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				targetItemInstanceId: "item-instance:1",
				toolRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				type: "tile.remove",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.inventory.slots[0]).toBeNull();
		expect(Object.values(result.save.board.items)).toEqual([
			expect.objectContaining({
				itemId: "item:stone",
				x: 0,
				y: 0,
			}),
		]);
		expect(result.events).toMatchObject([
			{
				itemId: "item:pickaxe",
				reason: "remove-tool",
				type: "item.consumed",
			},
			{
				itemId: "item:rock",
				reason: "tile-remove",
				type: "item.removed",
			},
			{
				itemId: "item:stone",
				originItemInstanceId: "item-instance:1",
				reason: "tile-remove-output",
				type: "item.created",
			},
		]);
	});
});
