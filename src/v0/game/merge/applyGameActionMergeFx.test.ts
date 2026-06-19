import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import {
	runAction,
	runActionEither,
	runInitialSave,
} from "~/v0/game/engine/applyGameActionFx.testSupport";

describe("applyGameActionFx merge", () => {
	it("merges only source-owned explicit combo rules", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:water": {
					assetId: "asset:test",
					code: "water",
					description: "Water",
					maxStackSize: 3,
					mergeIds: [
						"merge:water-twig",
					],
					name: "Water",
					sort: 8,
					storage: "both",
					tags: [],
					tier: 0,
				},
			},
			merge: {
				...baseConfig.merge,
				"merge:water-twig": {
					resultItemId: "item:plank",
					withItemId: "item:twig",
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:water",
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

		const waterIntoTwig = runAction({
			action: {
				sourceRef: {
					kind: "board",
					itemInstanceId: "item-instance:1",
				},
				targetItemInstanceId: "item-instance:2",
				type: "item.merge",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(waterIntoTwig.save.board.items["item-instance:1"]).toBeUndefined();
		expect(waterIntoTwig.save.board.items["item-instance:2"]).toMatchObject({
			itemId: "item:plank",
		});

		const freshSave = runInitialSave({
			config,
			nowMs: 0,
		});
		const twigIntoWater = runActionEither({
			action: {
				sourceRef: {
					kind: "board",
					itemInstanceId: "item-instance:2",
				},
				targetItemInstanceId: "item-instance:1",
				type: "item.merge",
			},
			config,
			nowMs: 100,
			save: freshSave,
		});

		expect(twigIntoWater._tag).toBe("Left");
	});

	it("merges an inventory source into a board target", () => {
		const config = createEngineTestConfig({
			startingState: {
				board: [
					{
						itemId: "item:twig",
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

		const result = runAction({
			action: {
				sourceRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				targetItemInstanceId: "item-instance:1",
				type: "item.merge",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.inventory.slots[0]).toBeNull();
		expect(result.save.board.items["item-instance:1"]).toMatchObject({
			itemId: "item:plank",
		});
		expect(result.events).toMatchObject([
			{
				itemId: "item:twig",
				reason: "merge-source",
				type: "item.consumed",
			},
			{
				fromItemId: "item:twig",
				reason: "merge-result",
				toItemId: "item:plank",
				type: "item.replaced",
			},
		]);
	});
});
