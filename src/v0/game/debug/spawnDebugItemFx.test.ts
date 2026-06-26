import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import {
	findBoardItem,
	runAction,
	runActionEither,
	runInitialSave,
} from "~/v0/game/engine/applyGameActionFx.testSupport";

describe("spawnDebugItemFx", () => {
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

	it("places debug board items into the first effect-allowed cell", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:block-near-producer": {
					name: "Block near producer",
					operations: [
						{
							kind: "item.blockCreate",
							target: {
								itemIds: [
									"item:twig",
								],
							},
						},
					],
					radius: 1,
					scope: "local",
				},
			},
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
			items: {
				...baseConfig.items,
				"item:producer": {
					...baseConfig.items["item:producer"],
					passiveEffectIds: [
						"effect:block-near-producer",
					],
				},
			},
		});
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
				x: 2,
				y: 0,
			}),
		).toBeDefined();
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
