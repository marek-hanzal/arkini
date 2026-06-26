import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runAction, runInitialSave } from "~/v0/game/engine/applyGameActionFx.testSupport";

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
