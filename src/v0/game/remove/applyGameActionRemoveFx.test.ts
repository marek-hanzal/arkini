import { describe, expect, it } from "vitest";
import { createEngineCraftTableTestConfig } from "~/v0/game/engine/test/createEngineCraftTableTestConfig";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import {
	runAction,
	runActionEither,
	runInitialSave,
} from "~/v0/game/engine/applyGameActionFx.testSupport";

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
			productInputs: {
				"product:shred": {
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
});
