import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { cheatSpeedDisableItemId, cheatSpeedEnableItemId } from "~/cheat/GameCheatSpeedItem";
import {
	findBoardItem,
	runAction,
	runActionEither,
	runInitialSave,
} from "~/engine/applyGameActionFx.testSupport";

describe("spawnDebugItemFx", () => {
	it("spawns speed watches as the current mode item", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				[cheatSpeedDisableItemId]: {
					assetIds: [
						"asset:test",
					],
					description: "Closed speed watch",
					maxStackSize: 3,
					name: "Closed Speed Watch",
					storage: "both",
					tags: [],
					tier: 0,
				},
				[cheatSpeedEnableItemId]: {
					assetIds: [
						"asset:test",
					],
					description: "Open speed watch",
					maxStackSize: 3,
					name: "Open Speed Watch",
					storage: "both",
					tags: [],
					tier: 0,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const normalSpawn = runAction({
			action: {
				itemId: cheatSpeedEnableItemId,
				location: "inventory",
				type: "debug.item.spawn",
			},
			config,
			nowMs: 100,
			save,
		}).save;

		expect(normalSpawn.inventory.slots[0]).toMatchObject({
			itemId: cheatSpeedDisableItemId,
			quantity: 1,
		});

		const instantSave = runAction({
			action: {
				mode: "instant",
				type: "cheat.speed_mode.set",
			},
			config,
			nowMs: 200,
			save: normalSpawn,
		}).save;
		const instantSpawn = runAction({
			action: {
				itemId: cheatSpeedDisableItemId,
				location: "inventory",
				type: "debug.item.spawn",
			},
			config,
			nowMs: 300,
			save: instantSave,
		}).save;

		expect(instantSpawn.inventory.slots[0]).toMatchObject({
			itemId: cheatSpeedEnableItemId,
			quantity: 2,
		});
	});
	it("spawns a debug item on the first empty board cell", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				itemId: "item:twig",
				location: "board",
				type: "debug.item.spawn",
			},
			config,
			nowMs: 100,
			save,
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
				itemId: "item:twig",
				reason: "debug",
				to: {
					kind: "board",
					x: 1,
					y: 0,
				},
				type: "item.created",
			},
		]);
	});

	it("adds a debug item to the real game inventory", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				itemId: "item:twig",
				location: "inventory",
				type: "debug.item.spawn",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(result.events).toMatchObject([
			{
				itemId: "item:twig",
				reason: "debug",
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

	it("stacks debug inventory items into compatible existing stacks", () => {
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
				itemId: "item:twig",
				location: "inventory",
				type: "debug.item.spawn",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 3,
		});
		expect(result.events).toMatchObject([
			{
				to: {
					nextQuantity: 3,
					previousQuantity: 2,
					quantity: 1,
					slotIndex: 0,
				},
				type: "item.created",
			},
		]);
	});

	it("rejects board debug spawn above item maxCount", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					maxCount: 1,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		};

		const result = runActionEither({
			action: {
				itemId: "item:twig",
				location: "board",
				type: "debug.item.spawn",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "board:max-count",
			},
		});
	});

	it("rejects board-only overflow instead of silently falling back to inventory", () => {
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

		const result = runActionEither({
			action: {
				itemId: "item:twig",
				location: "board",
				type: "debug.item.spawn",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "board:full",
			},
		});
	});
});
