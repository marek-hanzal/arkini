import { describe, expect, it } from "vitest";
import { createEngineCraftTableTestConfig } from "~/v0/game/engine/test/createEngineCraftTableTestConfig";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import {
	findBoardItem,
	readOnlyRecordValue,
	runAction,
	runActionEither,
	runInitialSave,
} from "~/v0/game/engine/fx/applyGameActionFx.testSupport";

describe("applyGameActionFx Stash", () => {
	it("opens a stash by applying output and depletion atomically", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 2,
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
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:stash",
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

		const result = runAction({
			action: {
				inputRefs: [
					{
						kind: "inventory",
						quantity: 1,
						slotIndex: 0,
					},
				],
				stashItemInstanceId: "item-instance:2",
				type: "stash.open",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.itemSpawnJobs).toEqual({});
		expect(result.save.board.items).not.toHaveProperty("item-instance:2");
		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 2,
		});
		expect(result.events).toMatchObject([
			{
				itemId: "item:key",
				reason: "stash-input",
				type: "item.consumed",
			},
			{
				remainingCharges: 0,
				stashItemInstanceId: "item-instance:2",
				type: "stash.opened",
			},
			{
				itemId: "item:twig",
				reason: "stash-output",
				to: {
					kind: "inventory",
					quantity: 2,
				},
				type: "item.created",
			},
			{
				stashItemInstanceId: "item-instance:2",
				type: "stash.depleted",
			},
			{
				itemInstanceId: "item-instance:2",
				reason: "stash-depleted",
				type: "item.removed",
			},
		]);
	});

	it("opens every remaining stash charge in one atomic sequential-placement batch", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			stashes: {
				...baseConfig.stashes,
				"stash:test": {
					...baseConfig.stashes["stash:test"],
					charges: 2,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:stash",
						x: 0,
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

		const result = runAction({
			action: {
				inputRefs: [
					{
						kind: "inventory",
						quantity: 1,
						slotIndex: 0,
					},
				],
				stashItemInstanceId: "item-instance:1",
				type: "stash.open",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.stashes).toEqual({});
		expect(result.save.itemSpawnJobs).toEqual({});
		expect(result.save.board.items).not.toHaveProperty("item-instance:1");
		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toBeDefined();
		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 3,
		});
		expect(result.events.map((event) => event.type)).toEqual([
			"item.consumed",
			"stash.opened",
			"item.created",
			"item.created",
			"item.created",
			"stash.depleted",
			"item.removed",
		]);
		expect(result.events.filter((event) => event.type === "item.created")).toMatchObject([
			{
				to: {
					kind: "board",
					x: 1,
					y: 0,
				},
			},
			{
				to: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
			},
			{
				to: {
					kind: "inventory",
					quantity: 2,
					slotIndex: 0,
				},
			},
		]);
	});

	it("rejects a full stash open when only part of the remaining output fits", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 1,
				},
				title: "Test",
			},
			stashes: {
				...baseConfig.stashes,
				"stash:test": {
					...baseConfig.stashes["stash:test"],
					charges: 2,
					inputs: [],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:stash",
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
				stashItemInstanceId: "item-instance:1",
				inputRefs: [],
				type: "stash.open",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "board:full",
			});
		}
		expect(save.stashes).toEqual({});
		expect(save.board.items["item-instance:1"]).toMatchObject({
			itemId: "item:stash",
		});
		expect(save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
	});

	it("keeps stash open state untouched when output placement is unavailable", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 2,
				},
				board: {
					height: 1,
					width: 2,
				},
				title: "Test",
			},
			stashes: {
				...baseConfig.stashes,
				"stash:test": {
					...baseConfig.stashes["stash:test"],
					inputs: [],
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
						itemId: "item:stash",
						x: 1,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "item:twig",
						quantity: 3,
					},
					{
						itemId: "item:plank",
						quantity: 2,
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
				stashItemInstanceId: "item-instance:2",
				inputRefs: [],
				type: "stash.open",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "board:full",
			});
		}
		expect(save.stashes).toEqual({});
		expect(save.itemSpawnJobs).toEqual({});
		expect(save.board.items["item-instance:2"]).toMatchObject({
			itemId: "item:stash",
		});
	});

	it("replaces a depleted stash atomically when configured", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 2,
				},
				board: {
					height: 1,
					width: 2,
				},
				title: "Test",
			},
			stashes: {
				...baseConfig.stashes,
				"stash:test": {
					...baseConfig.stashes["stash:test"],
					onDepleted: {
						replaceWithItemId: "item:empty-stash",
					},
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
						itemId: "item:stash",
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

		const result = runAction({
			action: {
				inputRefs: [
					{
						kind: "inventory",
						quantity: 1,
						slotIndex: 0,
					},
				],
				stashItemInstanceId: "item-instance:2",
				type: "stash.open",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.itemSpawnJobs).toEqual({});
		expect(result.save.board.items["item-instance:2"]).toMatchObject({
			itemId: "item:empty-stash",
			x: 1,
			y: 0,
		});
		expect(result.save.stashes).toEqual({});
		expect(result.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					fromItemId: "item:stash",
					itemInstanceId: "item-instance:2",
					reason: "stash-depleted",
					toItemId: "item:empty-stash",
					type: "item.replaced",
				}),
			]),
		);
	});
});
